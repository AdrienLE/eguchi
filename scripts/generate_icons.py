import argparse
from pathlib import Path
from PIL import Image
import os

# Comprehensive icon sizes for modern web and mobile apps
ICON_SIZES = {
    # Base app icons
    "icon.png": 1024,
    "adaptive-icon.png": 1024,
    "splash-icon.png": 1024,
    # Favicons (web)
    "favicon.ico": [(16, 16), (32, 32), (48, 48)],  # Multi-size ICO
    "favicon-16x16.png": 16,
    "favicon-32x32.png": 32,
    "favicon-48x48.png": 48,
    # Apple Touch Icons (iOS)
    "apple-touch-icon.png": 180,  # Default iOS icon
    "apple-touch-icon-57x57.png": 57,
    "apple-touch-icon-60x60.png": 60,
    "apple-touch-icon-72x72.png": 72,
    "apple-touch-icon-76x76.png": 76,
    "apple-touch-icon-114x114.png": 114,
    "apple-touch-icon-120x120.png": 120,
    "apple-touch-icon-144x144.png": 144,
    "apple-touch-icon-152x152.png": 152,
    "apple-touch-icon-180x180.png": 180,
    # Android Chrome icons
    "android-chrome-36x36.png": 36,
    "android-chrome-48x48.png": 48,
    "android-chrome-72x72.png": 72,
    "android-chrome-96x96.png": 96,
    "android-chrome-144x144.png": 144,
    "android-chrome-192x192.png": 192,
    "android-chrome-256x256.png": 256,
    "android-chrome-384x384.png": 384,
    "android-chrome-512x512.png": 512,
    # PWA Manifest icons
    "pwa-192x192.png": 192,
    "pwa-512x512.png": 512,
    # MS Tiles
    "mstile-70x70.png": 70,
    "mstile-144x144.png": 144,
    "mstile-150x150.png": 150,
    "mstile-310x150.png": (310, 150),  # Wide tile
    "mstile-310x310.png": 310,
}


def create_favicon_ico(src_img, output_path, sizes):
    """Create a multi-size ICO file"""
    icons = []
    for size in sizes:
        if isinstance(size, tuple):
            width, height = size
        else:
            width = height = size
        icon = src_img.resize((width, height), Image.Resampling.LANCZOS)
        icons.append(icon)

    # Save as ICO with multiple sizes
    icons[0].save(output_path, format="ICO", sizes=[(icon.width, icon.height) for icon in icons])


def main(src_path: str):
    try:
        src = Image.open(src_path)
        print(f"✓ Loaded source image: {src_path} ({src.width}x{src.height})")

        # Ensure source image is square and high resolution
        if src.width != src.height:
            print("⚠️  Warning: Source image is not square. Icons may be distorted.")

        if min(src.width, src.height) < 512:
            print(
                "⚠️  Warning: Source image is smaller than 512px. Quality may be poor for larger icons."
            )

        # Create output directory
        out_dir = Path("frontend/assets/images")
        out_dir.mkdir(parents=True, exist_ok=True)
        print(f"✓ Output directory: {out_dir}")

        icons_created = 0

        for name, size_spec in ICON_SIZES.items():
            output_path = out_dir / name

            try:
                if name == "favicon.ico":
                    # Special handling for ICO files
                    create_favicon_ico(src, output_path, size_spec)
                    print(f"✓ Created {name} (multi-size ICO)")
                elif isinstance(size_spec, tuple):
                    # Non-square dimensions
                    width, height = size_spec
                    img = src.resize((width, height), Image.Resampling.LANCZOS)
                    img.save(output_path, optimize=True)
                    print(f"✓ Created {name} ({width}x{height})")
                else:
                    # Square dimensions
                    size = size_spec
                    img = src.resize((size, size), Image.Resampling.LANCZOS)
                    img.save(output_path, optimize=True)
                    print(f"✓ Created {name} ({size}x{size})")

                icons_created += 1

            except Exception as e:
                print(f"✗ Failed to create {name}: {e}")

        print(f"\n🎉 Successfully created {icons_created}/{len(ICON_SIZES)} icons!")

        # Generate usage instructions
        print("\n📋 Usage Instructions:")
        print("Add these to your HTML <head> section:")
        print(
            """
<!-- Favicons -->
<link rel="icon" type="image/x-icon" href="/assets/images/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/images/favicon-16x16.png">

<!-- Apple Touch Icons -->
<link rel="apple-touch-icon" sizes="180x180" href="/assets/images/apple-touch-icon-180x180.png">
<link rel="apple-touch-icon" sizes="152x152" href="/assets/images/apple-touch-icon-152x152.png">
<link rel="apple-touch-icon" sizes="144x144" href="/assets/images/apple-touch-icon-144x144.png">
<link rel="apple-touch-icon" sizes="120x120" href="/assets/images/apple-touch-icon-120x120.png">

<!-- Android Chrome -->
<link rel="icon" type="image/png" sizes="192x192" href="/assets/images/android-chrome-192x192.png">
<link rel="icon" type="image/png" sizes="512x512" href="/assets/images/android-chrome-512x512.png">

<!-- PWA Manifest (add to manifest.json) -->
"icons": [
  {
    "src": "/assets/images/pwa-192x192.png",
    "sizes": "192x192",
    "type": "image/png"
  },
  {
    "src": "/assets/images/pwa-512x512.png",
    "sizes": "512x512",
    "type": "image/png"
  }
]
        """
        )

    except FileNotFoundError:
        print(f"✗ Error: Source image not found: {src_path}")
        return 1
    except Exception as e:
        print(f"✗ Error: {e}")
        return 1

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate comprehensive app icons from a PNG")
    parser.add_argument("png", help="Source PNG image (recommended: 1024x1024 or larger)")
    args = parser.parse_args()
    exit(main(args.png))
