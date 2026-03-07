#!/usr/bin/env python3
"""Pre-render accessory overlays onto Eguchi animal assets."""

from __future__ import annotations

import argparse
import concurrent.futures
import importlib.util
import json
import math
import sys
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Iterable, Sequence

from PIL import Image, ImageDraw, ImageFont


def load_visual_asset_module():
    script_path = Path(__file__).resolve().parent / "generate_visual_assets.py"
    spec = importlib.util.spec_from_file_location("generate_visual_assets", script_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module from {script_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


_VISUAL_ASSET_MODULE = load_visual_asset_module()
AssetDefinition = _VISUAL_ASSET_MODULE.AssetDefinition
normalize_selector_values = _VISUAL_ASSET_MODULE.normalize_selector_values
parse_manifest = _VISUAL_ASSET_MODULE.parse_manifest
select_assets = _VISUAL_ASSET_MODULE.select_assets

EMOTIONS = ("happy", "sad")


@dataclass(frozen=True)
class AccessoryDefinition:
    id: str
    label: str
    placement_category: str
    output_path: str
    scale_multiplier: float = 1.0
    offset_x: float = 0.0
    offset_y: float = 0.0
    rotation_degrees: float = 0.0


@dataclass(frozen=True)
class PlacementAnchor:
    anchor_x: float
    anchor_y: float
    width_ratio: float
    rotation_degrees: float = 0.0
    offset_x: float = 0.0
    offset_y: float = 0.0


@dataclass(frozen=True)
class LayoutConfig:
    defaults: dict[str, dict[str, PlacementAnchor]]
    animals: dict[str, dict[str, dict[str, PlacementAnchor]]]


@dataclass(frozen=True)
class RenderTask:
    animal_id: str
    animal_slug: str
    accessory: AccessoryDefinition
    emotion: str
    animal_path: Path
    accessory_path: Path
    output_path: Path


@dataclass(frozen=True)
class RenderResult:
    output_path: Path
    metadata_path: Path
    created: bool


def parse_accessory_catalog(path: Path) -> list[AccessoryDefinition]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    raw_assets = payload.get("assets", [])
    if not isinstance(raw_assets, list) or not raw_assets:
        raise ValueError("Accessory catalog must include a non-empty assets list")

    accessories: list[AccessoryDefinition] = []
    seen_ids: set[str] = set()
    for raw_asset in raw_assets:
        if not isinstance(raw_asset, dict):
            raise ValueError("Each accessory entry must be a JSON object")
        accessory_id = str(raw_asset.get("id", "")).strip().lower()
        if not accessory_id:
            raise ValueError("Accessory entry is missing id")
        if accessory_id in seen_ids:
            raise ValueError(f"Duplicate accessory id: {accessory_id}")
        seen_ids.add(accessory_id)

        placement_category = str(raw_asset.get("placement_category", "")).strip().lower()
        output_path = str(raw_asset.get("output_path", "")).strip()
        if not placement_category:
            raise ValueError(f"Accessory {accessory_id} is missing placement_category")
        if not output_path:
            raise ValueError(f"Accessory {accessory_id} is missing output_path")

        accessories.append(
            AccessoryDefinition(
                id=accessory_id,
                label=str(raw_asset.get("label", accessory_id)).strip() or accessory_id,
                placement_category=placement_category,
                output_path=output_path,
                scale_multiplier=float(raw_asset.get("scale_multiplier", 1.0)),
                offset_x=float(raw_asset.get("offset_x", 0.0)),
                offset_y=float(raw_asset.get("offset_y", 0.0)),
                rotation_degrees=float(raw_asset.get("rotation_degrees", 0.0)),
            )
        )

    return accessories


def parse_anchor(raw_anchor: dict[str, Any], *, fallback: PlacementAnchor | None = None) -> PlacementAnchor:
    if fallback is None:
        return PlacementAnchor(
            anchor_x=float(raw_anchor["anchor_x"]),
            anchor_y=float(raw_anchor["anchor_y"]),
            width_ratio=float(raw_anchor["width_ratio"]),
            rotation_degrees=float(raw_anchor.get("rotation_degrees", 0.0)),
            offset_x=float(raw_anchor.get("offset_x", 0.0)),
            offset_y=float(raw_anchor.get("offset_y", 0.0)),
        )
    return PlacementAnchor(
        anchor_x=float(raw_anchor.get("anchor_x", fallback.anchor_x)),
        anchor_y=float(raw_anchor.get("anchor_y", fallback.anchor_y)),
        width_ratio=float(raw_anchor.get("width_ratio", fallback.width_ratio)),
        rotation_degrees=float(
            raw_anchor.get("rotation_degrees", fallback.rotation_degrees)
        ),
        offset_x=float(raw_anchor.get("offset_x", fallback.offset_x)),
        offset_y=float(raw_anchor.get("offset_y", fallback.offset_y)),
    )


def parse_layout_config(path: Path) -> LayoutConfig:
    payload = json.loads(path.read_text(encoding="utf-8"))
    raw_defaults = payload.get("defaults")
    if not isinstance(raw_defaults, dict) or not raw_defaults:
        raise ValueError("Layout config must include defaults")

    defaults: dict[str, dict[str, PlacementAnchor]] = {}
    for emotion, raw_categories in raw_defaults.items():
        if emotion not in EMOTIONS:
            raise ValueError(f"Unknown emotion in defaults: {emotion}")
        if not isinstance(raw_categories, dict) or not raw_categories:
            raise ValueError(f"Layout defaults for {emotion} must be a JSON object")
        defaults[emotion] = {
            category: parse_anchor(anchor_payload)
            for category, anchor_payload in raw_categories.items()
        }

    animals: dict[str, dict[str, dict[str, PlacementAnchor]]] = {}
    raw_animals = payload.get("animals", {})
    if raw_animals and not isinstance(raw_animals, dict):
        raise ValueError("Layout animals must be a JSON object")

    for animal_id, raw_emotions in raw_animals.items():
        if not isinstance(raw_emotions, dict):
            raise ValueError(f"Layout entry for animal {animal_id} must be an object")
        animal_emotions: dict[str, dict[str, PlacementAnchor]] = {}
        for emotion, raw_categories in raw_emotions.items():
            if emotion not in EMOTIONS:
                raise ValueError(f"Unknown emotion for animal {animal_id}: {emotion}")
            if not isinstance(raw_categories, dict):
                raise ValueError(
                    f"Layout entry for animal {animal_id} / {emotion} must be an object"
                )
            category_overrides: dict[str, PlacementAnchor] = {}
            for category, anchor_payload in raw_categories.items():
                fallback = defaults.get(emotion, {}).get(category)
                if fallback is None:
                    raise ValueError(
                        f"Animal {animal_id} / {emotion} references unknown category {category}"
                    )
                category_overrides[category] = parse_anchor(anchor_payload, fallback=fallback)
            animal_emotions[emotion] = category_overrides
        animals[str(animal_id)] = animal_emotions

    return LayoutConfig(defaults=defaults, animals=animals)


def select_animals(manifest_path: Path, raw_animals: Sequence[str], *, all_animals: bool) -> list[AssetDefinition]:
    manifest = parse_manifest(manifest_path)
    return select_assets(
        manifest.assets,
        all_assets=all_animals,
        selected_asset_ids=normalize_selector_values(raw_animals),
        selected_categories={"animals"} if all_animals else set(),
    )


def select_accessories(
    catalog: Sequence[AccessoryDefinition], raw_accessories: Sequence[str], *, all_accessories: bool
) -> list[AccessoryDefinition]:
    if all_accessories:
        return list(catalog)
    selected_ids = normalize_selector_values(raw_accessories)
    if not selected_ids:
        return []
    accessory_map = {accessory.id: accessory for accessory in catalog}
    unknown_ids = sorted(selected_ids - set(accessory_map.keys()))
    if unknown_ids:
        raise ValueError(f"Unknown accessory id(s): {', '.join(unknown_ids)}")
    return [accessory for accessory in catalog if accessory.id in selected_ids]


def resolve_anchor(
    layout: LayoutConfig,
    *,
    animal_id: str,
    emotion: str,
    category: str,
    accessory: AccessoryDefinition,
) -> PlacementAnchor:
    base = layout.defaults[emotion][category]
    override = layout.animals.get(animal_id, {}).get(emotion, {}).get(category)
    anchor = override if override is not None else base
    return replace(
        anchor,
        rotation_degrees=anchor.rotation_degrees + accessory.rotation_degrees,
        offset_x=anchor.offset_x + accessory.offset_x,
        offset_y=anchor.offset_y + accessory.offset_y,
        width_ratio=anchor.width_ratio * accessory.scale_multiplier,
    )


def resolve_animal_path(repo_root: Path, asset: AssetDefinition, emotion: str) -> Path:
    stem = Path(asset.output_path)
    filename = stem.name
    if emotion == "sad":
        filename = f"{stem.stem}__sad{stem.suffix}"
    return repo_root / stem.parent / filename


def resolve_output_path(repo_root: Path, asset: AssetDefinition, accessory: AccessoryDefinition, emotion: str) -> Path:
    base_path = repo_root / Path(asset.output_path)
    suffix = f"__{accessory.id}" if emotion == "happy" else f"__sad__{accessory.id}"
    return base_path.with_name(f"{base_path.stem}{suffix}{base_path.suffix}")


def should_render(path: Path, *, force: bool, only_missing: bool) -> bool:
    if force:
        return True
    if only_missing:
        return not path.exists()
    return True


def build_render_tasks(
    repo_root: Path,
    animals: Sequence[AssetDefinition],
    accessories: Sequence[AccessoryDefinition],
    emotions: Sequence[str],
    *,
    force: bool,
    only_missing: bool,
) -> list[RenderTask]:
    tasks: list[RenderTask] = []
    for animal in animals:
        for accessory in accessories:
            accessory_path = repo_root / accessory.output_path
            for emotion in emotions:
                output_path = resolve_output_path(repo_root, animal, accessory, emotion)
                if not should_render(output_path, force=force, only_missing=only_missing):
                    continue
                tasks.append(
                    RenderTask(
                        animal_id=animal.id,
                        animal_slug=Path(animal.output_path).stem,
                        accessory=accessory,
                        emotion=emotion,
                        animal_path=resolve_animal_path(repo_root, animal, emotion),
                        accessory_path=accessory_path,
                        output_path=output_path,
                    )
                )
    return tasks


def apply_accessory_overlay(
    base_image: Image.Image,
    accessory_image: Image.Image,
    anchor: PlacementAnchor,
    *,
    debug_anchors: bool,
) -> Image.Image:
    composed = base_image.convert("RGBA")
    sprite = accessory_image.convert("RGBA")

    target_width = max(1, int(round(composed.width * anchor.width_ratio)))
    scale = target_width / max(1, sprite.width)
    target_height = max(1, int(round(sprite.height * scale)))
    sprite = sprite.resize((target_width, target_height), Image.Resampling.LANCZOS)

    if anchor.rotation_degrees:
        sprite = sprite.rotate(anchor.rotation_degrees, resample=Image.Resampling.BICUBIC, expand=True)

    center_x = (anchor.anchor_x + anchor.offset_x) * composed.width
    center_y = (anchor.anchor_y + anchor.offset_y) * composed.height
    paste_x = int(round(center_x - sprite.width / 2))
    paste_y = int(round(center_y - sprite.height / 2))
    composed.alpha_composite(sprite, dest=(paste_x, paste_y))

    if debug_anchors:
        draw = ImageDraw.Draw(composed)
        box_left = int(round(center_x - target_width / 2))
        box_top = int(round(center_y - target_height / 2))
        box_right = int(round(center_x + target_width / 2))
        box_bottom = int(round(center_y + target_height / 2))
        draw.rectangle((box_left, box_top, box_right, box_bottom), outline=(255, 0, 128, 255), width=4)
        draw.line((center_x - 18, center_y, center_x + 18, center_y), fill=(0, 255, 255, 255), width=4)
        draw.line((center_x, center_y - 18, center_x, center_y + 18), fill=(0, 255, 255, 255), width=4)

    return composed


def metadata_path_for(image_path: Path) -> Path:
    return image_path.with_name(f"{image_path.name}.meta.json")


def render_task(task: RenderTask, layout: LayoutConfig, *, debug_anchors: bool) -> RenderResult:
    if not task.animal_path.exists():
        raise FileNotFoundError(f"Missing animal image: {task.animal_path}")
    if not task.accessory_path.exists():
        raise FileNotFoundError(f"Missing accessory sprite: {task.accessory_path}")

    anchor = resolve_anchor(
        layout,
        animal_id=task.animal_id,
        emotion=task.emotion,
        category=task.accessory.placement_category,
        accessory=task.accessory,
    )

    with Image.open(task.animal_path) as animal_image, Image.open(task.accessory_path) as accessory_image:
        rendered = apply_accessory_overlay(
            animal_image,
            accessory_image,
            anchor,
            debug_anchors=debug_anchors,
        )
        task.output_path.parent.mkdir(parents=True, exist_ok=True)
        rendered.save(task.output_path)

    metadata = {
        "animal_id": task.animal_id,
        "emotion": task.emotion,
        "accessory_id": task.accessory.id,
        "placement_category": task.accessory.placement_category,
        "animal_path": task.animal_path.as_posix(),
        "accessory_path": task.accessory_path.as_posix(),
        "anchor": {
            "anchor_x": anchor.anchor_x,
            "anchor_y": anchor.anchor_y,
            "width_ratio": anchor.width_ratio,
            "rotation_degrees": anchor.rotation_degrees,
            "offset_x": anchor.offset_x,
            "offset_y": anchor.offset_y,
        },
        "debug_anchors": debug_anchors,
    }
    metadata_path = metadata_path_for(task.output_path)
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    return RenderResult(output_path=task.output_path, metadata_path=metadata_path, created=True)


def make_contact_sheet(images: Sequence[Path], output_path: Path) -> None:
    if not images:
        return
    font = ImageFont.load_default()
    opened: list[tuple[str, Image.Image]] = []
    try:
        for image_path in images:
            opened.append((image_path.stem, Image.open(image_path).convert("RGBA")))

        tile_width = max(image.width for _, image in opened)
        tile_height = max(image.height for _, image in opened)
        label_height = 26
        columns = min(4, max(1, int(math.ceil(math.sqrt(len(opened))))))
        rows = int(math.ceil(len(opened) / columns))
        sheet = Image.new(
            "RGBA",
            (columns * tile_width, rows * (tile_height + label_height)),
            (18, 18, 24, 255),
        )

        draw = ImageDraw.Draw(sheet)
        for index, (label, image) in enumerate(opened):
            row = index // columns
            column = index % columns
            x = column * tile_width
            y = row * (tile_height + label_height)
            sheet.alpha_composite(image, dest=(x, y))
            draw.text((x + 8, y + tile_height + 4), label, fill=(255, 255, 255, 255), font=font)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(output_path)
    finally:
        for _, image in opened:
            image.close()


def print_assets(title: str, items: Iterable[str]) -> None:
    print(title)
    for item in items:
        print(f"- {item}")


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render Eguchi animal accessory combinations from base animals and accessory sprites."
    )
    parser.add_argument(
        "--manifest",
        default="scripts/visual_asset_prompts.json",
        help="Path to the base visual asset manifest JSON file.",
    )
    parser.add_argument(
        "--accessory-catalog",
        default="scripts/eguchi_accessory_sprite_prompts.json",
        help="Path to the accessory sprite manifest JSON file.",
    )
    parser.add_argument(
        "--layout",
        default="scripts/eguchi_accessory_layouts.json",
        help="Path to the accessory placement layout JSON file.",
    )
    parser.add_argument("--animal", action="append", default=[], help="Animal id(s) to render.")
    parser.add_argument(
        "--all-animals",
        action="store_true",
        help="Render all animals from the manifest.",
    )
    parser.add_argument(
        "--accessory",
        action="append",
        default=[],
        help="Accessory id(s) to render.",
    )
    parser.add_argument(
        "--all-accessories",
        action="store_true",
        help="Render all accessory ids from the catalog.",
    )
    parser.add_argument(
        "--emotion",
        action="append",
        choices=list(EMOTIONS),
        default=[],
        help="Emotion(s) to render. Defaults to happy and sad.",
    )
    parser.add_argument("--only-missing", action="store_true", help="Skip outputs that already exist.")
    parser.add_argument("--force", action="store_true", help="Overwrite outputs even when they exist.")
    parser.add_argument("--workers", type=int, default=4, help="Number of render workers to use.")
    parser.add_argument(
        "--debug-anchors",
        action="store_true",
        help="Draw anchor boxes and centers on rendered outputs.",
    )
    parser.add_argument(
        "--contact-sheet",
        help="Optional output path for a debug contact sheet of rendered images.",
    )
    parser.add_argument("--list-animals", action="store_true", help="Print available animal ids and exit.")
    parser.add_argument(
        "--list-accessories", action="store_true", help="Print available accessory ids and exit."
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or [])
    repo_root = Path(__file__).resolve().parents[1]
    manifest_path = (repo_root / args.manifest).resolve()
    accessory_catalog_path = (repo_root / args.accessory_catalog).resolve()
    layout_path = (repo_root / args.layout).resolve()

    manifest = parse_manifest(manifest_path)
    accessories = parse_accessory_catalog(accessory_catalog_path)

    if args.list_animals:
        animal_ids = [asset.id for asset in manifest.assets if asset.category == "animals"]
        print_assets("Available animals:", animal_ids)
        return 0
    if args.list_accessories:
        print_assets("Available accessories:", [accessory.id for accessory in accessories])
        return 0

    animals = select_assets(
        manifest.assets,
        all_assets=args.all_animals,
        selected_asset_ids=normalize_selector_values(args.animal),
        selected_categories={"animals"} if args.all_animals else set(),
    )
    animals = [asset for asset in animals if asset.category == "animals"]
    if not animals:
        raise SystemExit("No animals selected. Use --all-animals or --animal.")

    selected_accessories = select_accessories(
        accessories, args.accessory, all_accessories=args.all_accessories
    )
    if not selected_accessories:
        raise SystemExit("No accessories selected. Use --all-accessories or --accessory.")

    emotions = args.emotion or list(EMOTIONS)
    layout = parse_layout_config(layout_path)
    tasks = build_render_tasks(
        repo_root,
        animals,
        selected_accessories,
        emotions,
        force=args.force,
        only_missing=args.only_missing,
    )
    if not tasks:
        print("No render tasks to run.")
        return 0

    print(f"Rendering {len(tasks)} accessory overlays...")
    results: list[RenderResult] = []
    max_workers = max(1, int(args.workers))
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(render_task, task, layout, debug_anchors=args.debug_anchors): task
            for task in tasks
        }
        completed = 0
        for future in concurrent.futures.as_completed(future_map):
            task = future_map[future]
            result = future.result()
            results.append(result)
            completed += 1
            print(
                f"[{completed}/{len(tasks)}] {task.animal_id} {task.emotion} {task.accessory.id} -> {result.output_path.name}"
            )

    if args.contact_sheet:
        contact_sheet_path = Path(args.contact_sheet)
        if not contact_sheet_path.is_absolute():
            contact_sheet_path = repo_root / contact_sheet_path
        make_contact_sheet([result.output_path for result in results], contact_sheet_path)
        print(f"Contact sheet written to {contact_sheet_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
