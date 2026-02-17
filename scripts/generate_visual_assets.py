#!/usr/bin/env python3
"""Generate visual assets from OpenAI image models using a manifest."""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

import requests
from openai import OpenAI


@dataclass(frozen=True)
class AssetDefinition:
    id: str
    category: str
    output_path: str
    subject_prompt: str
    size: str | None = None
    quality: str | None = None
    background: str | None = None
    output_format: str | None = None


@dataclass(frozen=True)
class ManifestDefinition:
    style_guide_prompt: str
    defaults: dict[str, Any]
    assets: list[AssetDefinition]


def parse_manifest(path: Path) -> ManifestDefinition:
    data = json.loads(path.read_text(encoding="utf-8"))
    style_guide_prompt = str(data.get("style_guide_prompt", "")).strip()
    if not style_guide_prompt:
        raise ValueError("Manifest must include a non-empty style_guide_prompt")

    defaults = data.get("defaults", {})
    if not isinstance(defaults, dict):
        raise ValueError("Manifest defaults must be a JSON object")

    raw_assets = data.get("assets", [])
    if not isinstance(raw_assets, list) or not raw_assets:
        raise ValueError("Manifest must include a non-empty assets list")

    assets: list[AssetDefinition] = []
    seen_ids: set[str] = set()
    for index, raw_asset in enumerate(raw_assets, start=1):
        if not isinstance(raw_asset, dict):
            raise ValueError(f"Asset #{index} must be a JSON object")

        asset_id = str(raw_asset.get("id", "")).strip().lower()
        if not asset_id:
            raise ValueError(f"Asset #{index} is missing id")
        if asset_id in seen_ids:
            raise ValueError(f"Duplicate asset id in manifest: {asset_id}")
        seen_ids.add(asset_id)

        category = str(raw_asset.get("category", "misc")).strip().lower() or "misc"
        output_path = str(raw_asset.get("output_path", "")).strip()
        if not output_path:
            raise ValueError(f"Asset {asset_id} is missing output_path")

        subject_prompt = str(raw_asset.get("subject_prompt", "")).strip()
        if not subject_prompt:
            raise ValueError(f"Asset {asset_id} is missing subject_prompt")

        assets.append(
            AssetDefinition(
                id=asset_id,
                category=category,
                output_path=output_path,
                subject_prompt=subject_prompt,
                size=read_optional_text(raw_asset, "size"),
                quality=read_optional_text(raw_asset, "quality"),
                background=read_optional_text(raw_asset, "background"),
                output_format=read_optional_text(raw_asset, "output_format"),
            )
        )

    return ManifestDefinition(
        style_guide_prompt=style_guide_prompt, defaults=defaults, assets=assets
    )


def read_optional_text(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def normalize_selector_values(values: Sequence[str] | None) -> set[str]:
    normalized: set[str] = set()
    if not values:
        return normalized
    for raw_value in values:
        for part in raw_value.split(","):
            value = part.strip().lower()
            if value:
                normalized.add(value)
    return normalized


def select_assets(
    assets: Sequence[AssetDefinition],
    *,
    all_assets: bool,
    selected_asset_ids: set[str],
    selected_categories: set[str],
) -> list[AssetDefinition]:
    if all_assets:
        return list(assets)

    if not selected_asset_ids and not selected_categories:
        return []

    asset_map = {asset.id: asset for asset in assets}
    missing_ids = sorted(selected_asset_ids - set(asset_map.keys()))
    if missing_ids:
        missing_csv = ", ".join(missing_ids)
        raise ValueError(f"Unknown asset id(s): {missing_csv}")

    selected_ids: set[str] = set(selected_asset_ids)
    if selected_categories:
        for asset in assets:
            if asset.category in selected_categories:
                selected_ids.add(asset.id)

    return [asset for asset in assets if asset.id in selected_ids]


def build_prompt(style_guide_prompt: str, asset: AssetDefinition) -> str:
    return "\n\n".join(
        [
            style_guide_prompt.strip(),
            f"Subject: {asset.subject_prompt.strip()}",
            "Keep composition centered with transparent background and no text.",
        ]
    )


def resolve_output_path(repo_root: Path, output_path: str, variant: str | None) -> Path:
    base_path = Path(output_path)
    if not base_path.is_absolute():
        base_path = repo_root / base_path
    if variant:
        base_path = base_path.with_stem(f"{base_path.stem}__{variant}")
    return base_path


def should_generate(path: Path, force: bool) -> bool:
    return force or not path.exists()


def generate_image_bytes(
    client: OpenAI,
    *,
    model: str,
    prompt: str,
    size: str | None,
    quality: str | None,
    background: str | None,
    output_format: str | None,
) -> tuple[bytes, dict[str, Any]]:
    request_kwargs: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
    }
    if size:
        request_kwargs["size"] = size
    if quality:
        request_kwargs["quality"] = quality
    if background:
        request_kwargs["background"] = background
    if output_format:
        request_kwargs["output_format"] = output_format

    response = client.images.generate(**request_kwargs)
    if not response.data:
        raise RuntimeError("Image API returned no data.")

    image_data = response.data[0]
    b64_data = getattr(image_data, "b64_json", None)
    if b64_data:
        image_bytes = base64.b64decode(b64_data)
    else:
        url = getattr(image_data, "url", None)
        if not url:
            raise RuntimeError("Image API response missing both b64_json and url.")
        http_response = requests.get(url, timeout=60)
        http_response.raise_for_status()
        image_bytes = http_response.content

    metadata = {
        "created": getattr(response, "created", None),
        "model": model,
        "size": size,
        "quality": quality,
        "background": background,
        "output_format": output_format,
    }
    return image_bytes, metadata


