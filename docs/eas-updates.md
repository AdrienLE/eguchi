# Wireless iPad updates

EAS Update delivers compatible JavaScript and assets to the installed app.
It uses the existing Expo project `@adrienle/eguchi-ear-trainer`. Native builds
continue to use the cached local Xcode builder; cloud builds are not required.

## One-time installation

Build and install a new Release app containing `expo-updates`:

```bash
cd frontend
yarn build:ios:production
```

Install `frontend/builds/eguchi-ios-fast.ipa` on the registered iPad with Xcode or
Apple Configurator. An older installation cannot gain the updater through a
Railway deployment. Keep the same app identifier and install over the old app;
do not delete the app and its local practice data.

The built app's `Expo.plist` must enable updates, point to
`https://u.expo.dev/5a909b9d-6999-431c-ab81-a53187d7575a`, and use the
`production` channel. Its resolved runtime must match the corresponding update.

## Routine releases

1. Run the relevant tests, review the changes, and commit them.
2. From `frontend`, run `yarn update:check` to export iOS locally and print its
   runtime fingerprint. This does not publish or overwrite the web export.
3. Run `yarn update:ios --message "Describe the change"`.
4. Open the iPad app while online. It downloads in the background. Close and
   reopen it after downloading to apply the update (up to two cold launches).

The helper refuses to publish uncommitted changes and always bundles fresh code.
It defaults the release message to the latest commit if no message is supplied.
Exported files and EAS update metadata are kept in ignored `frontend/builds/updates/`.
Use the EAS dashboard's update group details to inspect delivery or republish a
previous compatible update when recovering from a bad release.

Startup never waits for the network (`fallbackToCacheTimeout: 0`) and no code
calls `reloadAsync` during practice. The installed/cached version remains usable
when offline. An update still needs an internet connection to download.

Railway continues to serve the web app and API. Publish to EAS as well when a
deployment includes native-app JavaScript/content changes. A backend-only change
needs only Railway; an EAS update does not deploy Python/backend code.

## Native compatibility and configuration

- `runtimeVersion.policy` is `fingerprint`. Native configuration/dependency
  changes create a different runtime, requiring a new native build. Do not
  override the fingerprint to force an incompatible update onto an old build.
- Generated `ios/` stays ignored. Put native changes in app config or Expo
  plugins so both build and update resolve the same native inputs.
- `app.config.js` selects the channel using `EAS_BUILD_PROFILE`. The fast builder
  and publisher set that profile explicitly; ordinary builds default to production.
- `production`, `production-simulator`, and `app-store` use `production`;
  `staging` uses `staging`. Development clients are not publish targets.
- The publisher loads public values from `eas.json`, matching the local native
  build, ignores inherited `EXPO_PUBLIC_*` overrides, and disables local dotenv.
  Do not put secrets in public values. If building a custom API variant, give it
  its own profile/channel before publishing to it.
- This project uses Expo SDK 53. The publisher intentionally omits EAS Update's
  `--environment`, which would instead load server-defined values. When upgrading
  to SDK 55+, migrate both native build and update to the same EAS environment
  because that flag becomes required.
- OTA does not renew Apple provisioning/signing or install native libraries.

Use `python3 scripts/publish_update.py --profile staging --platform ios` for a
configured staging build. EAS CLI must be installed and signed into an account
with access to this project (`eas whoami`, `eas project:info`).

References: [Expo setup](https://docs.expo.dev/eas-update/getting-started/),
[runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/),
[standalone local builds](https://docs.expo.dev/eas-update/standalone-service/).
