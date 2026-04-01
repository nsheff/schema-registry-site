#!/usr/bin/env python3
"""Generate LinkML metadata (classes, slots, enums) from raw YAML schema files.

Called by import_fairtracks after cloning the repo. Writes metadata JSON files
alongside the JSON Schema components so the frontend can render richer views.
"""

import json
import os

import yaml


def load_all_schemas(schema_dir):
    """Load all YAML schema files and merge into a unified model."""
    classes = {}
    slots = {}
    enums = {}

    for fname in sorted(os.listdir(schema_dir)):
        if not fname.endswith(".yaml"):
            continue
        with open(os.path.join(schema_dir, fname)) as f:
            data = yaml.safe_load(f)
        if not data:
            continue

        module_name = fname[:-5]  # strip .yaml

        for name, cls_def in (data.get("classes") or {}).items():
            cls_def = cls_def or {}
            cls_def["_source_file"] = module_name
            classes[name] = cls_def

        for name, slot_def in (data.get("slots") or {}).items():
            slot_def = slot_def or {}
            slot_def["_source_file"] = module_name
            slots[name] = slot_def

        for name, enum_def in (data.get("enums") or {}).items():
            enum_def = enum_def or {}
            enum_def["_source_file"] = module_name
            enums[name] = enum_def

    return classes, slots, enums


def resolve_class_slots(cls_name, classes, slots):
    """Get all slots for a class, including inherited ones."""
    cls_def = classes.get(cls_name, {})
    result = {}

    parent = cls_def.get("is_a")
    if parent and parent in classes:
        result.update(resolve_class_slots(parent, classes, slots))

    for mixin in cls_def.get("mixins", []):
        if mixin in classes:
            result.update(resolve_class_slots(mixin, classes, slots))

    for slot_name in cls_def.get("slots", []):
        slot_def = dict(slots.get(slot_name, {}))
        usage = (cls_def.get("slot_usage") or {}).get(slot_name, {})
        if usage:
            slot_def.update(usage)
        slot_def["_slot_name"] = slot_name
        result[slot_name] = slot_def

    for attr_name, attr_def in (cls_def.get("attributes") or {}).items():
        attr_def = attr_def or {}
        attr_def["_slot_name"] = attr_name
        result[attr_name] = attr_def

    return result


def build_linkml_metadata(schema_dir, output_dir):
    """Parse LinkML YAML and write metadata JSON files.

    Output structure:
        output_dir/
            linkml.json          (summary: class/slot/enum counts)
            classes/index.json   (class list)
            classes/{Name}.json  (class detail)
            enums/index.json     (enum list)
            enums/{Name}.json    (enum detail)
    """
    classes, slots, enums = load_all_schemas(schema_dir)

    # Build class records
    class_records = {}
    for cls_name, cls_def in classes.items():
        resolved = resolve_class_slots(cls_name, classes, slots)
        properties = []
        references = set()

        for slot_name, slot_def in resolved.items():
            range_type = slot_def.get("range", "string")
            if range_type in classes:
                rt = "class"
                references.add(range_type)
            elif range_type in enums:
                rt = "enum"
                references.add(range_type)
            else:
                rt = "type"

            prop = {
                "name": slot_name,
                "description": slot_def.get("description", ""),
                "range": range_type,
                "range_type": rt,
                "required": slot_def.get("required", False),
                "multivalued": slot_def.get("multivalued", False),
                "identifier": slot_def.get("identifier", False),
            }
            prop = {k: v for k, v in prop.items() if v}  # drop falsy
            prop["name"] = slot_name  # always keep name
            properties.append(prop)

        properties.sort(key=lambda p: (not p.get("required", False), p["name"]))

        record = {
            "name": cls_name,
            "description": cls_def.get("description", ""),
            "source_file": cls_def.get("_source_file", ""),
            "is_a": cls_def.get("is_a"),
            "mixins": cls_def.get("mixins", []),
            "properties": properties,
            "references": sorted(references),
        }
        if cls_def.get("rules"):
            record["rules"] = cls_def["rules"]
        class_records[cls_name] = {k: v for k, v in record.items() if v is not None}

    # Compute "referenced_by" (inverse of references)
    for cls_name, record in class_records.items():
        referenced_by = []
        for other_name, other_record in class_records.items():
            if other_name == cls_name:
                continue
            if cls_name in other_record.get("references", []):
                referenced_by.append(other_name)
        if referenced_by:
            record["referenced_by"] = sorted(referenced_by)

    # Build enum records
    enum_records = {}
    for enum_name, enum_def in enums.items():
        values = []
        for pv_name, pv_def in (enum_def.get("permissible_values") or {}).items():
            pv_def = pv_def or {}
            values.append({
                "name": pv_name,
                "description": pv_def.get("description", ""),
                "meaning": pv_def.get("meaning"),
            })
        enum_records[enum_name] = {
            "name": enum_name,
            "description": enum_def.get("description", ""),
            "source_file": enum_def.get("_source_file", ""),
            "values": values,
        }

    # Write files
    _write(os.path.join(output_dir, "linkml.json"), {
        "has_linkml": True,
        "class_count": len(class_records),
        "enum_count": len(enum_records),
    })

    # Classes
    class_summary = [
        {
            "name": r["name"],
            "description": r.get("description", ""),
            "source_file": r.get("source_file", ""),
            "property_count": len(r["properties"]),
            "is_a": r.get("is_a"),
        }
        for r in class_records.values()
    ]
    _write(os.path.join(output_dir, "classes", "index.json"), class_summary)
    for cls_name, record in class_records.items():
        _write(os.path.join(output_dir, "classes", f"{cls_name}.json"), record)

    # Enums
    enum_summary = [
        {
            "name": r["name"],
            "description": r.get("description", ""),
            "source_file": r.get("source_file", ""),
            "value_count": len(r["values"]),
        }
        for r in enum_records.values()
    ]
    _write(os.path.join(output_dir, "enums", "index.json"), enum_summary)
    for enum_name, record in enum_records.items():
        _write(os.path.join(output_dir, "enums", f"{enum_name}.json"), record)

    print(f"  LinkML metadata: {len(class_records)} classes, {len(enum_records)} enums")


def _write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)
