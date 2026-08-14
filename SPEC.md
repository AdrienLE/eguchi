# Eguchi Ear-Training — Plan

This app teaches absolute pitch to young children using the **Eguchi method** (chord-first training with color/character cues, short frequent sessions, mastery-based progression). Audio is **pre-generated** chord files (multiple variants per chord, across multiple octaves). The app runs on a React Native + Expo codebase and should work **offline** (including web via caching). Web should need **minimal special casing**.

---

## 1) Method (Eguchi) — Working Principles

- **Unit of learning = a chord “sound object.”** Each target chord is treated as its own category with a fixed **color + animal** cue. Children identify the chord by tapping its tile; no pitch names are shown to the child.
- **Chord-first → note-level later.** Start with a small set of chord categories; after full mastery of the chord set, add a separate “Stage 3” mode to decompose chords into single notes and test single-note identification.
- **Variation expands after early success.** A new sound starts with multiple natural variants in one octave. Once recognition is independent, adjacent octaves are introduced so children learn the chord identity rather than one recording.
- **Short, frequent sessions.** Each session is ~2–4 minutes. The child opens the app and immediately starts.

> Non-goals: No solfège, no melody dictation, no interval comparison. Avoid features that push relative-pitch strategies.

---

## 2) Curriculum (Chord Set & Order)

The app defines a fixed **unlock order**. Conceptually, the first 9 form “Stage 1” (white-key triads) and the next 5 “Stage 2” (black-key triads), but the software treats them uniformly as a single ordered list. Each line below is one **distinct chord category**.

> **Note:** The color/animal mapping is an app convention (not a global standard). It should be configurable in Settings, but defaults are provided for immediate use.

### Ordered Chord List (with default Color + Animal)

1. **C-E-G** — Color: **Red** — Animal: **Fox**
2. **F-A-C** — Color: **Blue** — Animal: **Whale**
3. **G-B-D** — Color: **Green** — Animal: **Frog**
4. **E-G-C** — Color: **Orange** — Animal: **Tiger**
5. **A-C-F** — Color: **Purple** — Animal: **Octopus**
6. **B-D-G** — Color: **Yellow** — Animal: **Chick**
7. **G-C-E** — Color: **Pink** — Animal: **Bunny**
8. **C-F-A** — Color: **Teal** — Animal: **Turtle**
9. **D-G-B** — Color: **Indigo** — Animal: **Bluebird**

10. **A-C♯-E** — Color: **Gold** — Animal: **Lion**
11. **D-F♯-A** — Color: **Lime** — Animal: **Parrot**
12. **E-G♯-B** — Color: **Cyan** — Animal: **Fish**
13. **B♭-D-F** — Color: **Silver** — Animal: **Seal**
14. **E♭-G-B♭** — Color: **Coral** — Animal: **Crab**

> The app does **not** need to know anything about “inversions” or internal structure; it just treats each line above as a separate category with multiple audio files available.

---

## 3) App Behavior & UX

### 3.1 Child Flow (Main Screen)

- On launch, **play** a random chord from the current adaptive practice set after the required platform start gesture.
- Show **one large grid** of tiles (one tile per currently active chord). Each tile displays:
  - Background **color** (from the mapping).
  - A cute **animal** icon/emoji/illustration matching that chord.
- **Replay** button to replay the current chord (optional limit, e.g., up to 2 replays).
- Animal art is currently a clean plain set. Sad variants may remain in the asset pack, but are not used as child-facing correction feedback. Accessory looks are deferred.
- The child **taps** a tile to answer.
  - **Independent correct:** the selected animal gives the largest positive reaction (hop/spin/sparkles).
  - **Correct after a cue:** the selected animal gives a smaller positive hop.
  - **Incorrect:** only the tapped animal gives a gentle in-place “not me” head tilt. Replay the sound, softly color-wink the correct animal, and let the child try again.

**Trial loop:** Every round ends successfully. An incorrect tap does not end or advance the round; the next trial begins only after the correct animal is found.

### 3.2 Simplicity

- No menus before training starts.
- No text is required for the child to operate the app.

---

## 4) Stimulus Selection (Simple & Random)

- **Chord choice:** Uniform random among the categories active in the current learning phase.
- **Variant choice:** Uniform random among the eligible audio files for that chord (see §7).
- **Octave range:** Start in octave 4, expand to octaves 4 + 3, then to octaves 3 + 4 + 5 after independent mastery.

> Keep selection random inside each phase. Adapt the cue delay, active animal set, and octave range—not individual chord probabilities.

---

## 5) Progression & Unlocking

- **Start with only Fox / C-E-G active.** After four successful exposure rounds, introduce Whale / F-A-C with an instant color-wink cue.
- **Fade the cue:** guided cue delays progress through 0, 0.75, 1.5, 3, and 5 seconds. Advancement at delayed steps requires at least four independent rounds in the latest six, with at most one corrected round.
- **Probe independence:** when enabled, every fourth eligible guided round has no scheduled wink. This experiment is caregiver-configurable.
- **Require independent mastery:** after cues are removed, require at least eight independent rounds in the latest ten, with at most one corrected round, before expanding the octave range or introducing a new friend.
- **Generalize before adding friends:** independently master octave 4, then octaves 4 + 3, then octaves 3 + 4 + 5. The next friend is introduced alone before rejoining the active set.
- **Back off gently:** repeated corrected rounds shorten the cue delay or return independent practice to the longest guided cue.
- **Manual override:** caregivers can set the active level at any time. The earlier day/streak auto-unlock mode remains available only when the adaptive learning path is disabled.

