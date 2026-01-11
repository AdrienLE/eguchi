# Eguchi Ear Trainer - Next Steps

## Current State
- Template app is scaffolded; no Eguchi-specific flows are implemented.
- The home tab is a placeholder pointing to the spec (`frontend/app/(tabs)/index.tsx`).
- Auth-gated routing and profile settings are still in place (`frontend/app/index.tsx`, `frontend/app/settings.tsx`).
- Backend APIs are template defaults (nugget + profile settings) and not tied to Eguchi data (`backend/main.py`).

## Decisions To Confirm
- **Spec source of truth:** `SPEC.md` is canonical.
- **Auth:** the spec says no accounts/logins; decide whether to remove auth entirely or keep an optional caregiver profile.
- **Data storage:** local-only (AsyncStorage/SQLite) vs optional backend sync/import/export.
- **Audio packaging:** manifest vs directory scan, file formats, and offline caching strategy (mobile + web).

## Build Plan (v1 - Manual Progression)
1. **Define app config modules** for chord order, default color/animal mapping, and initial unlocked set.
2. **Implement local data layer** for unlocked chords, trial history, daily summary, and streak tracking.
3. **Design audio pack loader** that resolves multiple variants per chord and caches assets for offline use.
4. **Replace the home placeholder** with the training loop (autoplay, grid answer, feedback, replay limit).
5. **Replace Settings** with caregiver controls from the spec (unlock toggles, start set, audio packs, reminders, export/import).
6. **Simplify navigation** to a main training screen + Settings gear; remove unused tabs and auth gating if not needed.
7. **Add tests** for chord selection randomness, unlock toggles, and training state transitions.

## Later Phases
- **v2:** auto-unlock streak logic, progress visuals, notifications.
- **v3:** Stage 3 chord decomposition and single-note modes.