def print_assets(assets: Iterable[AssetDefinition]) -> None:
    print("Available assets:")
    for asset in assets:
        print(f"- {asset.id:16s} category={asset.category:10s} output={asset.output_path}")


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate visual assets from OpenAI with a manifest."
    )
    parser.add_argument(
        "--manifest",
        default="scripts/visual_asset_prompts.json",
        help="Path to the asset manifest JSON file.",
    )
    parser.add_argument(
        "--model",
        default="gpt-image-1",
        help="OpenAI image generation model.",
    )
    parser.add_argument(
        "--asset",
        action="append",
        default=[],
        help="Asset id(s) to generate, supports comma-separated values and repeats.",
    )
    parser.add_argument(
        "--category",
        action="append",
        default=[],
        help="Asset category to generate, supports comma-separated values and repeats.",
    )
    parser.add_argument("--all", action="store_true", help="Generate all manifest assets.")
    parser.add_argument("--force", action="store_true", help="Overwrite files that already exist.")
    parser.add_argument(
        "--variant",
        default=None,
        help="Optional suffix to append to output filenames (example: v2).",
    )
    parser.add_argument(
        "--list", action="store_true", help="List available assets from the manifest."
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Print planned actions without API calls."
    )
    parser.add_argument(
        "--show-prompts",
        action="store_true",
        help="Print the final prompt text for each selected asset.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    repo_root = Path(__file__).resolve().parents[1]
    manifest_path = Path(args.manifest)
    if not manifest_path.is_absolute():
        manifest_path = repo_root / manifest_path
    manifest = parse_manifest(manifest_path)

    if args.list:
        print_assets(manifest.assets)
        if not args.all and not args.asset and not args.category:
            return 0

    selected_asset_ids = normalize_selector_values(args.asset)
    selected_categories = normalize_selector_values(args.category)
    selected_assets = select_assets(
        manifest.assets,
        all_assets=args.all,
        selected_asset_ids=selected_asset_ids,
        selected_categories=selected_categories,
    )
    if not selected_assets:
        print("No assets selected. Use --all, --asset, or --category.", file=sys.stderr)
        return 2

    client = None
    if not args.dry_run:
        if not os.getenv("OPENAI_API_KEY"):
            print("Missing OPENAI_API_KEY environment variable.", file=sys.stderr)
            return 2
        client = OpenAI()

    total = len(selected_assets)
    generated = 0
    skipped = 0

    for index, asset in enumerate(selected_assets, start=1):
        output_path = resolve_output_path(repo_root, asset.output_path, args.variant)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if not should_generate(output_path, args.force):
            skipped += 1
            print(f"[{index}/{total}] skip {asset.id} (exists): {output_path}")
            continue

        size = asset.size or manifest.defaults.get("size")
        quality = asset.quality or manifest.defaults.get("quality")
        background = asset.background or manifest.defaults.get("background")
        output_format = asset.output_format or manifest.defaults.get("output_format")
        prompt = build_prompt(manifest.style_guide_prompt, asset)

        print(f"[{index}/{total}] generate {asset.id} -> {output_path}")
        if args.show_prompts:
            print(prompt)
            print("---")

        if args.dry_run:
            generated += 1
            continue

        image_bytes, api_metadata = generate_image_bytes(
            client,
            model=args.model,
            prompt=prompt,
            size=size,
            quality=quality,
            background=background,
            output_format=output_format,
        )
        output_path.write_bytes(image_bytes)

        metadata_path = output_path.with_suffix(f"{output_path.suffix}.meta.json")
        metadata_payload = {
            "asset_id": asset.id,
            "category": asset.category,
            "model": args.model,
            "size": size,
            "quality": quality,
            "background": background,
            "output_format": output_format,
            "prompt": prompt,
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "api": api_metadata,
        }
        metadata_path.write_text(json.dumps(metadata_payload, indent=2), encoding="utf-8")
        generated += 1

    print(
        f"Done. Selected={total} Generated={generated} Skipped={skipped} "
        f"Force={'yes' if args.force else 'no'} DryRun={'yes' if args.dry_run else 'no'}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
