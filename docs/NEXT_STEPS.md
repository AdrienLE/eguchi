# Eguchi Ear Trainer - Next Steps

## Current State

- Template app is scaffolded; Eguchi-specific work is underway.
- The home screen now runs an adaptive Eguchi loop that begins with Fox alone, fades color-wink cues, retries gently until success, and reserves larger celebrations for independent recognition (`frontend/app/(tabs)/index.tsx`).
- Local progress persists independent/assisted/corrected outcomes plus the cue and octave-learning stage; caregiver metrics are shown only in Settings (`frontend/lib/eguchi/progress.ts`, `frontend/app/settings.tsx`).
- Navigation is now simplified to training + caregiver settings via a header gear (`frontend/app/(tabs)/_layout.tsx`, `frontend/app/index.tsx`).
- Auth-gated routing for app entry has been removed in the UI shell (`frontend/app/_layout.tsx`), while auth modules remain in repo for now.
- Caregiver settings now include audio pack cache management (download all, clear cache, progress UI, and cache metadata) via `frontend/lib/eguchi/audio-cache.ts` and `frontend/app/settings.tsx`.
- Adaptive progression status and experimental no-wink controls are visible in Caregiver Settings, with manual level controls and legacy day-based auto-unlock retained as a fallback (`frontend/lib/eguchi/learning-path.ts`, `frontend/app/settings.tsx`).
- Visual assets are currently checked in as plain happy/sad animal PNGs under `frontend/assets/images/eguchi/animals/`.
- The accessory image pipeline has been removed from the active app and deferred until it can produce clean production art.
- Backend APIs are template defaults (nugget + profile settings) and not tied to Eguchi data (`backend/main.py`).
- Eguchi chord order + default mappings live in `frontend/lib/eguchi/chords.ts`.
- Audio pack generator script added at `scripts/generate_audio_pack.py` (requires `fluidsynth` + a piano .sf2, and `ffmpeg` for MP3 output).
- Audio playback wired to the training UI using the generated pack (`frontend/lib/eguchi/audio-pack.ts`).
- The training UI uses only base animal art; accessory shuffle/reset controls and caregiver force-plain settings are not active.

## Decisions To Confirm

- **Spec source of truth:** `SPEC.md` is canonical.
- **Auth:** the spec says no accounts/logins; decide whether to remove auth entirely or keep an optional caregiver profile.
- **Data storage:** local-only (AsyncStorage/SQLite) vs optional backend sync/import/export.
- **Audio packaging:** manifest vs directory scan, file formats, and offline caching strategy (mobile + web).

## Build Plan (v1 - Manual Progression)

- [x] **MVP: make the training loop playable** (audio playback + replay, auto-advance, and random chord selection).
- [x] **MVP: store local progress** (unlocked chords, trial history, and daily summaries).
- [x] **MVP: basic caregiver settings** (unlock toggles and reset data).
- [x] **Audio packs + offline caching** (download/delete flow + explicit offline cache management in Settings).
- [x] **Simplify navigation** to main training + Settings gear and remove unused tab shell.
- [x] **Add tests** for chord selection randomness and training UI transitions.
- [x] **Add tests** for progress state transitions and unlock persistence.
- [x] **Generate and integrate animal illustrations** from the manifest into training tiles (replace emoji-only fallback where available).
- [ ] **Defer animal accessory variants** until a clean production image pipeline is designed and tested.

## Later Phases

- **v2:** refine adaptive mastery thresholds from playtesting + notifications.
- **v3:** Stage 3 chord decomposition and single-note modes.
