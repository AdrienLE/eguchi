import hashlib
from pathlib import Path

from PIL import Image


ANIMAL_SLUGS = (
    "fox",
    "whale",
    "frog",
    "tiger",
    "octopus",
    "chick",
    "bunny",
    "turtle",
    "bluebird",
    "lion",
    "parrot",
    "fish",
    "seal",
    "crab",
)
ASSET_ROOT = Path("frontend/assets/images/eguchi")


def reaction_paths(slug: str) -> dict[str, Path]:
    if slug == "fox":
        return {
            "wink": ASSET_ROOT / "animals/fox__wink.png",
            "not-me": ASSET_ROOT / "animations/fox/not-me.png",
            "warm-smile": ASSET_ROOT / "animations/fox/happy-big.png",
            "celebrate": ASSET_ROOT / "animations/fox/celebrate-03.png",
        }

    animation_dir = ASSET_ROOT / "animations" / slug
    return {
        "wink": animation_dir / "wink.png",
        "not-me": animation_dir / "not-me.png",
        "warm-smile": animation_dir / "warm-smile.png",
        "celebrate": animation_dir / "celebrate.png",
    }


def test_every_animal_has_four_distinct_ipad_ready_reaction_sprites():
    all_hashes: set[str] = set()

    for slug in ANIMAL_SLUGS:
        animal_hashes: set[str] = set()

        for reaction, asset_path in reaction_paths(slug).items():
            assert asset_path.is_file(), f"Missing {reaction} sprite for {slug}: {asset_path}"

            asset_hash = hashlib.sha256(asset_path.read_bytes()).hexdigest()
            assert asset_hash not in animal_hashes, f"Duplicate reaction sprite for {slug}"
            animal_hashes.add(asset_hash)
            all_hashes.add(asset_hash)

            with Image.open(asset_path) as image:
                assert image.format == "PNG"
                assert image.size == (1024, 1024)
                assert image.mode == "RGBA"

                alpha = image.getchannel("A")
                alpha_bounds = alpha.getbbox()
                assert alpha_bounds is not None, f"Empty reaction sprite: {asset_path}"
                left, top, right, bottom = alpha_bounds
                assert left >= 8 and top >= 8, f"Sprite touches the top/left edge: {asset_path}"
                assert (
                    right <= 1016 and bottom <= 1016
                ), f"Sprite touches the bottom/right edge: {asset_path}"
                assert right - left >= 320, f"Sprite is too narrow for an iPad tile: {asset_path}"
                assert bottom - top >= 320, f"Sprite is too short for an iPad tile: {asset_path}"
                assert alpha.getextrema() == (
                    0,
                    255,
                ), f"Sprite needs transparent padding: {asset_path}"

                near_exact_chroma_pixels = sum(
                    1
                    for red, green, blue, opacity in image.getdata()
                    if opacity > 20 and red <= 4 and green >= 251 and blue <= 4
                )
                assert (
                    near_exact_chroma_pixels < 10
                ), f"Visible chroma-key pixels remain: {asset_path}"

        assert len(animal_hashes) == 4

    assert len(all_hashes) == len(ANIMAL_SLUGS) * 4
