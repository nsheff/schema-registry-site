#!/usr/bin/env python3
"""Import FAIRtracks schemas into the registry API.

Converts LinkML schemas to JSON Schema using gen-json-schema,
splits the compound output into individual components, and generates
static API files.
"""

import json
import os
import subprocess

from registry_utils import (
    make_pagination,
    write_json,
    write_schema_version,
    write_versions_list,
    write_latest_alias,
)

API_DIR = "api"

NAMESPACE = "fairtracks"
CONTACT_URL = "https://fairtracks.net"

SCHEMAS = [
    {
        "name": "fga",
        "linkml_schema": os.path.expanduser(
            "~/Dropbox/workspaces/intervals/repos/fga-qg/src/schema/top_level.yaml"
        ),
        "versions": [{"tag": "0.1.0", "status": "current"}],
        "maintainers": ["FAIRtracks"],
        "maturity_level": "draft",
    },
]


def linkml_to_components(linkml_path):
    """Run gen-json-schema on a LinkML schema and split $defs into components.

    Returns (components_dict, bundle_dict).
    """
    print(f"  Running gen-json-schema on {linkml_path}")
    result = subprocess.run(
        ["gen-json-schema", linkml_path],
        capture_output=True,
        text=True,
        check=True,
    )

    bundle = json.loads(result.stdout)
    defs = bundle.get("$defs", {})

    # Split each $def into an individual component
    components = {}
    for name, definition in defs.items():
        # Only include classes (objects) and enums, skip if it's just a type alias
        if not isinstance(definition, dict):
            continue
        components[name] = definition

    print(f"  Extracted {len(components)} components from LinkML schema")
    return components, bundle


def build_fairtracks(api_dir=API_DIR):
    """Build API files for FAIRtracks schemas. Returns namespace info dict."""
    schema_records = []

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

            components, bundle = linkml_to_components(schema_cfg["linkml_schema"])

            if not components:
                print(f"  WARNING: No components found for {schema_name} @ {tag}")
                continue

            # Set a proper $id on the bundle
            bundle_id = f"https://w3id.org/fairtracks/schema/{schema_name}/{tag}"
            bundle["$id"] = bundle_id

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
    build_fairtracks()
