#!/usr/bin/env python3
"""Audit Article Atlas raster assets before they are added to the manifest."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError as error:
    raise SystemExit(
        "Pillow is required: run this script with the Codex workspace Python "
        "or install Pillow in your local asset-authoring environment."
    ) from error


def border_alpha_count(image: Image.Image) -> int:
    alpha = image.convert("RGBA").getchannel("A")
    width, height = alpha.size
    pixels = alpha.load()
    return (
        sum(pixels[x, 0] > 0 for x in range(width))
        + sum(pixels[x, height - 1] > 0 for x in range(width))
        + sum(pixels[0, y] > 0 for y in range(height))
        + sum(pixels[width - 1, y] > 0 for y in range(height))
    )


def magenta_count(image: Image.Image) -> int:
    rgba = image.convert("RGBA")
    pixels = (
        rgba.get_flattened_data()
        if hasattr(rgba, "get_flattened_data")
        else rgba.getdata()
    )
    return sum(
        alpha > 0 and red > 180 and blue > 140 and green < 100
        for red, green, blue, alpha in pixels
    )


def audit(root: Path) -> list[str]:
    manifest_path = root / "atlas-manifest.json"
    manifest = json.loads(manifest_path.read_text())
    errors: list[str] = []

    if manifest.get("tileSize") != 512:
        errors.append(f"{manifest_path}: tileSize must be 512")

    sources = {
        entry["src"] for layer in ("base", "top") for entry in manifest["tiles"].get(layer, [])
    }
    sources.update(entry["src"] for entry in manifest.get("objects", []))
    sources.update(source for entry in manifest.get("ambient", []) for source in entry.get("sprites", []))
    sources.update(tile["src"] for chunk in manifest.get("chunks", []) for tile in chunk.get("tiles", []))
    sources.update(entry["src"] for entry in manifest.get("portals", []))

    for source in sorted(sources):
        path = root / source
        if not path.exists():
            errors.append(f"{path}: missing")
            continue
        with Image.open(path) as image:
            if "/tiles/" in path.as_posix() and image.size != (512, 512):
                errors.append(f"{path}: tile is {image.width}x{image.height}, expected 512x512")
            if "/objects/" in path.as_posix() or "/ambient/sprites/" in path.as_posix():
                border_pixels = border_alpha_count(image)
                if border_pixels:
                    errors.append(f"{path}: {border_pixels} nontransparent border pixels")
                magenta_pixels = magenta_count(image)
                if magenta_pixels > 8:
                    errors.append(f"{path}: {magenta_pixels} likely magenta spill pixels")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "root",
        nargs="?",
        type=Path,
        default=Path("static/images/article-atlas/v1"),
        help="directory containing atlas-manifest.json",
    )
    args = parser.parse_args()
    errors = audit(args.root)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"Article Atlas asset audit passed: {args.root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
