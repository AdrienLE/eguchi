#!/usr/bin/env python3
"""Visual editor for Eguchi accessory layout anchors."""

from __future__ import annotations

import argparse
import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


REFERENCE_ACCESSORY_BY_CATEGORY = {
    "headwear": "top-hat",
    "facewear": "round-glasses",
    "neckwear": "bow-tie",
    "aura": "sparkles",
}


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def build_animals(manifest_payload: dict[str, Any]) -> list[dict[str, str]]:
    animals: list[dict[str, str]] = []
    for asset in manifest_payload.get("assets", []):
        if asset.get("category") != "animals":
            continue
        output_path = Path(asset["output_path"])
        stem = output_path.stem
        suffix = output_path.suffix
        animals.append(
            {
                "id": asset["id"],
                "label": asset["id"].replace("-", " ").title(),
                "happy_path": output_path.as_posix(),
                "sad_path": (output_path.parent / f"{stem}__sad{suffix}").as_posix(),
            }
        )
    return animals


def build_accessories(catalog_payload: dict[str, Any]) -> dict[str, dict[str, str]]:
    accessories: dict[str, dict[str, str]] = {}
    for asset in catalog_payload.get("assets", []):
        accessories[asset["id"]] = {
            "id": asset["id"],
            "label": asset.get("label", asset["id"].replace("-", " ").title()),
            "placement_category": asset["placement_category"],
            "output_path": asset["output_path"],
        }
    return accessories


def build_editor_state(
    repo_root: Path,
    manifest_path: Path,
    catalog_path: Path,
    layout_path: Path,
) -> dict[str, Any]:
    manifest_payload = load_json(manifest_path)
    catalog_payload = load_json(catalog_path)
    layout_payload = load_json(layout_path)
    accessories = build_accessories(catalog_payload)

    reference_accessories: dict[str, dict[str, str]] = {}
    for category, accessory_id in REFERENCE_ACCESSORY_BY_CATEGORY.items():
        accessory = accessories.get(accessory_id)
        if accessory:
            reference_accessories[category] = accessory

    return {
        "animals": build_animals(manifest_payload),
        "layout": layout_payload,
        "reference_accessories": reference_accessories,
        "categories": list(REFERENCE_ACCESSORY_BY_CATEGORY.keys()),
        "repo_root": repo_root.as_posix(),
    }


def get_next_editor_selection(
    animals: list[dict[str, str]],
    categories: list[str],
    *,
    animal_id: str,
    emotion: str,
    category: str,
) -> dict[str, str]:
    animal_ids = [animal["id"] for animal in animals]
    if animal_id not in animal_ids:
        raise ValueError(f"Unknown animal id: {animal_id}")
    if emotion not in {"happy", "sad"}:
        raise ValueError(f"Unknown emotion: {emotion}")
    if category not in categories:
        raise ValueError(f"Unknown category: {category}")

    animal_index = animal_ids.index(animal_id)
    category_index = categories.index(category)
    if category_index < len(categories) - 1:
        return {
            "animal_id": animal_id,
            "emotion": emotion,
            "category": categories[category_index + 1],
        }
    if emotion == "happy":
        return {
            "animal_id": animal_id,
            "emotion": "sad",
            "category": categories[0],
        }
    next_animal_index = (animal_index + 1) % len(animal_ids)
    return {
        "animal_id": animal_ids[next_animal_index],
        "emotion": "happy",
        "category": categories[0],
    }


def update_layout_anchor(
    layout_path: Path,
    *,
    animal_id: str,
    emotion: str,
    category: str,
    anchor: dict[str, float],
) -> dict[str, Any]:
    payload = load_json(layout_path)
    animals = payload.setdefault("animals", {})
    animal_entry = animals.setdefault(animal_id, {})
    emotion_entry = animal_entry.setdefault(emotion, {})
    emotion_entry[category] = {
        "anchor_x": float(anchor["anchor_x"]),
        "anchor_y": float(anchor["anchor_y"]),
        "width_ratio": float(anchor["width_ratio"]),
        "rotation_degrees": float(anchor.get("rotation_degrees", 0.0)),
    }
    write_json(layout_path, payload)
    return payload


