# First-phase protocol and evidence

This version implements parent preparation and the initial red-chord phase. It does not implement the complete Eguchi curriculum, teacher review, or an AI assessment. It never promotes a child automatically. Historical adaptive-learning modules remain in the repository for reference; they are not a prescription for the new program.

## Source-backed core

The supplied Japanese books are the primary method references. English text in the app is newly written instruction, not the supplied machine translation. Page numbers below refer to printed/source pages in the supplied editions, not PDF page numbers.

- **Book 1, The New Absolute Pitch Program**, pp. 134–150, 155–157, 174–175: begin with the red C4–E4–G4 chord; use a consistent piano sound, simultaneous notes of even strength, frequent brief practice, immediate gentle help, and an initial period of approximately two weeks. First-sound performance matters, but one available answer cannot establish discrimination.
- **Book 2, Teaching Absolute Pitch Q&A**, Q20–29, pp. 70–93: four or five sessions, ten presentations at the first one or two chords, at least fifteen minutes between sessions, and no three sessions within one hour. Short sessions are adjusted to the child's condition.
- **Book 3, Absolute Pitch Q&A**, Q24–26, pp. 87–97; Q48, pp. 161–163; Q53, pp. 176–178; Q65, pp. 215–217; Q69, pp. 226–228: pictures can substitute for flags; keep the association stable, avoid relative-pitch clues, rest during illness, stop for distress, and avoid excessive performance-dependent praise.
- [Ichionkai Dr. P](https://ichionkai.co.jp/drp.html): the official service couples home practice with teacher review twice monthly. This app is an independent adaptation, not that supervised service.
- [Sakakibara (2014), longitudinal chord-identification study](https://doi.org/10.1177/0305735612463948): relevant training evidence from a supervised child cohort, not validation of this app, autonomous assessment, or a guaranteed outcome for every child.

## Explicit implementation choices

- Four sessions by default; parents may choose five. Ten recorded presentations in a full initial session. Stops are recorded separately and never create catch-up debt.
- A three-second held chord, as described in Book 2. Book 1 also describes approximately two seconds. The bundled fixed stimulus has no register, onset, duration, or velocity randomization. The General MIDI piano synthesis is an adaptation, not an Ichionkai recording. The manifest identifies the exact audio bytes used in each trial.
- The red fox substitutes for the red flag. Only this cue is exposed in the first phase. No extra pitched reward sounds, answer countdown, visual cue fading, accuracy threshold, or automatic unlock.
- Routine reminders are at least twenty minutes apart to leave room for a short session plus the fifteen-minute break. The actual session gate uses a fifteen-minute break after finishing and no more than two starts per rolling hour.
- Review becomes due fourteen local calendar days after the first recorded presentation. This is a practical approximation to twice-monthly teacher reviews. A date becoming due is not a recommendation to advance. Rest days do not disappear from the record.

## Later curriculum reference — not yet available

The sequence below is recorded to prevent the old app's arbitrary ordering and colors from being reused. English notation is used directly. Color hex values and animal art are UI choices; color names and chord associations are the method reference.

| Order | Notes, low to high | Color |
| --- | --- | --- |
| 1 | C4 E4 G4 | Red |
| 2 | C4 F4 A4 | Yellow |
| 3 | B3 D4 G4 | Blue |
| 4 | A3 C4 F4 | Black |
| 5 | D4 G4 B4 | Green |
| 6 | E4 G4 C5 | Orange |
| 7 | F4 A4 C5 | Purple |
| 8 | G4 B4 D5 | Pink |
| 9 | G4 C5 E5 | Brown |
| 10 | A3 C♯4 E4 | Light green |
| 11 | D4 F♯4 A4 | Peach |
| 12 | E4 G♯4 B4 | Wisteria |
| 13 | B♭3 D4 F4 | Gray |
| 14 | E♭4 G4 B♭4 | Light blue |

Book 1 pp. 134–140 contains the voicings and color table. Future progression must account for the productive inversion-confusion exceptions in pp. 207–211 and the subsequent individual-note phase, rather than imposing a universal percentage-correct gate.

## Review record contract

An immutable, versioned event history contains parent preparation acknowledgements, routine changes, local dates and time zone, pauses, session boundaries, recent pitch reference, trial order, first-sound flag, response type, selected cue, help, replay count, response latency, exact audio filename and hash, stopping reason, parent observation, and optional note. An independent response in the one-cue phase is participation evidence, not an accuracy or mastery score.

A future reviewer must see missing days and interrupted sessions as well as completed ones. Any AI implementation needs a curated, cited rule set, explicit uncertainty, explainable recommendations, human override, and validation against expert judgments. The full books must not be published in the app or silently uploaded to an AI provider. No assessment is performed by this release.

## Parent reminders and operations

The API has authenticated `/api/foundation/sync`, `/contact`, `/contact/request-code`, `/contact/verify`, `/device`, `/device/remove`, and `/review-record` routes. Contact removal stops email eligibility immediately. A six-digit, ten-minute verification code has a one-minute resend interval and a five-attempt limit. Parent addresses are separate from Auth0 account addresses. Preparation and all reminder categories must be explicitly enabled before delivery.

Set `EGUCHI_REMINDERS_ENABLED=true`, `POSTMARK_API_TOKEN`, and `POSTMARK_FROM_EMAIL`. `POSTMARK_FROM_NAME` (use Eguchi Ears) and `POSTMARK_MESSAGE_STREAM` are optional. These follow Reminder Manager's existing Postmark configuration; never copy its database or unrelated credentials. `EXPO_ACCESS_TOKEN` is optional when Expo push security is enabled. Native remote pushes additionally require APNs/FCM credentials for the app; Expo provider tickets alone are not delivery proof.

A sixty-second backend worker records due deliveries in a durable outbox. Unique keys prevent repeat daily slots and repeat review reminders, including across workers and restarts. Delivery rechecks current opt-ins, verified recipient, device ownership, daily completion, rest days, and practice spacing. Daily reminders are eligible within fifteen minutes of their scheduled time, so a restart does not emit an old backlog. Email uses one daily digest; remote push uses the practice routine. Review notifications are sent once, during daytime, after the check-in becomes due. In-app notifications may be based on more recent offline practice than the server has received.

Explicit provider rate limits retry with bounded backoff. Network timeouts and abandoned delivery leases are marked unknown rather than blindly resent. Push receipts are checked; invalid device tokens are retired. Logs contain neither addresses nor tokens. The health endpoint reports configuration and worker enablement, not successful end-to-end delivery. Monitor `foundation_deliveries.status` and `failure` for delivery problems; `accepted` means provider acceptance. Turning the worker off stops all scheduled remote sends.
