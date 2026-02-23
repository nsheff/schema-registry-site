#!/usr/bin/env python3
"""Build the complete schema registry static API.

Runs each importer, then writes the top-level namespaces index and manifest.
"""

import os
import shutil

from registry_utils import make_pagination, write_json
from import_gks import build_gks
from import_fairtracks import build_fairtracks

API_DIR = "api"
SERVER = "https://nsheff.github.io/schema-registry-site"


def build_all():
    # Clean previous build
    if os.path.exists(API_DIR):
        shutil.rmtree(API_DIR)

    # Run each importer -- each returns a namespace info dict
    namespaces = []
    namespaces.append(build_gks(API_DIR))
    namespaces.append(build_fairtracks(API_DIR))

    # Write top-level namespaces list
    write_json(
        os.path.join(API_DIR, "namespaces", "index.json"),
        {
            "pagination": make_pagination(len(namespaces)),
            "results": [
                {
                    "server": SERVER,
                    "namespace_name": ns["namespace_name"],
                    "contact_url": ns["contact_url"],
                }
                for ns in namespaces
            ],
        },
    )

    # Write service-info (GA4GH Service Info 1.0)
    write_json(
        os.path.join(API_DIR, "service-info"),
        {
            "id": "org.ga4gh.schema-registry.nsheff",
            "name": "GKS Schema Registry",
            "type": {
                "group": "org.ga4gh",
                "artifact": "schema-registry",
                "version": "1.0.0",
            },
            "description": "A static GA4GH Schema Registry serving GKS and FAIRtracks JSON Schemas.",
            "organization": {
                "name": "GA4GH / nsheff",
                "url": "https://github.com/nsheff/schema-registry-site",
            },
            "version": "1.0.0",
            "environment": "production",
        },
    )

    # Write manifest
    manifest_paths = []
    for root, dirs, files in os.walk(API_DIR):
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), API_DIR)
            manifest_paths.append(rel)
    manifest_paths.sort()
    write_json(os.path.join(API_DIR, "manifest.json"), {"paths": manifest_paths})

    print(f"\nBuild complete. Generated {len(manifest_paths)} files in {API_DIR}/")


if __name__ == "__main__":
    build_all()
