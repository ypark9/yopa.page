#!/usr/bin/env python3
"""Validate the small, reviewed Article Atlas expedition catalog."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VALID_REGIONS = {"Agent Grove", "Cloud Highlands", "Engineering Ridge", "Archive Harbor"}
VALID_EVIDENCE = {"production", "local", "documented", "conceptual"}
VALID_STATUSES = {"draft", "published"}
REQUIRED_JOURNEY_FIELDS = {
    "id", "status", "order", "title", "description", "question",
    "completion_title", "estimated_minutes",
}
REQUIRED_STOP_FIELDS = {"id", "region", "evidence", "title", "purpose", "url"}


def scalar(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def parse_catalog(path: Path) -> dict[str, dict]:
    catalog: dict[str, dict] = {}
    journey: dict | None = None
    current_stop: dict[str, str] | None = None
    section = ""
    for raw in path.read_text().splitlines():
        if not raw or raw.lstrip().startswith("#"):
            continue
        top = re.match(r"^([a-z0-9-]+):\s*$", raw)
        if top:
            journey = {"stops": [], "principles": [], "checklist": []}
            catalog[top.group(1)] = journey
            current_stop = None
            section = ""
            continue
        if journey is None:
            continue
        section_match = re.match(r"^  (stops|principles|checklist):\s*$", raw)
        if section_match:
            section = section_match.group(1)
            current_stop = None
            continue
        field = re.match(r"^  ([a-z_]+):\s*(.*)$", raw)
        if field:
            journey[field.group(1)] = scalar(field.group(2))
            section = ""
            continue
        stop_start = re.match(r"^    - id:\s*(.+)$", raw)
        if section == "stops" and stop_start:
            current_stop = {"id": scalar(stop_start.group(1))}
            journey["stops"].append(current_stop)
            continue
        stop_field = re.match(r"^      ([a-z_]+):\s*(.*)$", raw)
        if section == "stops" and current_stop is not None and stop_field:
            current_stop[stop_field.group(1)] = scalar(stop_field.group(2))
            continue
        list_item = re.match(r"^    -\s+(.+)$", raw)
        if section in {"principles", "checklist"} and list_item:
            journey[section].append(scalar(list_item.group(1)))
    return catalog


def expected_source(url: str, language: str) -> Path | None:
    prefix = "/ko/blog/" if language == "ko" else "/blog/"
    if not url.startswith(prefix) or not url.endswith(".html"):
        return None
    slug = url.removeprefix(prefix).removesuffix(".html")
    localized = ROOT / "content" / "blog" / f"{slug}.{language}.md"
    if localized.exists():
        return localized
    legacy_english = ROOT / "content" / "blog" / f"{slug}.md"
    return legacy_english if language == "en" and legacy_english.exists() else localized


def expedition_source(journey_id: str, language: str) -> Path:
    return ROOT / "content" / "expeditions" / f"{journey_id}.{language}.md"


def is_draft(path: Path) -> bool:
    return bool(re.search(r"^draft:\s*true\s*$", path.read_text(), re.MULTILINE))


def validate() -> list[str]:
    errors: list[str] = []
    parsed: dict[str, dict[str, dict]] = {}
    for language in ("en", "ko"):
        path = ROOT / "data" / "expeditions" / f"{language}.yaml"
        catalog = parse_catalog(path)
        parsed[language] = catalog
        if not catalog:
            errors.append(f"{path}: no journeys found")
        seen_orders: set[str] = set()
        for key, journey in catalog.items():
            missing = REQUIRED_JOURNEY_FIELDS - journey.keys()
            if missing:
                errors.append(f"{path}: {key} is missing {sorted(missing)}")
                continue
            if journey["id"] != key:
                errors.append(f"{path}: key {key!r} does not match id {journey['id']!r}")
            if journey["status"] not in VALID_STATUSES:
                errors.append(f"{path}: {key} has unsupported status {journey['status']!r}")
            if journey["order"] in seen_orders:
                errors.append(f"{path}: duplicate journey order {journey['order']}")
            seen_orders.add(journey["order"])
            stops = journey["stops"]
            if not 4 <= len(stops) <= 6:
                errors.append(f"{path}: {key} expected 4-6 stops, found {len(stops)}")
            seen_stops: set[str] = set()
            for stop in stops:
                missing_stop = REQUIRED_STOP_FIELDS - stop.keys()
                if missing_stop:
                    errors.append(f"{path}: {key} stop is missing {sorted(missing_stop)}")
                    continue
                if stop["id"] in seen_stops:
                    errors.append(f"{path}: {key} has duplicate stop id {stop['id']}")
                seen_stops.add(stop["id"])
                if stop["region"] not in VALID_REGIONS:
                    errors.append(f"{path}: unsupported region {stop['region']}")
                if stop["evidence"] not in VALID_EVIDENCE:
                    errors.append(f"{path}: unsupported evidence {stop['evidence']}")
                source = expected_source(stop["url"], language)
                if source is None or not source.exists():
                    errors.append(f"{path}: broken content URL {stop['url']}")
            page = expedition_source(key, language)
            if not page.exists():
                errors.append(f"{path}: missing expedition page {page}")
            elif (journey["status"] == "draft") != is_draft(page):
                errors.append(f"{path}: {key} status and page draft flag disagree")

    en_ids = list(parsed["en"])
    ko_ids = list(parsed["ko"])
    if en_ids != ko_ids:
        errors.append("English and Korean catalogs must use the same ordered journey IDs")
    for journey_id in set(en_ids) & set(ko_ids):
        en = parsed["en"][journey_id]
        ko = parsed["ko"][journey_id]
        for field in ("id", "status", "order", "estimated_minutes"):
            if en.get(field) != ko.get(field):
                errors.append(f"{journey_id}: English and Korean {field} must match")
        if [stop.get("id") for stop in en["stops"]] != [stop.get("id") for stop in ko["stops"]]:
            errors.append(f"{journey_id}: English and Korean ordered stop IDs must match")
    return errors


def main() -> int:
    errors = validate()
    if errors:
        print("Expedition validation FAILED")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print("Expedition validation PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
