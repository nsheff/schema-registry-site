"""Shared utilities for schema registry build scripts."""

import json
import os


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


def extract_component_record(name, component):
    """Extract a ComponentRecord from a JSON Schema component."""
    return {
        "component_name": name,
        "schema_id": component.get("$id", ""),
        "description": component.get("description", ""),
    }


def write_schema_version(namespace, schema_name, tag, components, bundle, api_dir):
    """Write API files for one schema+version: bundle, components, components list."""
    ver_dir = os.path.join(api_dir, "schemas", namespace, schema_name, "versions", tag)

    # Bundle
    write_json(os.path.join(ver_dir, "index.json"), bundle)

    # Individual components
    comp_dir = os.path.join(ver_dir, "components")
    component_records = []
    for name, component in sorted(components.items()):
        write_json(os.path.join(comp_dir, name, "index.json"), component)
        component_records.append(extract_component_record(name, component))

    # Components list
    write_json(
        os.path.join(comp_dir, "index.json"),
        {
            "pagination": make_pagination(len(component_records)),
            "results": component_records,
        },
    )


def write_versions_list(namespace, schema_name, version_records, api_dir):
    """Write the versions index for a schema."""
    write_json(
        os.path.join(api_dir, "schemas", namespace, schema_name, "versions", "index.json"),
        {
            "pagination": make_pagination(len(version_records)),
            "results": version_records,
        },
    )


def write_latest_alias(namespace, schema_name, latest_version, api_dir):
    """Copy the latest version directory as a 'latest' alias."""
    import shutil

    latest_src = os.path.join(api_dir, "schemas", namespace, schema_name, "versions", latest_version)
    latest_dst = os.path.join(api_dir, "schemas", namespace, schema_name, "versions", "latest")
    if os.path.isdir(latest_src):
        if os.path.exists(latest_dst):
            shutil.rmtree(latest_dst)
        shutil.copytree(latest_src, latest_dst)
