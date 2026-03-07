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
    assert len(manifest.assets) >= 15
    assert any(asset.id == "fox" for asset in manifest.assets)
    assert any(asset.id == "app-icon" for asset in manifest.assets)


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


def test_normalize_worker_count_clamps_to_one():
    module = load_module()
    assert module.normalize_worker_count(1) == 1
    assert module.normalize_worker_count(4) == 4
    assert module.normalize_worker_count(0) == 1


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
        assert "happy" in prompt.lower()
        assert "musical notes" in prompt.lower()
        assert "no text" in prompt.lower()
        assert "no hats" in prompt.lower()
    finally:
        manifest_path.unlink(missing_ok=True)


def test_build_prompt_supports_sad_expression():
    module = load_module()
    asset = module.AssetDefinition(
        id="fox",
        category="animals",
        output_path="frontend/assets/images/eguchi/animals/fox.png",
        subject_prompt="A fox mascot.",
    )
    prompt = module.build_prompt("Base style", asset, emotion=module.EMOTION_SAD)
    assert "slightly sad" in prompt.lower()
    assert "musical notes" in prompt.lower()


def test_build_prompt_supports_accessory_variant():
    module = load_module()
    accessory_variant = module.ANIMAL_ACCESSORY_VARIANT_BY_ID["top-hat"]
    asset = module.AssetDefinition(
        id="fox",
        category="animals",
        output_path="frontend/assets/images/eguchi/animals/fox.png",
        subject_prompt="A fox mascot.",
    )
    prompt = module.build_prompt(
        "Base style",
        asset,
        emotion=module.EMOTION_HAPPY,
        accessory_variant=accessory_variant,
    )
    assert "top hat" in prompt.lower()
    assert "same character identity" in prompt.lower()
    assert "only the requested accessory" in prompt.lower()


def test_get_animal_variant_uses_sad_suffix():
    module = load_module()
    assert module.get_animal_variant(None, module.EMOTION_HAPPY) is None
    assert module.get_animal_variant("v2", module.EMOTION_HAPPY) == "v2"
    assert module.get_animal_variant(None, module.EMOTION_SAD) == "sad"
    assert module.get_animal_variant("v2", module.EMOTION_SAD) == "sad__v2"


def test_get_animal_accessory_variant_builds_happy_and_sad_names():
    module = load_module()
    assert (
        module.get_animal_accessory_variant("top-hat", module.EMOTION_HAPPY)
        == "top-hat"
    )
    assert (
        module.get_animal_accessory_variant("top-hat", module.EMOTION_SAD)
        == "sad__top-hat"
    )
    assert (
        module.get_animal_accessory_variant(
            "top-hat", module.EMOTION_SAD, base_variant="v2"
        )
        == "sad__top-hat__v2"
    )


def test_select_animal_accessory_variants_validates_ids():
    module = load_module()
    selected = module.select_animal_accessory_variants(
        ["top-hat,bow-tie"], all_variants=False
    )
    assert [variant.id for variant in selected] == ["top-hat", "bow-tie"]

    all_selected = module.select_animal_accessory_variants([], all_variants=True)
    assert len(all_selected) == len(module.ANIMAL_ACCESSORY_VARIANTS) - 1

    with pytest.raises(ValueError, match="Unknown animal accessory variant id"):
        module.select_animal_accessory_variants(["missing"], all_variants=False)


def test_find_static_animal_reference_uses_non_overwritten_asset(tmp_path: Path):
    module = load_module()
    repo_root = tmp_path
    animal_dir = repo_root / "frontend" / "assets" / "images" / "eguchi" / "animals"
    animal_dir.mkdir(parents=True, exist_ok=True)

    fox = module.AssetDefinition(
        id="fox",
        category="animals",
        output_path="frontend/assets/images/eguchi/animals/fox.png",
        subject_prompt="Fox",
    )
    whale = module.AssetDefinition(
        id="whale",
        category="animals",
        output_path="frontend/assets/images/eguchi/animals/whale.png",
        subject_prompt="Whale",
    )

    fox_path = animal_dir / "fox.png"
    fox_path.write_bytes(b"fox")
    selected_plans = module.plan_selected_assets(repo_root, [whale], variant=None, force=False)
    selected_by_id = module.map_plans_by_asset_id(selected_plans)

    reference = module.find_static_animal_reference(
        repo_root,
        [fox, whale],
        selected_by_id,
        variant=None,
        force=False,
    )
    assert reference == fox_path


def test_split_seed_task_uses_first_generating_task_without_static_reference():
    module = load_module()
    asset = module.AssetDefinition(
        id="fox",
        category="animals",
        output_path="frontend/assets/images/eguchi/animals/fox.png",
        subject_prompt="Fox",
    )
    planned_tasks = [
        module.PlannedAssetTask(asset=asset, output_path=Path("skip.png"), will_generate=False),
        module.PlannedAssetTask(asset=asset, output_path=Path("seed.png"), will_generate=True),
        module.PlannedAssetTask(asset=asset, output_path=Path("rest.png"), will_generate=True),
    ]

    seed_task, parallel_tasks = module.split_seed_task(
        planned_tasks,
        has_static_reference=False,
    )
    assert seed_task == planned_tasks[1]
    assert parallel_tasks == [planned_tasks[0], planned_tasks[2]]


