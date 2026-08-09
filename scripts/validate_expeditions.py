#!/usr/bin/env python3
"""Validate the small, reviewed Article Atlas expedition schema."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VALID_REGIONS = {"Agent Grove", "Cloud Highlands", "Engineering Ridge", "Archive Harbor"}
VALID_EVIDENCE = {"production", "local", "documented", "conceptual"}


def parse_stops(path: Path) -> tuple[str, list[dict[str, str]]]:
    journey_id = ""
    stops = []
    current = None
    in_stops = False
    for raw in path.read_text().splitlines():
        if re.match(r"^[^ #].*:\s*$", raw):
            journey_id = raw.split(":", 1)[0]
        if raw == "  stops:":
            in_stops = True
            continue
        if in_stops and re.match(r"^  [a-z_]", raw):
            in_stops = False
        if not in_stops:
            continue
        match = re.match(r"^    - id:\s*(.+)$", raw)
        if match:
            current = {"id": match.group(1).strip()}
            stops.append(current)
            continue
        match = re.match(r"^      ([a-z_]+):\s*(.*)$", raw)
        if match and current is not None:
            current[match.group(1)] = match.group(2).strip()
    return journey_id, stops


def expected_source(url: str, language: str) -> Path | None:
    prefix = "/ko/blog/" if language == "ko" else "/blog/"
    if not url.startswith(prefix) or not url.endswith(".html"):
        return None
    slug = url.removeprefix(prefix).removesuffix(".html")
    return ROOT / "content" / "blog" / f"{slug}.{language}.md"


def validate() -> list[str]:
    errors = []
    parsed = {}
    for language in ("en", "ko"):
        path = ROOT / "data" / "expeditions" / f"{language}.yaml"
        journey_id, stops = parse_stops(path)
        parsed[language] = (journey_id, stops)
        if journey_id != "safe-agent-operations":
            errors.append(f"{path}: unexpected journey id {journey_id!r}")
        if not 4 <= len(stops) <= 6:
            errors.append(f"{path}: expected 4-6 stops, found {len(stops)}")
        seen = set()
        for stop in stops:
            missing = {"id", "region", "evidence", "title", "purpose", "url"} - stop.keys()
            if missing:
                errors.append(f"{path}: stop is missing {sorted(missing)}")
                continue
            if stop["id"] in seen:
                errors.append(f"{path}: duplicate stop id {stop['id']}")
            seen.add(stop["id"])
            if stop["region"] not in VALID_REGIONS:
                errors.append(f"{path}: unsupported region {stop['region']}")
            if stop["evidence"] not in VALID_EVIDENCE:
                errors.append(f"{path}: unsupported evidence {stop['evidence']}")
            source = expected_source(stop["url"], language)
            if source is None or not source.exists():
                errors.append(f"{path}: broken content URL {stop['url']}")
    en_ids = [stop.get("id") for stop in parsed["en"][1]]
    ko_ids = [stop.get("id") for stop in parsed["ko"][1]]
    if en_ids != ko_ids:
        errors.append("English and Korean expeditions must use the same ordered stop IDs")
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
