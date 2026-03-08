from __future__ import annotations

import json
from pathlib import Path


def test_accessory_catalog_contains_creative_accessories():
    catalog_path = (
        Path(__file__).resolve().parents[1] / "scripts" / "eguchi_accessory_sprite_prompts.json"
    )
    payload = json.loads(catalog_path.read_text(encoding="utf-8"))
    accessory_ids = [entry["id"] for entry in payload["assets"]]

    assert len(accessory_ids) >= 20
    assert "sparkles" in accessory_ids
    assert "heart-glasses" in accessory_ids
    assert "wizard-hat" in accessory_ids
    assert "headphones" in accessory_ids


def test_layout_file_covers_happy_and_sad_defaults():
    layout_path = (
        Path(__file__).resolve().parents[1] / "scripts" / "eguchi_accessory_layouts.json"
    )
    payload = json.loads(layout_path.read_text(encoding="utf-8"))

    assert set(payload["defaults"].keys()) == {"happy", "sad"}
    for emotion in ("happy", "sad"):
        assert "headwear" in payload["defaults"][emotion]
        assert "facewear" in payload["defaults"][emotion]
        assert "neckwear" in payload["defaults"][emotion]
        assert "aura" in payload["defaults"][emotion]


def test_facewear_prompts_require_front_facing_symmetry():
    catalog_path = (
        Path(__file__).resolve().parents[1] / "scripts" / "eguchi_accessory_sprite_prompts.json"
    )
    payload = json.loads(catalog_path.read_text(encoding="utf-8"))
    asset_by_id = {entry["id"]: entry for entry in payload["assets"]}

    assert "mirrored" in payload["style_guide_prompt"].lower()
    assert "extending left and one extending right" in asset_by_id["round-glasses"][
        "subject_prompt"
    ].lower()