def test_split_seed_task_skips_seed_when_static_reference_exists():
    module = load_module()
    asset = module.AssetDefinition(
        id="fox",
        category="animals",
        output_path="frontend/assets/images/eguchi/animals/fox.png",
        subject_prompt="Fox",
    )
    planned_tasks = [
        module.PlannedAssetTask(asset=asset, output_path=Path("a.png"), will_generate=True),
        module.PlannedAssetTask(asset=asset, output_path=Path("b.png"), will_generate=True),
    ]

    seed_task, parallel_tasks = module.split_seed_task(
        planned_tasks,
        has_static_reference=True,
    )
    assert seed_task is None
    assert parallel_tasks == planned_tasks


def test_force_mode_disables_static_animal_reference(tmp_path: Path):
    module = load_module()
    repo_root = tmp_path
    animal_dir = repo_root / "frontend" / "assets" / "images" / "eguchi" / "animals"
    animal_dir.mkdir(parents=True, exist_ok=True)

    fox = module.AssetDefinition(
        id="fox",
        category="animals",
        output_path="frontend/assets/images/eguchi/animals/fox.png",
        subject_prompt="Fox",
    )
    fox_path = animal_dir / "fox.png"
    fox_path.write_bytes(b"fox")
    selected_plans = module.plan_selected_assets(repo_root, [fox], variant=None, force=True)
    selected_by_id = module.map_plans_by_asset_id(selected_plans)

    reference = module.find_static_animal_reference(
        repo_root,
        [fox],
        selected_by_id,
        variant=None,
        force=True,
    )
    assert reference is None


def test_select_reference_images_prefers_static_then_generated(tmp_path: Path):
    module = load_module()
    animal_asset = module.AssetDefinition(
        id="fox",
        category="animals",
        output_path="frontend/assets/images/eguchi/animals/fox.png",
        subject_prompt="Fox",
    )
    ui_asset = module.AssetDefinition(
        id="gear",
        category="ui",
        output_path="frontend/assets/images/eguchi/ui/caregiver-gear.png",
        subject_prompt="Gear",
    )

    static_reference = tmp_path / "static.png"
    static_reference.write_bytes(b"static")
    generated_reference = tmp_path / "generated.png"
    generated_reference.write_bytes(b"generated")
    output = tmp_path / "output.png"

    references = module.select_reference_images(
        asset=animal_asset,
        output_path=output,
        static_animal_reference=static_reference,
        generated_animal_reference=generated_reference,
    )
    assert references == [static_reference]

    references_no_static = module.select_reference_images(
        asset=animal_asset,
        output_path=output,
        static_animal_reference=None,
        generated_animal_reference=generated_reference,
    )
    assert references_no_static == [generated_reference]

    references_non_animal = module.select_reference_images(
        asset=ui_asset,
        output_path=output,
        static_animal_reference=static_reference,
        generated_animal_reference=generated_reference,
    )
    assert references_non_animal == []


def test_select_accessory_reference_images_prefers_base_then_style_refs(tmp_path: Path):
    module = load_module()
    output = tmp_path / "fox__top-hat.png"
    base_reference = tmp_path / "fox.png"
    base_reference.write_bytes(b"base")
    static_style_reference = tmp_path / "whale__top-hat.png"
    static_style_reference.write_bytes(b"static-style")
    generated_style_reference = tmp_path / "frog__top-hat.png"
    generated_style_reference.write_bytes(b"generated-style")

    references = module.select_accessory_reference_images(
        output_path=output,
        base_animal_reference=base_reference,
        static_accessory_reference=static_style_reference,
        generated_accessory_reference=generated_style_reference,
    )
    assert references == [
        base_reference,
        static_style_reference,
        generated_style_reference,
    ]


def test_select_sad_reference_images_includes_happy_and_sad_style_refs(tmp_path: Path):
    module = load_module()
    output = tmp_path / "sad-output.png"
    happy_reference = tmp_path / "happy.png"
    happy_reference.write_bytes(b"happy")
    static_sad_reference = tmp_path / "sad-static.png"
    static_sad_reference.write_bytes(b"sad-static")
    generated_sad_reference = tmp_path / "sad-generated.png"
    generated_sad_reference.write_bytes(b"sad-generated")

    references = module.select_sad_reference_images(
        output_path=output,
        happy_reference=happy_reference,
        static_sad_reference=static_sad_reference,
        generated_sad_reference=generated_sad_reference,
    )
    assert references == [happy_reference, static_sad_reference, generated_sad_reference]


def test_find_static_animal_reference_supports_sad_variant(tmp_path: Path):
    module = load_module()
    repo_root = tmp_path
    animal_dir = repo_root / "frontend" / "assets" / "images" / "eguchi" / "animals"
    animal_dir.mkdir(parents=True, exist_ok=True)

    fox = module.AssetDefinition(
        id="fox",
        category="animals",
        output_path="frontend/assets/images/eguchi/animals/fox.png",
        subject_prompt="Fox",
    )
    sad_fox_path = animal_dir / "fox__sad.png"
    sad_fox_path.write_bytes(b"sad-fox")
    selected_plans = module.plan_selected_assets(repo_root, [fox], variant="sad", force=False)
    selected_by_id = module.map_plans_by_asset_id(selected_plans)

    reference = module.find_static_animal_reference(
        repo_root,
        [fox],
        selected_by_id,
        variant=None,
        force=False,
        emotion=module.EMOTION_SAD,
    )
    assert reference == sad_fox_path