def resolve_safe_path(repo_root: Path, raw_path: str) -> Path:
    candidate = (repo_root / raw_path).resolve()
    if repo_root.resolve() not in candidate.parents and candidate != repo_root.resolve():
        raise ValueError("Path escapes repository root")
    return candidate


HTML = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Eguchi Layout Editor</title>
    <style>
      :root {
        --bg: #f4efe7;
        --panel: rgba(255, 251, 245, 0.92);
        --line: #d3c4b0;
        --ink: #2f2218;
        --accent: #d6762d;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Avenir Next", "Trebuchet MS", sans-serif;
        color: var(--ink);
        background: radial-gradient(circle at top, #fff6e8 0%, #f4efe7 42%, #eadfcf 100%);
      }
      .shell {
        display: grid;
        grid-template-columns: 360px 1fr;
        min-height: 100vh;
      }
      .panel {
        background: var(--panel);
        border-right: 1px solid var(--line);
        padding: 20px;
        backdrop-filter: blur(12px);
      }
      .panel h1 {
        font-size: 1.4rem;
        margin: 0 0 8px;
      }
      .panel p {
        margin: 0 0 16px;
        line-height: 1.4;
      }
      .field {
        display: grid;
        gap: 6px;
        margin-bottom: 14px;
      }
      .field label {
        font-weight: 700;
        font-size: 0.92rem;
      }
      select, input[type="range"], button {
        width: 100%;
      }
      select, button {
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 12px 14px;
        background: white;
        color: var(--ink);
        font: inherit;
      }
      button {
        cursor: pointer;
        font-weight: 700;
      }
      .primary {
        background: linear-gradient(180deg, #f9a35d 0%, #d6762d 100%);
        color: white;
        border: none;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 14px;
      }
      .stat {
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 10px;
        background: rgba(255, 255, 255, 0.85);
      }
      .stat .value {
        font-size: 1.1rem;
        font-weight: 800;
      }
      .workspace {
        padding: 20px;
        display: grid;
        place-items: center;
      }
      .canvas-wrap {
        position: relative;
        width: min(80vw, 860px);
        aspect-ratio: 1 / 1;
        border-radius: 28px;
        overflow: hidden;
        border: 1px solid rgba(77, 52, 24, 0.15);
        box-shadow: 0 30px 80px rgba(73, 48, 24, 0.18);
        background: linear-gradient(180deg, rgba(255,255,255,0.7), rgba(250,241,227,0.88));
      }
      canvas {
        width: 100%;
        height: 100%;
        display: block;
      }
      .hint {
        margin-top: 16px;
        text-align: center;
        font-weight: 600;
      }
      .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .muted {
        opacity: 0.72;
        font-size: 0.92rem;
      }
      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      @media (max-width: 980px) {
        .shell {
          grid-template-columns: 1fr;
        }
        .panel {
          border-right: none;
          border-bottom: 1px solid var(--line);
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <aside class="panel">
        <h1>Accessory Layout Editor</h1>
        <p>Drag the sample accessory onto the animal, then save the anchor for that category. One anchor is shared by all accessories in that category.</p>

        <div class="field">
          <label for="animal">Animal</label>
          <select id="animal"></select>
        </div>
        <div class="field">
          <label for="emotion">Emotion</label>
          <select id="emotion">
            <option value="happy">Happy</option>
            <option value="sad">Sad</option>
          </select>
        </div>
        <div class="field">
          <label for="category">Category</label>
          <select id="category"></select>
        </div>

        <div class="stats">
          <div class="stat">
            <div class="muted">Reference Accessory</div>
            <div class="value" id="accessory-name">-</div>
          </div>
          <div class="stat">
            <div class="muted">Placement</div>
            <div class="value mono" id="anchor-readout">-</div>
          </div>
          <div class="stat">
            <div class="muted">Step</div>
            <div class="value" id="step-readout">-</div>
          </div>
        </div>

        <div class="field">
          <label for="widthRatio">Size</label>
          <input id="widthRatio" type="range" min="0.12" max="0.90" step="0.005" />
        </div>
        <div class="field">
          <label for="rotation">Rotation</label>
          <input id="rotation" type="range" min="-45" max="45" step="0.5" />
        </div>

        <div class="row">
          <button id="resetDefault">Reset To Default</button>
          <button id="reloadState">Reload File</button>
        </div>
        <div style="height:10px"></div>
        <div class="row">
          <button id="saveLayout">Save</button>
          <button class="primary" id="saveAndNext">Save &amp; Next</button>
        </div>
        <p class="muted" id="status">Loading…</p>
      </aside>

      <main class="workspace">
        <div>
          <div class="canvas-wrap">
            <canvas id="stage" width="1024" height="1024"></canvas>
          </div>
          <div class="hint">Drag to move. Use the sliders to resize and rotate. Save when this animal/category looks right.</div>
        </div>
      </main>
    </div>

    <script>
      const state = {
        payload: null,
        baseImage: null,
        accessoryImage: null,
        currentAnchor: null,
        dragging: false
      };

      const elements = {
        animal: document.getElementById('animal'),
        emotion: document.getElementById('emotion'),
        category: document.getElementById('category'),
        widthRatio: document.getElementById('widthRatio'),
        rotation: document.getElementById('rotation'),
        saveLayout: document.getElementById('saveLayout'),
        saveAndNext: document.getElementById('saveAndNext'),
        resetDefault: document.getElementById('resetDefault'),
        reloadState: document.getElementById('reloadState'),
        status: document.getElementById('status'),
        accessoryName: document.getElementById('accessory-name'),
        anchorReadout: document.getElementById('anchor-readout'),
        stepReadout: document.getElementById('step-readout'),
        stage: document.getElementById('stage')
      };

      const ctx = elements.stage.getContext('2d');

      function setStatus(message) {
        elements.status.textContent = message;
      }

      function cloneAnchor(anchor) {
        return JSON.parse(JSON.stringify(anchor));
      }

      async function fetchState() {
        const response = await fetch('/state');
        state.payload = await response.json();
        hydrateControls();
        await loadImages();
        draw();
        setStatus('Loaded.');
      }

      function hydrateControls() {
        const animals = state.payload.animals;
        elements.animal.innerHTML = animals.map(animal => `<option value="${animal.id}">${animal.label}</option>`).join('');
        elements.category.innerHTML = state.payload.categories.map(category => `<option value="${category}">${category}</option>`).join('');
      }

      function getSelectedAnimal() {
        return state.payload.animals.find(animal => animal.id === elements.animal.value) || state.payload.animals[0];
      }

      function getReferenceAccessory() {
        return state.payload.reference_accessories[elements.category.value];
      }

      function getStepLabel() {
        const animalIndex = state.payload.animals.findIndex(animal => animal.id === elements.animal.value);
        return `${animalIndex + 1}/${state.payload.animals.length}`;
      }

      function getDefaultAnchor() {
        return state.payload.layout.defaults[elements.emotion.value][elements.category.value];
      }

      function getSavedAnchor() {
        const animalLayouts = state.payload.layout.animals?.[elements.animal.value];
        const emotionLayouts = animalLayouts?.[elements.emotion.value];
        return emotionLayouts?.[elements.category.value] || null;
      }

      function getEffectiveAnchor() {
        return getSavedAnchor() || getDefaultAnchor();
      }

      async function loadImage(path) {
        return new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = `/file?path=${encodeURIComponent(path)}`;
        });
      }

      async function loadImages() {
        const animal = getSelectedAnimal();
        const accessory = getReferenceAccessory();
        elements.accessoryName.textContent = accessory ? accessory.label : '-';
        elements.stepReadout.textContent = getStepLabel();
        state.currentAnchor = cloneAnchor(getEffectiveAnchor());
        elements.widthRatio.value = state.currentAnchor.width_ratio;
        elements.rotation.value = state.currentAnchor.rotation_degrees || 0;

        state.baseImage = await loadImage(
          elements.emotion.value === 'sad' ? animal.sad_path : animal.happy_path
        );
        state.accessoryImage = await loadImage(accessory.output_path);
      }

      function draw() {
        if (!state.baseImage || !state.accessoryImage || !state.currentAnchor) {
          return;
        }

        ctx.clearRect(0, 0, elements.stage.width, elements.stage.height);
        ctx.drawImage(state.baseImage, 0, 0, elements.stage.width, elements.stage.height);

        const anchor = state.currentAnchor;
        const targetWidth = elements.stage.width * anchor.width_ratio;
        const scale = targetWidth / state.accessoryImage.width;
        const targetHeight = state.accessoryImage.height * scale;
        const centerX = anchor.anchor_x * elements.stage.width;
        const centerY = anchor.anchor_y * elements.stage.height;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((anchor.rotation_degrees || 0) * Math.PI / 180);
        ctx.drawImage(
          state.accessoryImage,
          -targetWidth / 2,
          -targetHeight / 2,
          targetWidth,
          targetHeight
        );
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = '#ff2f7d';
        ctx.lineWidth = 4;
        ctx.setLineDash([12, 10]);
        ctx.strokeRect(centerX - targetWidth / 2, centerY - targetHeight / 2, targetWidth, targetHeight);
        ctx.setLineDash([]);
        ctx.strokeStyle = '#17d1ff';
        ctx.beginPath();
        ctx.moveTo(centerX - 18, centerY);
        ctx.lineTo(centerX + 18, centerY);
        ctx.moveTo(centerX, centerY - 18);
        ctx.lineTo(centerX, centerY + 18);
        ctx.stroke();
        ctx.restore();

        elements.anchorReadout.textContent = `${anchor.anchor_x.toFixed(3)}, ${anchor.anchor_y.toFixed(3)}`;
      }

      function canvasPoint(event) {
        const rect = elements.stage.getBoundingClientRect();
        return {
          x: ((event.clientX - rect.left) / rect.width) * elements.stage.width,
          y: ((event.clientY - rect.top) / rect.height) * elements.stage.height
        };
      }

      elements.stage.addEventListener('pointerdown', event => {
        state.dragging = true;
        elements.stage.setPointerCapture(event.pointerId);
      });

      elements.stage.addEventListener('pointermove', event => {
        if (!state.dragging || !state.currentAnchor) {
          return;
        }
        const point = canvasPoint(event);
        state.currentAnchor.anchor_x = Math.max(0.05, Math.min(0.95, point.x / elements.stage.width));
        state.currentAnchor.anchor_y = Math.max(0.05, Math.min(0.95, point.y / elements.stage.height));
        draw();
      });

      elements.stage.addEventListener('pointerup', event => {
        state.dragging = false;
        elements.stage.releasePointerCapture(event.pointerId);
      });

      elements.widthRatio.addEventListener('input', () => {
        state.currentAnchor.width_ratio = Number(elements.widthRatio.value);
        draw();
      });

      elements.rotation.addEventListener('input', () => {
        state.currentAnchor.rotation_degrees = Number(elements.rotation.value);
        draw();
      });

      async function refreshPreview() {
        try {
          setStatus('Loading preview…');
          await loadImages();
          draw();
          setStatus('Loaded.');
        } catch (error) {
          console.error(error);
          setStatus('Preview failed to load. Make sure the animal and reference accessory images exist.');
        }
      }

      async function saveLayout() {
        const response = await fetch('/layout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            animal_id: elements.animal.value,
            emotion: elements.emotion.value,
            category: elements.category.value,
            anchor: state.currentAnchor
          })
        });
        state.payload.layout = await response.json();
      }

      async function moveToNextStep() {
        const response = await fetch('/next-selection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            animal_id: elements.animal.value,
            emotion: elements.emotion.value,
            category: elements.category.value
          })
        });
        const next = await response.json();
        elements.animal.value = next.animal_id;
        elements.emotion.value = next.emotion;
        elements.category.value = next.category;
        await refreshPreview();
      }

      elements.animal.addEventListener('change', refreshPreview);
      elements.emotion.addEventListener('change', refreshPreview);
      elements.category.addEventListener('change', refreshPreview);

      elements.resetDefault.addEventListener('click', () => {
        state.currentAnchor = cloneAnchor(getDefaultAnchor());
        elements.widthRatio.value = state.currentAnchor.width_ratio;
        elements.rotation.value = state.currentAnchor.rotation_degrees || 0;
        draw();
        setStatus('Reset to default preview. Save to persist.');
      });

      elements.reloadState.addEventListener('click', async () => {
        setStatus('Reloading…');
        await fetchState();
      });

      elements.saveLayout.addEventListener('click', async () => {
        setStatus('Saving…');
        await saveLayout();
        setStatus('Saved to layout file.');
      });

      elements.saveAndNext.addEventListener('click', async () => {
        setStatus('Saving and moving…');
        await saveLayout();
        await moveToNextStep();
        setStatus('Saved. Ready for the next step.');
      });

      fetchState().catch(error => {
        console.error(error);
        setStatus('Failed to load editor state.');
      });
    </script>
  </body>
