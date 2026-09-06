# First-phase protocol and evidence

This version implements parent preparation and the complete fourteen-chord color/animal phase. Individual-note training, expert transition criteria, and AI assessment are deferred. Parents choose the introduced stage, active animals, and whether the newest sound receives a gentle introduction mix. It never promotes a child automatically. Historical adaptive-learning modules remain in the repository for reference; they are not a prescription for the new program.

Practice interaction: tapping Ready plays the first sound. Tapping an animal shows the correct color/animal, then advances after three seconds of feedback and completion of the current audio. This feedback interval is an app interaction choice, not an official progression criterion. Book 2 Q7 (pp. 33–35 in the supplied translation) prescribes consistent chord duration; Q26 (pp. 85–86) describes promptly giving a hesitant child the answer and moving on. Replay, pause, early finish, and a small no-response control remain available; there is no answer timeout. Ready-screen previews mark the upcoming session as having a recent pitch reference. Parent assistance on feedback is an immutable, reversible annotation on the original tap; record summaries exclude assisted answers from unaided recognition and confusion pairs.

## Source-backed core

The supplied Japanese books are the primary method references. English text in the app is newly written instruction, not the supplied machine translation. Page numbers below refer to printed/source pages in the supplied editions, not PDF page numbers.

- **Book 1, The New Absolute Pitch Program**, pp. 134–150, 155–157, 174–175: begin with the red C4–E4–G4 chord; use a consistent piano sound, simultaneous notes of even strength, frequent brief practice, immediate gentle help, and an initial period of approximately two weeks. First-sound performance matters, but one available answer cannot establish discrimination.
- **Book 2, Teaching Absolute Pitch Q&A**, Q20–29, pp. 70–93: four or five sessions, ten presentations at the first one or two chords, at least fifteen minutes between sessions, and no three sessions within one hour. Short sessions are adjusted to the child's condition.
- **Book 3, Absolute Pitch Q&A**, Q24–26, pp. 87–97; Q48, pp. 161–163; Q53, pp. 176–178; Q65, pp. 215–217; Q69, pp. 226–228: pictures can substitute for flags; keep the association stable, avoid relative-pitch clues, rest during illness, stop for distress, and avoid excessive performance-dependent praise.
- [Ichionkai Dr. P](https://ichionkai.co.jp/drp.html): the official service couples home practice with teacher review twice monthly. This app is an independent adaptation, not that supervised service.
- [Sakakibara (2014), longitudinal chord-identification study](https://doi.org/10.1177/0305735612463948): relevant training evidence from a supervised child cohort, not validation of this app, autonomous assessment, or a guaranteed outcome for every child.

## Explicit implementation choices

- Four sessions by default; parents may choose five. Ten recorded presentations with one or two active sounds; thirty with three or more. Stops are recorded separately and never create catch-up debt.
- A three-second held chord, as described in Book 2. Book 1 also describes approximately two seconds. The bundled fixed stimulus has no register, onset, duration, or velocity randomization. The General MIDI piano synthesis is an adaptation, not an Ichionkai recording. The manifest identifies the exact audio bytes used in each trial.
- Fourteen consistently colored animals substitute for flags. New children begin with Red; the parent can introduce every other animal from settings. New sounds occur only a few times among familiar ones (Book 1 pp. 165–167). The exact randomized quotas—two of ten or three of thirty—are app choices, not a numerical prescription from the books. No extra pitched reward sounds, answer countdown, visual cue fading, accuracy threshold, or automatic unlock.
- Routine reminders are at least twenty minutes apart to leave room for a short session plus the fifteen-minute break. The actual session gate uses a fifteen-minute break after finishing and no more than two starts per rolling hour.
- The first check-in becomes due fourteen local calendar days after actual practice begins. Saving a parent check-in schedules the next one fourteen days later and preserves the notes; it does not change the animal plan. This is a practical approximation to twice-monthly teacher reviews. A date becoming due is not a recommendation to advance. Rest days do not disappear from the record.

## Implemented chord phase

The active curriculum, fixed audio, and compatibility chord catalog share the sequence below. English notation is used directly. Color hex values and animal art are UI choices; color names and chord associations are the method reference.

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
| 12 | E4 G♯4 B4 | Lavender |
| 13 | B♭3 D4 F4 | Gray |
| 14 | E♭4 G4 B♭4 | Light blue |

Book 1 pp. 134–140 contains the voicings and color table. The pale purple flag (wisteria) is labeled Lavender in the English interface. Future progression must account for the productive inversion-confusion exceptions in pp. 207–211 and the subsequent individual-note phase, rather than imposing a universal percentage-correct gate.

## Review record contract

An immutable, versioned event history contains parent preparation acknowledgements, optional child age/prior training, parent check-ins, stage and active-set changes, frozen session choices and stimulus plans, routine changes, local dates and time zone, pauses, session boundaries, recent pitch reference, trial order, first-sound flag, response type (correct unaided choice, different unaided choice, helped, or no response), actual selected cue and confusion pair, help, replay count, response latency, exact audio filename and hash, stopping reason, parent observation, and optional note. An independent response in the one-cue phase is participation evidence, not an accuracy or mastery score.

A future reviewer must see missing days and interrupted sessions as well as completed ones. Any AI implementation needs a curated, cited rule set, explicit uncertainty, explainable recommendations, human override, and validation against expert judgments. The full books must not be published in the app or silently uploaded to an AI provider. No assessment is performed by this release.

## Parent reminders and operations

The API has authenticated `/api/foundation/sync`, `/contact`, `/contact/request-code`, `/contact/verify`, `/device`, `/device/remove`, and `/review-record` routes. Contact removal stops email eligibility immediately. A six-digit, ten-minute verification code has a one-minute resend interval and a five-attempt limit. Parent addresses are separate from Auth0 account addresses. Preparation and all reminder categories must be explicitly enabled before delivery.

Set `EGUCHI_REMINDERS_ENABLED=true`, `POSTMARK_API_TOKEN`, and `POSTMARK_FROM_EMAIL`. `POSTMARK_FROM_NAME` (use Eguchi Ears) and `POSTMARK_MESSAGE_STREAM` are optional. These follow Reminder Manager's existing Postmark configuration; never copy its database or unrelated credentials. `EXPO_ACCESS_TOKEN` is optional when Expo push security is enabled. Native remote pushes additionally require APNs/FCM credentials for the app; Expo provider tickets alone are not delivery proof.

A sixty-second backend worker records due deliveries in a durable outbox. Unique keys prevent repeat daily slots and repeat review reminders, including across workers and restarts. Delivery rechecks current opt-ins, verified recipient, device ownership, daily completion, rest days, and practice spacing. Daily reminders are eligible within fifteen minutes of their scheduled time, so a restart does not emit an old backlog. Email uses one daily digest; remote push uses the practice routine. Review notifications are sent once, during daytime, after the check-in becomes due. In-app notifications may be based on more recent offline practice than the server has received.

Explicit provider rate limits retry with bounded backoff. Network timeouts and abandoned delivery leases are marked unknown rather than blindly resent. Push receipts are checked; invalid device tokens are retired. Logs contain neither addresses nor tokens. The health endpoint reports configuration and worker enablement, not successful end-to-end delivery. Monitor `foundation_deliveries.status` and `failure` for delivery problems; `accepted` means provider acceptance. Turning the worker off stops all scheduled remote sends.

## Current parent and child experience

The app opens with parent preparation. Three short setup steps, with a visual play–respond–help guide, cover the routine, sound setup, response handling, child comfort, and review expectations. Extra detail is available in expandable guide sections. The sound lesson requires an actual successful playback. Parents can optionally record the child's current age and prior training without providing a name or date of birth. The guide remains available offline.

The home screen shows completed and remaining sessions, spacing, rest-day control, and the review date. Practice records ten or thirty presentations, according to the active set, and requires successful audio before accepting a response. Leaving the foreground stops the session; reopening keeps the responses and records an interruption without inventing an observation. Account sync is offline-first and retry-safe. A parent explicitly imports guest practice into an account; the app never silently assigns it to whichever account signs in next.

Native notification permission is requested only when a parent enables a device reminder. iOS builds enable remote push with `extra.remotePushEnabled=true`, `extra.remotePushPlatforms=["ios"]`, a production APNs entitlement, and an EAS-managed Apple push key. The backend also requires `EGUCHI_REMOTE_PUSH_ENABLED=true`. A signed-in physical device registers only after permission and an explicit reminder opt-in. Android retains local scheduling until its FCM credentials are configured and it is added to the platform list. The optional config plugin removes the APNs entitlement for local-only iOS builds. Configuration and a valid signed build do not prove delivery to a real device. Guests and devices without remote registration use seven days of local practice reminders plus the future review reminder, within the iOS pending-notification limit. Opening the app refreshes that rolling schedule and cancels reminders for completed or paused days. Web users can enable email after signing in. Device notifications are not offered as a web capability.

### Artwork and light interface

The app, including login, navigation, and native appearance, is light-only. Parent instructions use three short steps and a play → respond → help diagram; details remain in expandable questions. No original book scans or full translations are bundled.

Animal art lives in `frontend/assets/images/eguchi/foundation/`. Five characters were replaced to make the color associations and silhouettes clearer: black cat, pink flamingo, brown bear, peach pig, and lavender butterfly. Red fox, green frog, light-green parrot, gray seal, and light-blue fish use recolored artwork. Yellow chick, blue whale, orange tiger, and purple octopus retain their original art. White card backgrounds are intentional. The original artwork remains intact. [Replacement artwork and exact prompts](artwork/animals-2026-09-06.md) document the built-in image-generation inputs. The animal choices are app adaptations, not prescribed species.

The edit prompt template was: “Precise-object-edit for a preschool Eguchi listening app. Preserve this exact friendly [animal] character, big eyes, facial expression, proportions, pose, complete silhouette, and soft clean illustrated style. Change its main coloring to [official cue color]. Color is a learning cue so it must be unmistakable. Keep eyes and pupils natural. Place the entire character, centered with comfortable margins, on a perfectly solid pure white #FFFFFF square background. No checkerboard, no pattern, no gradient background, no floor shadow, no text, no watermark. Make only the color change and plain white backdrop; do not add objects or extra characters.” The fox required a second background-only correction. Each result was visually inspected before inclusion.

### Validation scope

Automated checks cover exact MIDI voicings, simultaneous attacks, equal velocity, duration and audio hashes for all fourteen sounds; full-set practice and recorded confusions; save retries, interruptions, account isolation and offline sync; calendar/DST scheduling, recurring check-ins, verification, opt-outs and provider failure handling. Native iPad and rendered web checks are recorded separately from automated results. Real email and remote push delivery require an opted-in recipient/device and are not inferred from unit tests or health checks.
