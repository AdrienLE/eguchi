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
ASSET_DIR = Path("frontend/assets/images/eguchi/animals")


def test_canonical_animal_sprites_are_complete_and_ipad_ready():
    for slug in ANIMAL_SLUGS:
        asset_path = ASSET_DIR / f"{slug}.png"
        assert asset_path.is_file(), f"Missing canonical sprite: {asset_path}"

        with Image.open(asset_path) as image:
            assert image.format == "PNG"
            assert image.size == (1024, 1024)
            assert image.mode == "RGBA"

            alpha = image.getchannel("A")
            alpha_bounds = alpha.getbbox()
            assert alpha_bounds is not None, f"Empty canonical sprite: {asset_path}"
            left, top, right, bottom = alpha_bounds
            assert right - left >= 480, f"Sprite is too narrow for an iPad tile: {asset_path}"
            assert bottom - top >= 480, f"Sprite is too short for an iPad tile: {asset_path}"
            assert alpha.getextrema()[0] == 0, f"Sprite lacks transparent padding: {asset_path}"
