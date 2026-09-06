# Chord-phase foundation validation

Application commit: `dab891e` (with earlier protocol, backend, curriculum, and iOS entitlement commits). Documentation-only follow-ups do not change the deployed application.

## Automated and build checks

- Frontend: 231 tests in 38 suites passed, including full fourteen-animal practice, first incorrect choices, save retries, manual progression, short settings sections, offline sync/account isolation, recurrence, local reminder plans, and the actual Expo prebuild entitlement chain.
- Backend and tooling: 179 tests passed. One existing HTTPX deprecation warning remains.
- TypeScript and Expo lint passed. Changed frontend code passes Prettier; changed Python code passes Black; git diff whitespace check passed.
- Fourteen actual MIDI files verified against independently enumerated pitches, simultaneous attacks, equal velocity, and three-second note holds. Corresponding MP3 hashes verified.
- Native iPad Release build passed. Signed ad hoc IPA passed the existing builder's signature/profile checks. The IPA contains the final sectioned settings and save-retry UI; Info.plist enforces Light appearance.
- Final IPA: `frontend/builds/eguchi-ios-fast.ipa`, 98.4 MB, SHA-256 `7f9a8a6432d000e360f5a33f402f7fc5fec12ef2de0bfd105fff59c83ef969a9`. It was not uploaded to Diawi.

## Rendered checks

On an iPad A16 simulator running iOS 26.5, tested the three-step parent preparation including real native playback; selecting and saving all fourteen animals; portrait and landscape full-choice grids; successful playback and replay; a Blue-heard/Red-chosen correction; a helped Light-blue presentation; early stopping; saved confusion pairs, help/replay counts, and no invented parent observation; and the enforced fifteen-minute break with remaining-today count. All animals fit the practice area in both orientations. The final native reminder settings render as a short standalone section.

The simulator automation could not operate the native switch control (its accessibility bridge closed), so native permission presentation and actual local notification delivery were not verified. Scheduling and opt-in behavior are covered by automated tests. No notification was sent to a physical device.

Web checks covered the colorful fourteen-animal introduction, all three preparation steps, successful sound check, manual selection and saving of the complete set, and the daily plan. The deployed home page renders the final animal colors; its browser error log is empty.

## Production and activation

Railway deployment `14139583-bff4-4320-8ca7-c058e704e950` succeeded for `eguchi-api` in project `0a8030ad-0fc9-4029-b638-5361c0696c73`. The source snapshot excluded local environment and signing files. Production `/health` reports foundation protocol `eguchi-foundation-1`, database connected, parent email not configured, and parent reminders disabled. The web page returns 200; unauthenticated parent contact and record endpoints return 401.

Reminder Manager's existing Postmark token was verified through its read-only server endpoint (HTTP 200). No email was sent and no token was displayed or copied into Eguchi.

Two operational actions await explicit approval after automatic approval review rejected them:

1. Copy only `POSTMARK_API_TOKEN`, `POSTMARK_FROM_EMAIL`, and `POSTMARK_MESSAGE_STREAM` from Reminder Manager into the Eguchi Railway service; set `POSTMARK_FROM_NAME=Eguchi Ears` and enable `EGUCHI_REMINDERS_ENABLED`. This grants Eguchi email-delivery access and enables reminders for verified, opted-in parents.
2. Inspect/configure Eguchi's EAS/APNs credentials and obtain a compatible ad hoc provisioning profile before enabling remote push. The current local profile has no APNs entitlement. Native local reminders do not require that capability. Android remote delivery similarly requires FCM credentials.

Keep `extra.remotePushEnabled=false` and `EGUCHI_REMOTE_PUSH_ENABLED=false` until remote credentials and delivery are verified. A provider ticket or configuration health flag is not proof of recipient/device delivery.

Automatic transition criteria, AI assessment, and the later individual-note curriculum are deliberately deferred. Manual parent stage, active-animal selection, practice observations, and recurring check-ins are implemented.