> Accuracy, learning-stage details, and outcome counts belong in Caregiver Settings, not on the child screen.

---

## 6) Stage 3 (Later Feature)

Add a separate **Stage 3** mode after the main chord set is mastered:

- **Chord decomposition:** After the child identifies the chord, optionally play and ask for the individual notes (still using colors/animals or a simplified UI).
- **Single-note mode:** Play single notes (broad keyboard range) and show a different tile set appropriate to note IDs.
- Stage 3 is **off** by default and can be enabled in Settings.

---

## 7) Audio Content (Assumptions the App Makes)

- For each chord category in §2, there are **multiple audio files** representing explicit octaves and natural variations. The app filters by octave during generalization and randomly picks among the remaining variants.
- **Discovery pattern:** the app can load all files whose names begin with the chord label, e.g.:
  - `C-E-G*.mp3`, `F-A-C*.mp3`, `G-B-D*.mp3`, … (exact extension may vary; MP3/M4A/etc are fine)
- Files are delivered as downloadable **packs** and cached for **offline** use (including web via service worker).

> The manifest or filenames must expose the octave (the current `__o-N__v-N` convention is supported), and multiple variants must remain discoverable per chord and octave.

---

## 8) Settings (Single Screen)

- **Unlocked chords:** toggle per chord; reorder (drag) is optional.
- **Adaptive learning:** on/off; occasional no-wink probe turns on/off.
- **Learning status:** current phase, focus friend, usual cue delay, octave range, and recent independent count.
- **Manual level:** caregiver override for the active animal level.
- **Legacy auto unlock:** when adaptive learning is off, configure day streak and daily target attempts.
- **Color/animal mapping:** optional customization; reset-to-default button.
- **Animal looks:** plain friendly animal art only in child feedback. Accessory controls are deferred.
- **Audio packs:** download/delete, show disk usage, “download all for offline.”
- **Notifications:** daily gentle reminders (on/off; select times).
- **Data:** reset progress; export/import simple JSON of progress.

No PIN gate; Settings are a secondary screen reachable via a small gear icon.

---

## 9) Offline Behavior

- Mobile: assets cached locally after first download.
- Web: assets cached via service worker (playable offline once downloaded).
- The app should still **launch and run** (with whatever is cached) when offline.

---

## 10) Minimal Data & Tracking

- Track only what’s needed for unlocking and caregiver feedback:
  - Per completed round: chord id, outcome (`independent`, `assisted`, or `corrected`), scheduled cue delay, first-tap correctness, and timestamp.
  - Daily summary: attempts, first-tap accuracy, and counts for all three outcomes.
  - Adaptive learning phase, cue step, octave-generalization stage, and recent outcomes.
  - Streak count only for the optional legacy auto-unlock mode.
- No accounts/logins required.

---

## 11) Visual/Asset Notes

- Tiles are large, colorful, and tappable; grid expands as more chords unlock.
- Each chord tile shows **color background + animal** icon/illustration.
- Animal images can be generated separately and swapped without code changes (e.g., runtime asset pack).
- Animal illustrations should support a plain/default friendly image for every animal. Corrections should use motion and highlighting, not sadness.
- Accessories are deferred. Any future accessory system should remain inactive until it can generate clean production art without debug anchors, boxes, or runtime fallback complexity.
- Use simple celebratory animations on correct answers; neutral/gentle on mistakes.

---

## 12) Roadmap

- **v1 (Adaptive progression):** prompt fading, retry-until-success correction, one-octave start, mastery-based generalization, manual caregiver override, replay, and offline packs.
- **v2:** refine mastery thresholds from observed child sessions; daily reminders and caregiver visualization.
- **v3 (Stage 3):** chord decomposition and single-note mode.
- **Later:** optional animal accessory looks, implemented only after the image pipeline is production-ready.

---

## 13) Appendix — Audio Pre-Generation Script (separate utility)

A separate script/tool generates the audio packs used by the app.

**Inputs**

- The ordered list of chord labels from §2 (exact spelling).
- A set of octaves/registers to cover (e.g., low/mid/high).
- Number of **variants** per chord per octave (e.g., 8–16).

**Behavior**

- Render each chord across the specified octaves with small natural variations (e.g., slight timing offsets, velocity differences, subtle tuning drift), using an **acoustic piano** sound source.
- Export a **flat list of files** per chord with a simple naming scheme that starts with the chord label, e.g.:
  - `C-E-G__o-mid__v-03.mp3` (the app only relies on the `C-E-G*` prefix).
- Output can be organized into one or more downloadable packs.

**Library suggestions (pick any)**

- Python: `fluidsynth` + an SF2/SFZ piano; or `mido` + external renderer; `pydub` for batch processing.
- JS: Tone.js with offline rendering (for prototyping).
- DAW bounce is fine too (Logic/GarageBand/etc), as long as filenames follow the prefix rule.

---