</html>
"""


def make_handler(
    *,
    repo_root: Path,
    manifest_path: Path,
    catalog_path: Path,
    layout_path: Path,
):
    class Handler(BaseHTTPRequestHandler):
        def _send_json(self, payload: dict[str, Any], status: int = HTTPStatus.OK) -> None:
            data = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _send_text(self, payload: str, status: int = HTTPStatus.OK) -> None:
            data = payload.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _send_file(self, path: Path) -> None:
            if not path.exists():
                self.send_error(HTTPStatus.NOT_FOUND, "File not found")
                return
            data = path.read_bytes()
            content_type = "image/png"
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            if parsed.path == "/":
                self._send_text(HTML)
                return
            if parsed.path == "/state":
                self._send_json(
                    build_editor_state(repo_root, manifest_path, catalog_path, layout_path)
                )
                return
            if parsed.path == "/file":
                query = parse_qs(parsed.query)
                raw_path = query.get("path", [None])[0]
                if not raw_path:
                    self.send_error(HTTPStatus.BAD_REQUEST, "Missing path parameter")
                    return
                try:
                    file_path = resolve_safe_path(repo_root, raw_path)
                except ValueError as error:
                    self.send_error(HTTPStatus.BAD_REQUEST, str(error))
                    return
                self._send_file(file_path)
                return
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")

        def do_POST(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length) or b"{}")
            if parsed.path == "/layout":
                updated = update_layout_anchor(
                    layout_path,
                    animal_id=str(payload["animal_id"]),
                    emotion=str(payload["emotion"]),
                    category=str(payload["category"]),
                    anchor=payload["anchor"],
                )
                self._send_json(updated)
                return
            if parsed.path == "/next-selection":
                state = build_editor_state(repo_root, manifest_path, catalog_path, layout_path)
                next_selection = get_next_editor_selection(
                    state["animals"],
                    state["categories"],
                    animal_id=str(payload["animal_id"]),
                    emotion=str(payload["emotion"]),
                    category=str(payload["category"]),
                )
                self._send_json(next_selection)
                return
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")

        def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
            print(format % args)

    return Handler


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Edit Eguchi accessory anchors visually.")
    parser.add_argument("--manifest", default="scripts/visual_asset_prompts.json")
    parser.add_argument("--accessory-catalog", default="scripts/eguchi_accessory_sprite_prompts.json")
    parser.add_argument("--layout", default="scripts/eguchi_accessory_layouts.json")
    parser.add_argument("--port", type=int, default=8765)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    manifest_path = (repo_root / args.manifest).resolve()
    catalog_path = (repo_root / args.accessory_catalog).resolve()
    layout_path = (repo_root / args.layout).resolve()
    handler = make_handler(
        repo_root=repo_root,
        manifest_path=manifest_path,
        catalog_path=catalog_path,
        layout_path=layout_path,
    )
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"Accessory layout editor running at http://127.0.0.1:{args.port}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
