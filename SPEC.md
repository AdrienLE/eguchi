# Eguchi Ear Trainer — current product specification

An iPad-first, light-only program for families practicing together without access to Japanese teaching materials. This independent adaptation supports the entire fourteen-chord color/animal phase. The source-backed decisions and exact voicing table are in [the foundation protocol](docs/eguchi-foundation.md).

## Preparation and daily practice

Parents complete three short preparation steps before practice: the brief, frequent routine; a real sound check and gentle response handling; and child comfort/check-ins. A play → respond → help diagram explains the loop. Additional guidance is expandable. New children begin with Red, while the introduction describes the entire journey through colors and animals.

The home screen shows completed sessions, how many remain today, earliest next practice, rest-day control, current animals, and next check-in. Default routine: four sessions; parents may choose five. Leave at least fifteen minutes after a session and allow no more than two session starts within an hour. Missed days never create catch-up debt.

A session has ten presentations for one or two active sounds, thirty thereafter. Parents can stop early. Record actual first choices, help, no response, replays, interruptions, and optional observations. A single possible answer measures participation only. Incorrect choices receive immediate gentle help and a corrective replay; no harsh feedback, relative-pitch hints, score, or pitched reward.

## Curriculum and audio

`frontend/lib/foundation/curriculum.ts` is the canonical ordered set of fourteen chords, fixed pitches, color names, and animal assignments. All are available through parent settings. Colors and animal identities remain stable. English notes use B♭ and E♭ directly.

Parents select the introduced stage, choose active animals from that stage, and choose a gentle introduction mix or an even familiar mix. New sounds appear a few times among familiar sounds. These manual controls do not claim to determine readiness. Automatic transition criteria, AI assessments, and later individual-note training are not implemented.

Each chord has one bundled piano stimulus: fixed voicing, simultaneous equal-strength attacks, three-second hold, and natural release. No randomized register, tuning, note onset, or velocity. The synthesizer is an app adaptation. Audio manifests preserve exact hashes for later review. Native audio and parent guidance work offline; the web build requires loading its assets online and does not promise an installed offline PWA.

## Parent records and reminders

An immutable per-account event history preserves preparation, optional child age/prior training, preferences, stage and active set, frozen stimulus plans, first-sound flags, choices, latency, help, exact audio, stopping reasons, and notes. It saves locally before acknowledging an action and retries account sync safely. Guest records are imported into accounts only explicitly. Export is available as JSON.

The first parent check-in is due fourteen local calendar days after actual practice starts. Saving a check-in preserves the note and schedules another in fourteen days. It neither performs an AI assessment nor changes the animal plan.

Parents can sign in and verify a separate email address. Daily email, check-in email, daily device notifications, and check-in device notifications have independent opt-ins. Daily emails summarize what remains; device reminders follow the chosen times. Reminders respect completion, rest days, and spacing. Email runs through the backend's durable Postmark outbox. Native local notifications are available without an account. Remote push code is present but requires explicit configuration of app-specific APNs/FCM credentials and a compatible profile.

## Interface and validation

Use light surfaces, colorful animal cues, large tap targets, concise parent copy, and diagrams. All active animals must fit the iPad practice grid in portrait and landscape. Parent controls are kept outside the primary choice grid.

Validate audio content, response integrity, recurrence, sync and account isolation, opt-ins, provider failures, and native iPad layout/playback. Production configuration and provider acceptance are distinct from verified recipient/device delivery. Legacy adaptive modules remain for reference, are not reachable from the new training flow, and are not official method prescriptions.
