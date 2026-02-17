from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys

import pytest


def load_module():
    script_path = Path(__file__).resolve().parents[1] / "scripts" / "generate_visual_assets.py"
    spec = importlib.util.spec_from_file_location("generate_visual_assets", script_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_parse_manifest_loads_repo_manifest():
    module = load_module()
    manifest_path = Path(__file__).resolve().parents[1] / "scripts" / "visual_asset_prompts.json"
    manifest = module.parse_manifest(manifest_path)

    assert manifest.style_guide_prompt
    assert manifest.defaults["output_format"] == "png"
    assert len(manifest.assets) >= 14
    assert any(asset.id == "fox" for asset in manifest.assets)


def test_select_assets_supports_ids_and_categories():
    module = load_module()
    manifest_path = Path(__file__).resolve().parents[1] / "scripts" / "visual_asset_prompts.json"
    manifest = module.parse_manifest(manifest_path)

    selected = module.select_assets(
        manifest.assets,
        all_assets=False,
        selected_asset_ids={"fox"},
        selected_categories={"ui"},
    )
    selected_ids = {asset.id for asset in selected}
    assert "fox" in selected_ids
    assert "caregiver-gear" in selected_ids


def test_select_assets_rejects_unknown_id():
    module = load_module()
    manifest_path = Path(__file__).resolve().parents[1] / "scripts" / "visual_asset_prompts.json"
    manifest = module.parse_manifest(manifest_path)

    with pytest.raises(ValueError, match="Unknown asset id"):
        module.select_assets(
            manifest.assets,
            all_assets=False,
            selected_asset_ids={"missing-id"},
            selected_categories=set(),
        )


def test_resolve_output_path_and_force_behavior(tmp_path: Path):
    module = load_module()

    output = module.resolve_output_path(tmp_path, "frontend/assets/images/fox.png", "v2")
    assert output.name == "fox__v2.png"
    assert not output.exists()
    assert module.should_generate(output, force=False)

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(b"existing")
    assert not module.should_generate(output, force=False)
    assert module.should_generate(output, force=True)


def test_build_prompt_contains_style_and_subject():
    module = load_module()
    manifest_payload = {
        "style_guide_prompt": "Base style",
        "defaults": {},
        "assets": [
            {
                "id": "test-animal",
                "category": "animals",
                "output_path": "frontend/assets/images/test-animal.png",
                "subject_prompt": "A smiling animal.",
            }
        ],
    }
    manifest_path = Path(__file__).resolve().parents[1] / "tests" / "_tmp_visual_manifest.json"
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    try:
        manifest = module.parse_manifest(manifest_path)
        prompt = module.build_prompt(manifest.style_guide_prompt, manifest.assets[0])
        assert "Base style" in prompt
        assert "A smiling animal." in prompt
        assert "no text" in prompt.lower()
    finally:
        manifest_path.unlink(missing_ok=True)
