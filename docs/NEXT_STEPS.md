# Eguchi Ear Trainer - Next Steps

## Current State
- Template app is scaffolded; Eguchi-specific work is underway.
- The home tab now renders a minimal training UI with the default unlocked chords (`frontend/app/(tabs)/index.tsx`).
- Auth-gated routing and profile settings are still in place (`frontend/app/index.tsx`, `frontend/app/settings.tsx`).
- Backend APIs are template defaults (nugget + profile settings) and not tied to Eguchi data (`backend/main.py`).
- Eguchi chord order + default mappings live in `frontend/lib/eguchi/chords.ts`.

## Decisions To Confirm
- **Spec source of truth:** `SPEC.md` is canonical.
- **Auth:** the spec says no accounts/logins; decide whether to remove auth entirely or keep an optional caregiver profile.
- **Data storage:** local-only (AsyncStorage/SQLite) vs optional backend sync/import/export.
- **Audio packaging:** manifest vs directory scan, file formats, and offline caching strategy (mobile + web).

## Build Plan (v1 - Manual Progression)
1. **MVP: make the training loop playable** (audio playback + replay, auto-advance, and random chord selection).
2. **MVP: store local progress** (unlocked chords, trial history, and daily summaries).
3. **MVP: basic caregiver settings** (unlock toggles + start set, and reset data).
4. **Audio packs + offline caching** (manifest or directory scan, download/delete flow).
5. **Simplify navigation** to main training + Settings gear; remove unused tabs and auth gating if not needed.
6. **Add tests** for chord selection randomness, unlock toggles, and training state transitions.

## Later Phases
- **v2:** auto-unlock streak logic, progress visuals, notifications.
- **v3:** Stage 3 chord decomposition and single-note modes.
