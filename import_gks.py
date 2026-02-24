#!/usr/bin/env python3
"""Import GKS schemas from GitHub repos into the registry API.

Fetches JSON Schema files from ga4gh repos (vrs, gks-core, cat-vrs, va-spec)
and generates static API files.
"""

import json
import os
import subprocess
import tempfile
import urllib.request

import yaml

from registry_utils import (
    make_pagination,
    write_json,
    write_schema_version,
    write_versions_list,
    write_latest_alias,
)

API_DIR = "api"

# GKS schema configs -- which repos, paths, and versions to fetch
NAMESPACE = "ga4gh"
CONTACT_URL = "https://github.com/ga4gh"

SCHEMAS = [
    {
        "name": "vrs",
        "repo": "ga4gh/vrs",
        "schema_path": "schema/vrs/json",
        "source_yaml": "schema/vrs/vrs-source.yaml",
        "versions": [
            {"tag": "2.0.1", "status": "current"},
            {"tag": "2.0.0-ballot.2024-11.3", "status": "deprecated"},
        ],
        "maintainers": ["GKS Work Stream"],
        "maturity_level": "trial_use",
    },
    {
        "name": "gks-core",
        "repo": "ga4gh/gks-core",
        "schema_path": "schema/gks-core/json",
        "source_yaml": "schema/gks-core/gks-core-source.yaml",
        "versions": [{"tag": "1.1.0", "status": "current"}],
        "maintainers": ["GKS Work Stream"],
        "maturity_level": "trial_use",
    },
    {
        "name": "cat-vrs",
        "repo": "ga4gh/cat-vrs",
        "schema_path": "schema/cat-vrs/json",
        "source_yaml": "schema/cat-vrs/cat-vrs-source.yaml",
        "versions": [{"tag": "1.0.0", "status": "current"}],
        "maintainers": ["GKS Work Stream"],
        "maturity_level": "trial_use",
    },
    {
        "name": "va-spec",
        "repo": "ga4gh/va-spec",
        "schema_paths": [
            "schema/va-spec/base/json",
            "schema/va-spec/acmg-2015/json",
            "schema/va-spec/aac-2017/json",
            "schema/va-spec/ccv-2022/json",
        ],
        "source_yaml": "schema/va-spec/base/va-spec-source.yaml",
        "versions": [
            {"tag": "1.0.1", "status": "current"},
            {"tag": "1.0.0", "status": "deprecated"},
        ],
        "maintainers": ["GKS Work Stream"],
        "maturity_level": "trial_use",
    },
    {
        "name": "seqcol-minimal",
        "repo": "ga4gh/refget",
        "branch": "master",
        "schema_file": "docs/schemas/seqcol_minimal_v1.0.0.json",
        "versions": [{"tag": "1.0.0", "status": "current"}],
        "maintainers": ["Refget Work Stream"],
        "maturity_level": "draft",
    },
    {
        "name": "seqcol-extended",
        "repo": "ga4gh/refget",
        "branch": "master",
        "schema_file": "docs/schemas/seqcol_extended_v1.0.0.json",
        "versions": [{"tag": "1.0.0", "status": "current"}],
        "maintainers": ["Refget Work Stream"],
        "maturity_level": "draft",
    },
    {
        "name": "seqcol-refs",
        "repo": "ga4gh/refget",
        "branch": "master",
        "schema_file": "docs/schemas/seqcol_refs_v1.0.0.json",
        "versions": [{"tag": "1.0.0", "status": "current"}],
        "maintainers": ["Refget Work Stream"],
        "maturity_level": "draft",
    },
]


def fetch_github_tarball(repo, tag, dest_dir):
    """Download and extract a GitHub release tarball."""
    url = f"https://github.com/{repo}/archive/refs/tags/{tag}.tar.gz"
    tarball = os.path.join(dest_dir, "repo.tar.gz")

    print(f"  Fetching {url}")
    urllib.request.urlretrieve(url, tarball)

    subprocess.run(["tar", "xzf", tarball, "-C", dest_dir], check=True, capture_output=True)
    os.remove(tarball)

    entries = [e for e in os.listdir(dest_dir) if os.path.isdir(os.path.join(dest_dir, e))]
    if len(entries) != 1:
        raise RuntimeError(f"Expected one directory in tarball, got: {entries}")
    return os.path.join(dest_dir, entries[0])


def clone_repo(repo, branch, dest_dir):
    """Shallow-clone a GitHub repo at a specific branch."""
    url = f"https://github.com/{repo}.git"
    print(f"  Cloning {url} @ {branch}")
    subprocess.run(
        ["git", "clone", "--depth", "1", "--branch", branch, url, dest_dir],
        check=True,
        capture_output=True,
    )
    return dest_dir


