#!/usr/bin/env python3
"""Build static JSON API files for the GA4GH Schema Registry site.

Reads registry.yaml, fetches JSON Schema files from GitHub repos,
and generates static API responses matching the Schema Registry spec.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import urllib.error

import yaml


def load_registry(path="registry.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)


def fetch_github_tarball(repo, tag, dest_dir):
    """Download and extract a GitHub release tarball."""
    url = f"https://github.com/{repo}/archive/refs/tags/{tag}.tar.gz"
    tarball = os.path.join(dest_dir, "repo.tar.gz")

    print(f"  Fetching {url}")
    urllib.request.urlretrieve(url, tarball)

    subprocess.run(
        ["tar", "xzf", tarball, "-C", dest_dir],
        check=True,
        capture_output=True,
    )
    os.remove(tarball)

    # Find extracted directory (github names it repo-tag)
    entries = [e for e in os.listdir(dest_dir) if os.path.isdir(os.path.join(dest_dir, e))]
    if len(entries) != 1:
        raise RuntimeError(f"Expected one directory in tarball, got: {entries}")
    return os.path.join(dest_dir, entries[0])


def load_components_from_dir(schema_dir):
    """Load all JSON Schema component files from a directory.

    Returns dict of {component_name: parsed_json}.
    """
    components = {}
    if not os.path.isdir(schema_dir):
        print(f"  WARNING: Schema directory not found: {schema_dir}")
        return components

    for entry in sorted(os.listdir(schema_dir)):
        filepath = os.path.join(schema_dir, entry)
        if not os.path.isfile(filepath):
            continue
        # Skip non-JSON files (files may or may not have .json extension)
        if entry.startswith("."):
            continue

        with open(filepath) as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                print(f"  WARNING: Could not parse {filepath}")
                continue

        # Use title or filename as component name
        name = data.get("title", entry.replace(".json", ""))
        components[name] = data

    return components


def build_compound_bundle(components, schema_name, version, source_yaml_id=None):
    """Build a compound JSON Schema document from individual components."""
    # Determine bundle $id
    if source_yaml_id:
        # Strip filename from source $id: .../vrs-source.yaml -> .../
        bundle_id = source_yaml_id.rsplit("/", 1)[0]
    else:
        bundle_id = f"https://w3id.org/ga4gh/schema/{schema_name}/{version}"

    bundle = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": bundle_id,
        "$defs": {},
    }

    for name, component in sorted(components.items()):
        bundle["$defs"][name] = component

    return bundle


def extract_component_record(name, component):
    """Extract a ComponentRecord from a JSON Schema component."""
    return {
        "component_name": name,
        "schema_id": component.get("$id", ""),
        "description": component.get("description", ""),
    }


def make_pagination(total):
    return {
        "page": 0,
        "page_size": 100000,
        "total": total,
        "total_pages": 1,
    }


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  Wrote {path}")


def build_schema_version(schema_cfg, version_cfg, registry, api_dir, tmp_dir):
    """Build API files for one schema + version combination."""
    repo = schema_cfg["repo"]
    tag = version_cfg["tag"]
    schema_name = schema_cfg["name"]
    namespace = registry["namespace"]

    print(f"\nBuilding {schema_name} @ {tag}")

    # Fetch repo tarball
    version_tmp = tempfile.mkdtemp(dir=tmp_dir)
    repo_dir = fetch_github_tarball(repo, tag, version_tmp)

    # Load components (supports single schema_path or multiple schema_paths)
    components = {}
    if "schema_paths" in schema_cfg:
        for sp in schema_cfg["schema_paths"]:
            schema_dir = os.path.join(repo_dir, sp)
            components.update(load_components_from_dir(schema_dir))
    else:
        schema_dir = os.path.join(repo_dir, schema_cfg["schema_path"])
        components = load_components_from_dir(schema_dir)

    if not components:
        print(f"  WARNING: No components found for {schema_name} @ {tag}")
        return components

    print(f"  Found {len(components)} components")

    # Load source YAML for $id if available
    source_yaml_id = None
    source_path = os.path.join(repo_dir, schema_cfg.get("source_yaml", ""))
    if os.path.isfile(source_path):
        with open(source_path) as f:
            source = yaml.safe_load(f)
            source_yaml_id = source.get("$id")

    # Build compound bundle
    bundle = build_compound_bundle(components, schema_name, tag, source_yaml_id)

    # Version directory
    ver_dir = os.path.join(api_dir, "schemas", namespace, schema_name, "versions", tag)

    # Write bundle as the version index
    write_json(os.path.join(ver_dir, "index.json"), bundle)

    # Write individual component files
    comp_dir = os.path.join(ver_dir, "components")
    component_records = []
    for name, component in sorted(components.items()):
        write_json(os.path.join(comp_dir, f"{name}.json"), component)
        component_records.append(extract_component_record(name, component))

    # Write components list
    write_json(
        os.path.join(comp_dir, "index.json"),
        {
            "pagination": make_pagination(len(component_records)),
            "results": component_records,
        },
    )

    return components


def build_all(registry_path="registry.yaml"):
    registry = load_registry(registry_path)
    namespace = registry["namespace"]
    server = registry["server"]
    api_dir = "api"

    # Clean previous build
    if os.path.exists(api_dir):
        shutil.rmtree(api_dir)

    tmp_dir = tempfile.mkdtemp(prefix="schema-registry-build-")
    schema_records = []
    all_paths = []

    try:
        for schema_cfg in registry["schemas"]:
            schema_name = schema_cfg["name"]
            versions = schema_cfg["versions"]
            version_records = []

            # Find the latest (current) version
            latest_version = None
            for v in versions:
                if v["status"] == "current":
                    latest_version = v["tag"]
                    break
            if not latest_version:
                latest_version = versions[0]["tag"]

            total_components = 0

            for version_cfg in versions:
                tag = version_cfg["tag"]
                components = build_schema_version(
                    schema_cfg, version_cfg, registry, api_dir, tmp_dir
                )
                total_components = max(total_components, len(components))

                version_records.append({
                    "schema_name": schema_name,
                    "version": tag,
                    "status": version_cfg["status"],
                    "release_date": "",
                    "contributors": schema_cfg.get("maintainers", []),
                    "release_notes": "",
                    "tags": {},
                })

            # Write versions list
            ver_list_path = os.path.join(
                api_dir, "schemas", namespace, schema_name, "versions", "index.json"
            )
            write_json(
                ver_list_path,
                {
                    "pagination": make_pagination(len(version_records)),
                    "results": version_records,
                },
            )

            # Copy latest version as "latest" alias
            latest_src = os.path.join(
                api_dir, "schemas", namespace, schema_name, "versions", latest_version
            )
            latest_dst = os.path.join(
                api_dir, "schemas", namespace, schema_name, "versions", "latest"
            )
            if os.path.isdir(latest_src):
                shutil.copytree(latest_src, latest_dst)

            schema_records.append({
                "namespace": namespace,
                "schema_name": schema_name,
                "latest_released_version": latest_version,
                "maintainers": schema_cfg.get("maintainers", []),
                "maturity_level": schema_cfg.get("maturity_level", "draft"),
            })

        # Write schemas list for namespace
        write_json(
            os.path.join(api_dir, "schemas", namespace, "index.json"),
            {
                "pagination": make_pagination(len(schema_records)),
                "results": schema_records,
            },
        )

        # Write namespaces list
        write_json(
            os.path.join(api_dir, "namespaces", "index.json"),
            {
                "pagination": make_pagination(1),
                "results": [
                    {
                        "server": server,
                        "namespace_name": namespace,
                        "contact_url": registry["contact_url"],
                    }
                ],
            },
        )

        # Write manifest
        manifest_paths = []
        for root, dirs, files in os.walk(api_dir):
            for f in files:
                rel = os.path.relpath(os.path.join(root, f), api_dir)
                manifest_paths.append(rel)
        manifest_paths.sort()
        write_json(
            os.path.join(api_dir, "manifest.json"),
            {"paths": manifest_paths},
        )

        print(f"\nBuild complete. Generated {len(manifest_paths)} files in {api_dir}/")

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    build_all()
