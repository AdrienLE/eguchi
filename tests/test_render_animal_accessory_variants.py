from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys

from PIL import Image
import pytest


def load_module():
    script_path = (
        Path(__file__).resolve().parents[1] / "scripts" / "render_animal_accessory_variants.py"
    )
    spec = importlib.util.spec_from_file_location("render_animal_accessory_variants", script_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload), encoding="utf-8")


@pytest.fixture
def temp_repo(tmp_path: Path) -> Path:
    (tmp_path / "scripts").mkdir(parents=True, exist_ok=True)
    (tmp_path / "frontend" / "assets" / "images" / "eguchi" / "animals").mkdir(
        parents=True, exist_ok=True
    )
    (tmp_path / "frontend" / "assets" / "images" / "eguchi" / "accessories").mkdir(
        parents=True, exist_ok=True
    )
    return tmp_path


def make_manifest(path: Path) -> None:
    write_json(
        path,
        {
            "style_guide_prompt": "style",
            "defaults": {"output_format": "png"},
            "assets": [
                {
                    "id": "fox",
                    "category": "animals",
                    "output_path": "frontend/assets/images/eguchi/animals/fox.png",
                    "subject_prompt": "Fox mascot",
                }
            ],
        },
    )


def make_catalog(path: Path) -> None:
    write_json(
        path,
        {
            "style_guide_prompt": "style",
            "defaults": {"output_format": "png"},
            "assets": [
                {
                    "id": "top-hat",
                    "category": "accessories",
                    "placement_category": "headwear",
                    "output_path": "frontend/assets/images/eguchi/accessories/top-hat.png",
                    "subject_prompt": "Top hat sprite",
                    "scale_multiplier": 1.0,
                },
                {
                    "id": "sparkles",
                    "category": "accessories",
                    "placement_category": "aura",
                    "output_path": "frontend/assets/images/eguchi/accessories/sparkles.png",
                    "subject_prompt": "Sparkle sprite",
                    "scale_multiplier": 1.0,
                    "offset_y": -0.05,
                },
            ],
        },
    )


def make_layout(path: Path) -> None:
    write_json(
        path,
        {
            "defaults": {
                "happy": {
                    "headwear": {"anchor_x": 0.5, "anchor_y": 0.2, "width_ratio": 0.4},
                    "aura": {"anchor_x": 0.5, "anchor_y": 0.3, "width_ratio": 0.7},
                },
                "sad": {
                    "headwear": {"anchor_x": 0.5, "anchor_y": 0.18, "width_ratio": 0.4},
                    "aura": {"anchor_x": 0.5, "anchor_y": 0.28, "width_ratio": 0.7},
                },
            },
            "animals": {
                "fox": {
                    "happy": {
                        "headwear": {"anchor_y": 0.16, "width_ratio": 0.46},
                    }
                }
            },
        },
    )


def create_demo_images(repo_root: Path) -> None:
    base_dir = repo_root / "frontend" / "assets" / "images" / "eguchi"
    with Image.new("RGBA", (200, 200), (255, 240, 200, 255)) as image:
        image.save(base_dir / "animals" / "fox.png")
    with Image.new("RGBA", (200, 200), (220, 220, 255, 255)) as image:
        image.save(base_dir / "animals" / "fox__sad.png")
    with Image.new("RGBA", (100, 60), (20, 20, 20, 255)) as image:
        image.save(base_dir / "accessories" / "top-hat.png")
    with Image.new("RGBA", (120, 120), (255, 255, 255, 0)) as image:
        for x in range(10, 110, 25):
            for y in range(10, 110, 25):
                image.putpixel((x, y), (255, 0, 255, 255))
        image.save(base_dir / "accessories" / "sparkles.png")


def test_parse_accessory_catalog_reads_extra_metadata(temp_repo: Path):
    module = load_module()
    catalog_path = temp_repo / "scripts" / "accessories.json"
    make_catalog(catalog_path)

    catalog = module.parse_accessory_catalog(catalog_path)
    assert [accessory.id for accessory in catalog] == ["top-hat", "sparkles"]
    assert catalog[1].placement_category == "aura"
    assert catalog[1].offset_y == -0.05


def test_parse_layout_config_merges_defaults_and_overrides(temp_repo: Path):
    module = load_module()
    layout_path = temp_repo / "scripts" / "layouts.json"
    make_layout(layout_path)
    layout = module.parse_layout_config(layout_path)

    anchor = module.resolve_anchor(
        layout,
        animal_id="fox",
        emotion="happy",
        category="headwear",
        accessory=module.AccessoryDefinition(
            id="top-hat",
            label="Top Hat",
            placement_category="headwear",
            output_path="unused.png",
        ),
    )
    assert anchor.anchor_y == pytest.approx(0.16)
    assert anchor.width_ratio == pytest.approx(0.46)


def test_build_render_tasks_uses_happy_and_sad_output_names(temp_repo: Path):
    module = load_module()
    manifest_path = temp_repo / "scripts" / "visual_asset_prompts.json"
    make_manifest(manifest_path)
    catalog_path = temp_repo / "scripts" / "accessories.json"
    make_catalog(catalog_path)
    manifest = module.parse_manifest(manifest_path)
    catalog = module.parse_accessory_catalog(catalog_path)

    tasks = module.build_render_tasks(
        temp_repo,
        manifest.assets,
        catalog[:1],
        ["happy", "sad"],
        force=False,
        only_missing=True,
    )
    assert [task.output_path.name for task in tasks] == [
        "fox__top-hat.png",
        "fox__sad__top-hat.png",
    ]


def test_render_task_creates_variant_and_metadata(temp_repo: Path):
    module = load_module()
    manifest_path = temp_repo / "scripts" / "visual_asset_prompts.json"
    make_manifest(manifest_path)
    catalog_path = temp_repo / "scripts" / "accessories.json"
    make_catalog(catalog_path)
    layout_path = temp_repo / "scripts" / "layouts.json"
    make_layout(layout_path)
    create_demo_images(temp_repo)

    manifest = module.parse_manifest(manifest_path)
    accessory = module.parse_accessory_catalog(catalog_path)[0]
    layout = module.parse_layout_config(layout_path)
    task = module.build_render_tasks(
        temp_repo,
        manifest.assets,
        [accessory],
        ["happy"],
        force=False,
        only_missing=True,
    )[0]

    result = module.render_task(task, layout, debug_anchors=False)
    assert result.output_path.exists()
    assert result.metadata_path.exists()
    payload = json.loads(result.metadata_path.read_text(encoding="utf-8"))
    assert payload["accessory_id"] == "top-hat"
    assert payload["anchor"]["anchor_y"] == pytest.approx(0.16)


def test_make_contact_sheet_writes_output(temp_repo: Path):
    module = load_module()
    first = temp_repo / "a.png"
    second = temp_repo / "b.png"
    with Image.new("RGBA", (40, 40), (255, 0, 0, 255)) as image:
        image.save(first)
    with Image.new("RGBA", (40, 40), (0, 0, 255, 255)) as image:
        image.save(second)

    output = temp_repo / "sheet.png"
    module.make_contact_sheet([first, second], output)
    assert output.exists()