def load_components_from_dir(schema_dir):
    """Load all JSON Schema component files from a directory."""
    components = {}
    if not os.path.isdir(schema_dir):
        print(f"  WARNING: Schema directory not found: {schema_dir}")
        return components

    for entry in sorted(os.listdir(schema_dir)):
        filepath = os.path.join(schema_dir, entry)
        if not os.path.isfile(filepath) or entry.startswith(".") or entry.endswith(".md"):
            continue
        with open(filepath) as f:
            raw = f.read()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            # Retry after stripping trailing commas (common JSON5-ism)
            import re
            cleaned = re.sub(r',\s*([}\]])', r'\1', raw)
            try:
                data = json.loads(cleaned)
            except json.JSONDecodeError:
                print(f"  WARNING: Could not parse {filepath}")
                continue
        name = data.get("title", entry.replace(".json", ""))
        components[name] = data

    return components


def load_single_schema_file(filepath):
    """Load a single JSON Schema file. Returns it as the sole component keyed by filename."""
    with open(filepath) as f:
        raw = f.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        import re
        cleaned = re.sub(r',\s*([}\]])', r'\1', raw)
        data = json.loads(cleaned)
    name = data.get("title", os.path.basename(filepath).replace(".json", ""))
    return {name: data}


def build_gks(api_dir=API_DIR):
    """Build API files for all GKS schemas. Returns list of SchemaRecord dicts."""
    tmp_dir = tempfile.mkdtemp(prefix="gks-build-")
    schema_records = []

    clone_cache = {}  # Cache cloned repos by "repo@branch" to avoid re-cloning

    try:
        for schema_cfg in SCHEMAS:
            schema_name = schema_cfg["name"]
            versions = schema_cfg["versions"]
            version_records = []

            latest_version = next(
                (v["tag"] for v in versions if v["status"] == "current"),
                versions[0]["tag"],
            )

            for version_cfg in versions:
                tag = version_cfg["tag"]
                print(f"\nBuilding {schema_name} @ {tag}")

                if "branch" in schema_cfg:
                    cache_key = f"{schema_cfg['repo']}@{schema_cfg['branch']}"
                    if cache_key not in clone_cache:
                        version_tmp = tempfile.mkdtemp(dir=tmp_dir)
                        clone_cache[cache_key] = clone_repo(schema_cfg["repo"], schema_cfg["branch"], version_tmp)
                    repo_dir = clone_cache[cache_key]
                else:
                    version_tmp = tempfile.mkdtemp(dir=tmp_dir)
                    repo_dir = fetch_github_tarball(schema_cfg["repo"], tag, version_tmp)

                # Load components
                components = {}
                if "schema_file" in schema_cfg:
                    components = load_single_schema_file(os.path.join(repo_dir, schema_cfg["schema_file"]))
                elif "schema_paths" in schema_cfg:
                    for sp in schema_cfg["schema_paths"]:
                        components.update(load_components_from_dir(os.path.join(repo_dir, sp)))
                else:
                    components = load_components_from_dir(os.path.join(repo_dir, schema_cfg["schema_path"]))

                if not components:
                    print(f"  WARNING: No components found for {schema_name} @ {tag}")
                    continue

                print(f"  Found {len(components)} components")

                # Get bundle $id from source YAML
                source_yaml_id = None
                source_path = os.path.join(repo_dir, schema_cfg.get("source_yaml", ""))
                if os.path.isfile(source_path):
                    with open(source_path) as f:
                        source_yaml_id = yaml.safe_load(f).get("$id")

                # Build bundle
                if source_yaml_id:
                    bundle_id = source_yaml_id.rsplit("/", 1)[0]
                else:
                    bundle_id = f"https://w3id.org/ga4gh/schema/{schema_name}/{tag}"

                bundle = {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "$id": bundle_id,
                    "$defs": {n: c for n, c in sorted(components.items())},
                }

                write_schema_version(NAMESPACE, schema_name, tag, components, bundle, api_dir)

                version_records.append({
                    "schema_name": schema_name,
                    "version": tag,
                    "status": version_cfg["status"],
                    "release_date": "",
                    "contributors": schema_cfg.get("maintainers", []),
                    "release_notes": "",
                    "tags": {},
                })

            write_versions_list(NAMESPACE, schema_name, version_records, api_dir)
            write_latest_alias(NAMESPACE, schema_name, latest_version, api_dir)

            schema_records.append({
                "namespace": NAMESPACE,
                "schema_name": schema_name,
                "latest_released_version": latest_version,
                "maintainers": schema_cfg.get("maintainers", []),
                "maturity_level": schema_cfg.get("maturity_level", "draft"),
            })

    finally:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)

    # Write schemas list for namespace
    write_json(
        os.path.join(api_dir, "schemas", NAMESPACE, "index.json"),
        {
            "pagination": make_pagination(len(schema_records)),
            "results": schema_records,
        },
    )

    return {
        "namespace_name": NAMESPACE,
        "contact_url": CONTACT_URL,
        "schema_count": len(schema_records),
    }


if __name__ == "__main__":
    import shutil
    if os.path.exists(API_DIR):
        shutil.rmtree(API_DIR)
    build_gks()
