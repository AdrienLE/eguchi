#!/usr/bin/env python3
"""Align generated Eguchi reaction sprites to each animal's canonical artwork."""

from pathlib import Path

from PIL import Image


ANIMAL_SLUGS = (
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
REACTION_FILES = ("wink.png", "not-me.png", "warm-smile.png", "celebrate.png")
ASSET_ROOT = Path(__file__).resolve().parents[1] / "frontend/assets/images/eguchi"
CANVAS_SIZE = 1024


def alpha_bounds(image: Image.Image, path: Path) -> tuple[int, int, int, int]:
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError(f"Sprite has no visible pixels: {path}")
    return bounds


def normalize_sprite(
    source_path: Path, target_center: tuple[float, float], target_extent: int
) -> None:
    with Image.open(source_path).convert("RGBA") as source:
        source_bounds = alpha_bounds(source, source_path)
        sprite = source.crop(source_bounds)

    scale = target_extent / max(sprite.size)
    resized_size = tuple(max(1, round(dimension * scale)) for dimension in sprite.size)
    sprite = sprite.resize(resized_size, Image.Resampling.LANCZOS)

    left = round(target_center[0] - sprite.width / 2)
    top = round(target_center[1] - sprite.height / 2)
    if (
        left < 0
        or top < 0
        or left + sprite.width > CANVAS_SIZE
        or top + sprite.height > CANVAS_SIZE
    ):
        raise ValueError(f"Normalized sprite would leave its canvas: {source_path}")

    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(sprite, (left, top))
    canvas.save(source_path, format="PNG", optimize=True)


def main() -> None:
    for slug in ANIMAL_SLUGS:
        canonical_path = ASSET_ROOT / "animals" / f"{slug}.png"
        with Image.open(canonical_path).convert("RGBA") as canonical:
            left, top, right, bottom = alpha_bounds(canonical, canonical_path)

        target_center = ((left + right) / 2, (top + bottom) / 2)
        target_extent = max(right - left, bottom - top)
        for reaction_file in REACTION_FILES:
            normalize_sprite(
                ASSET_ROOT / "animations" / slug / reaction_file,
                target_center,
                target_extent,
            )


if __name__ == "__main__":
    main()
