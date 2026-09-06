# Chord-phase foundation validation

Initial September 5 application commit: `dab891e` (with earlier protocol, backend, curriculum, and iOS entitlement commits). See the September 6 update below for the current deployment and reminder activation. Documentation-only follow-ups do not change the deployed application.

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

At the September 5 checkpoint, two operational actions awaited explicit approval after automatic approval review rejected them. The user subsequently approved both on September 6:

1. Copy only `POSTMARK_API_TOKEN`, `POSTMARK_FROM_EMAIL`, and `POSTMARK_MESSAGE_STREAM` from Reminder Manager into the Eguchi Railway service; set `POSTMARK_FROM_NAME=Eguchi Ears` and enable `EGUCHI_REMINDERS_ENABLED`. This grants Eguchi email-delivery access and enables reminders for verified, opted-in parents.
2. Inspect/configure Eguchi's EAS/APNs credentials and obtain a compatible ad hoc provisioning profile before enabling remote push. The current local profile has no APNs entitlement. Native local reminders do not require that capability. Android remote delivery similarly requires FCM credentials.

The September 5 build kept `extra.remotePushEnabled=false` and `EGUCHI_REMOTE_PUSH_ENABLED=false`. The September 6 configuration below enables provisioned iOS push; a provider ticket or configuration health flag remains distinct from recipient/device delivery.

Automatic transition criteria, AI assessment, and the later individual-note curriculum are deliberately deferred. Manual parent stage, active-animal selection, practice observations, and recurring check-ins are implemented.

## September 6: animal identities and authorized reminder activation

Application commits: `a70dd1d` (animal identities) and `3ebd773` (iOS push configuration and fallback coverage).

- Replaced black turtle with black cat, pink bunny with pink flamingo, brown lion with brown bear, peach crab with peach pig, and lavender bird with lavender butterfly. The fourteen prescribed color/chord associations and audio remain unchanged. Canonical names, accessibility labels, bundled art, and compatibility reaction/fallback assets use the new species. [Exact built-in image-generation prompts and asset paths](../artwork/animals-2026-09-06.md).
- All 240 frontend tests in 39 suites pass. TypeScript, Expo lint, and changed-file formatting pass. The 74 relevant backend/reminder/build tests pass. Coverage includes iOS remote registration, Android/guest/simulator local fallback, duplicate prevention during outages, permissions/opt-ins, and actual Expo prebuild entitlements in remote and local-only modes.
- Native iPad A16 Release build passed. The new animal art was checked in the full fourteen-choice grid in both portrait and landscape, including successful native playback, selecting Lavender Butterfly, corrective Light blue feedback, and saving the stopped practice session. Web selection and the deployed introduction/reminder settings render correctly, with no browser error logs.
- Railway deployment `2425a23c-1351-4b8a-a38f-d5c70ceb9bd5` succeeded from `3ebd773`. Its source snapshot excluded local environment and signing files. Production health returns 200 with parent email configured and the reminder worker enabled. `EGUCHI_REMOTE_PUSH_ENABLED=true` is verified. Parent contact and record endpoints still return 401 without authentication. No reminder-worker failures appeared in deployment logs during validation.
- Copied only Postmark token, sender address, and message stream from Reminder Manager; set the Eguchi sender display name and enabled the reminder worker. Values were never printed or committed. The actual Eguchi mailer received provider acceptance for message `9cdaed38-90d5-46e7-bfa8-dc0e23cb467e` sent to [Postmark's designated test sink](https://postmarkapp.com/support/article/1213-best-practices-for-testing-your-emails-through-postmark). That check validates the mailer/provider configuration; it does not prove inbox delivery or turn on a parent's notification preferences.
- Created and assigned an EAS-managed Apple push key to `com.eguchi.app`, enabled its Apple Push Notifications capability, and regenerated/downloaded the ad hoc provisioning profile. The profile has `aps-environment=production`, covers the paired iPad and the two existing iPhones, and expires August 16, 2027. Local signing files and a backup remain ignored. Only iOS is listed in `remotePushPlatforms`; Android keeps local scheduling until FCM setup.
- Final signed IPA: `frontend/builds/eguchi-ios-fast.ipa`, 103,599,235 bytes, SHA-256 `f54b896f2c27ba2886f7c475b3b72ccd6b0529d7ccf2e2a2d66966cf787a6852`. The fast builder completed in 242 seconds, verified the production APNs entitlement against the profile and actual signature, and verified the signed archive. All five new animal assets were independently matched byte-for-byte inside the IPA. Light appearance is enforced. This artifact has not been uploaded to Diawi.
- Physical notification delivery remains unverified. Installing the final IPA on the paired iPad was attempted with a thirty-second timeout and rejected by CoreDevice because the device was still locked. No installation completed. Installing/opening the new build, signing in, and opting into device notifications are required for the end-to-end check. Activation does not silently opt parents in.
