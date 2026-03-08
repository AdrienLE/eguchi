from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys


def load_module():
    script_path = Path(__file__).resolve().parents[1] / "scripts" / "edit_accessory_layouts.py"
    spec = importlib.util.spec_from_file_location("edit_accessory_layouts", script_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_build_editor_state_uses_reference_accessories(tmp_path: Path):
    module = load_module()
    repo_root = tmp_path
    manifest_path = repo_root / "manifest.json"
    catalog_path = repo_root / "catalog.json"
    layout_path = repo_root / "layout.json"

    write_json(
        manifest_path,
        {
            "assets": [
                {
                    "id": "whale",
                    "category": "animals",
                    "output_path": "frontend/assets/images/eguchi/animals/whale.png",
                },
                {
                    "id": "fox",
                    "category": "animals",
                    "output_path": "frontend/assets/images/eguchi/animals/fox.png",
                }
            ]
        },
    )
    write_json(
        catalog_path,
        {
            "assets": [
                {
                    "id": "top-hat",
                    "placement_category": "headwear",
                    "output_path": "frontend/assets/images/eguchi/accessories/top-hat.png",
                },
                {
                    "id": "round-glasses",
                    "placement_category": "facewear",
                    "output_path": "frontend/assets/images/eguchi/accessories/round-glasses.png",
                },
                {
                    "id": "bow-tie",
                    "placement_category": "neckwear",
                    "output_path": "frontend/assets/images/eguchi/accessories/bow-tie.png",
                },
                {
                    "id": "sparkles",
                    "placement_category": "aura",
                    "output_path": "frontend/assets/images/eguchi/accessories/sparkles.png",
                },
            ]
        },
    )
    write_json(
        layout_path,
        {
            "defaults": {
                "happy": {"headwear": {"anchor_x": 0.5, "anchor_y": 0.2, "width_ratio": 0.4}},
                "sad": {"headwear": {"anchor_x": 0.5, "anchor_y": 0.18, "width_ratio": 0.4}},
            },
            "animals": {},
        },
    )

    state = module.build_editor_state(repo_root, manifest_path, catalog_path, layout_path)
    assert [animal["id"] for animal in state["animals"]] == ["whale", "fox"]
    assert state["animals"][1]["happy_path"].endswith("fox.png")
    assert state["animals"][1]["sad_path"].endswith("fox__sad.png")
    assert state["reference_accessories"]["headwear"]["id"] == "top-hat"
    assert state["reference_accessories"]["facewear"]["id"] == "round-glasses"


def test_update_layout_anchor_persists_override(tmp_path: Path):
    module = load_module()
    layout_path = tmp_path / "layout.json"
    write_json(
        layout_path,
        {
            "defaults": {
                "happy": {"headwear": {"anchor_x": 0.5, "anchor_y": 0.2, "width_ratio": 0.4}},
                "sad": {"headwear": {"anchor_x": 0.5, "anchor_y": 0.18, "width_ratio": 0.4}},
            },
            "animals": {},
        },
    )

    updated = module.update_layout_anchor(
        layout_path,
        animal_id="fox",
        emotion="happy",
        category="headwear",
        anchor={
            "anchor_x": 0.44,
            "anchor_y": 0.16,
            "width_ratio": 0.48,
            "rotation_degrees": 7,
        },
    )

    assert updated["animals"]["fox"]["happy"]["headwear"]["anchor_x"] == 0.44
    reloaded = json.loads(layout_path.read_text(encoding="utf-8"))
    assert reloaded["animals"]["fox"]["happy"]["headwear"]["rotation_degrees"] == 7.0


def test_resolve_safe_path_blocks_escape(tmp_path: Path):
    module = load_module()
    safe = module.resolve_safe_path(tmp_path, "frontend/assets/images/example.png")
    assert safe == (tmp_path / "frontend/assets/images/example.png").resolve()

    try:
        module.resolve_safe_path(tmp_path, "../secret.txt")
    except ValueError as error:
        assert "escapes" in str(error)
    else:
        raise AssertionError("Expected resolve_safe_path to reject escaping paths")


def test_get_next_editor_selection_advances_in_learning_flow():
    module = load_module()
    animals = [{"id": "fox"}, {"id": "whale"}]
    categories = ["headwear", "facewear", "neckwear"]

    assert module.get_next_editor_selection(
        animals,
        categories,
        animal_id="fox",
        emotion="happy",
        category="headwear",
    ) == {"animal_id": "fox", "emotion": "happy", "category": "facewear"}
    assert module.get_next_editor_selection(
        animals,
        categories,
        animal_id="fox",
        emotion="happy",
        category="neckwear",
    ) == {"animal_id": "fox", "emotion": "sad", "category": "headwear"}
    assert module.get_next_editor_selection(
        animals,
        categories,
        animal_id="fox",
        emotion="sad",
        category="neckwear",
    ) == {"animal_id": "whale", "emotion": "happy", "category": "headwear"}
