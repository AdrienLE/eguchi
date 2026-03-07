# Eguchi Ear-Training — Plan

This app teaches absolute pitch to young children using the **Eguchi method** (chord-first training with color/character cues, short frequent sessions, mastery-based progression). Audio is **pre-generated** chord files (multiple variants per chord, across multiple octaves). The app runs on a React Native + Expo codebase and should work **offline** (including web via caching). Web should need **minimal special casing**.

---

## 1) Method (Eguchi) — Working Principles

- **Unit of learning = a chord “sound object.”** Each target chord is treated as its own category with a fixed **color + animal** cue. Children identify the chord by tapping its tile; no pitch names are shown to the child.
- **Chord-first → note-level later.** Start with a small set of chord categories; after full mastery of the chord set, add a separate “Stage 3” mode to decompose chords into single notes and test single-note identification.
- **Multiple octaves & natural variation.** Chords are played in different registers and with small natural variations so children learn the chord identity, not a single sample.
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
- On launch, immediately **play** a random chord from the **unlocked** set.
- Show **one large grid** of tiles (one tile per unlocked chord). Each tile displays:
  - Background **color** (from the mapping).
  - A cute **animal** icon/emoji/illustration matching that chord.
- **Replay** button to replay the current chord (optional limit, e.g., up to 2 replays).
- **Accessory variety:** each animal can also have a matching set of accessory variants (for example top hat, bow tie, flower crown, glasses, scarf). The child can shuffle these looks without changing the chord mapping.
- The child **taps** a tile to answer.
  - **Correct:** brief positive sound; animate the tile (animal smiles/happy).
  - **Incorrect:** show which tile was correct (e.g., pulse/shine), optionally show the correct animal with a sad-to-happy transition; then continue.

**Trial loop:** After feedback, automatically proceed to the next trial and **play** a new random chord.

### 3.2 Simplicity
- No menus before training starts.
- No text is required for the child to operate the app.

---

## 4) Stimulus Selection (Simple & Random)

- **Chord choice:** Uniform random among **unlocked** chord categories.
- **Variant choice:** Uniform random among all available audio files for that chord (see §7).
- **Octaves/variation** are handled implicitly by the audio files; the app doesn’t need to understand them.

> Keep it simple. No weighting or adaptive scheduling in v1. (See Roadmap.)

---

## 5) Progression & Unlocking

- **Start with 2 chords unlocked** (default: 1: C-E-G, 2: F-A-C). This default can be changed in Settings.
- **Manual mode (v1):** Caregiver can unlock/lock any chord at any time.
- **Auto mode (v2+):** When enabled, the app unlocks the next chord after a **streak of perfect days** on the current set.
  - **Default threshold:** 7 consecutive days with 100% correct across the day’s attempts.
  - Both **streak length** and **daily attempt target** are configurable in Settings.
  - If any error occurs on a day, that day doesn’t count toward the streak.

> The UI can show a tiny progress bar / “days to next unlock” counter for caregivers (not prominent for the child).

---

## 6) Stage 3 (Later Feature)

Add a separate **Stage 3** mode after the main chord set is mastered:
- **Chord decomposition:** After the child identifies the chord, optionally play and ask for the individual notes (still using colors/animals or a simplified UI).
- **Single-note mode:** Play single notes (broad keyboard range) and show a different tile set appropriate to note IDs.
- Stage 3 is **off** by default and can be enabled in Settings.

---

## 7) Audio Content (Assumptions the App Makes)

- For each chord category in §2, there will be **multiple audio files**, representing different octaves and natural variations. The app doesn’t know the details; it just needs to **find and pick** from them.
- **Discovery pattern:** the app can load all files whose names begin with the chord label, e.g.:
  - `C-E-G*.mp3`, `F-A-C*.mp3`, `G-B-D*.mp3`, … (exact extension may vary; MP3/M4A/etc are fine)
- Files are delivered as downloadable **packs** and cached for **offline** use (including web via service worker).

> The agent implementing the app can choose any straightforward packaging (e.g., a manifest or directory scan). The **only requirement** is that multiple files exist per chord and are discoverable by a simple name pattern per chord label.

---

## 8) Settings (Single Screen)

- **Unlocked chords:** toggle per chord; reorder (drag) is optional.
- **Start set:** pick the initial 2 chords (defaults provided).
- **Auto unlock:** on/off; configure streak length (e.g., 3–14 days) and daily target attempts.
- **Color/animal mapping:** optional customization; reset-to-default button.
- **Animal looks:** caregiver can force plain/default animals, or allow the child-facing screen to shuffle accessory variants and reset back to plain animals.
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

- Track only what’s needed for unlocking and basic feedback:
  - Per trial: chord id, correct/incorrect, timestamp.
  - Daily summary: attempts, accuracy.
  - Streak count (for auto-unlock).
- No accounts/logins required.

---

## 11) Visual/Asset Notes

- Tiles are large, colorful, and tappable; grid expands as more chords unlock.
- Each chord tile shows **color background + animal** icon/illustration.
- Animal images can be generated separately and swapped without code changes (e.g., runtime asset pack).
- Animal illustrations should support a plain/default set plus multiple consistent accessory variants for every animal, with matching happy and sad versions for each chosen look.
- Use simple celebratory animations on correct answers; neutral/gentle on mistakes.

---

## 12) Roadmap

- **v1 (Manual progression):** random chord selection within unlocked set; replay button; Settings with unlock toggles; offline packs.
- **v2 (Auto progression):** streak-based unlock; daily reminders; simple progress visualization.
- **v3 (Stage 3):** chord decomposition and single-note mode.

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
