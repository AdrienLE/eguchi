# Eguchi Ear Trainer

An iPad-first, local-first ear trainer for chord recognition practice.

## Product Spec

- Primary spec: [`SPEC.md`](SPEC.md)

Please review the spec before starting implementation work; note open questions inline (look for `TODO` callouts) to capture any clarifications.

## Getting Started

### Prerequisites
- Node.js 18+
- Yarn or npm
- Expo CLI
- Python 3.8+ (for backend)

### Installation

1. Install frontend dependencies:
```bash
cd frontend
yarn install
```

2. Install backend dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4. Production builds default to `https://eguchi-api-production.up.railway.app`. Override with `EXPO_PUBLIC_API_URL_PRODUCTION` when needed.

### Development

1. Start the backend:
```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

2. Start the frontend:
```bash
cd frontend
yarn start
```

### Web debug preview

Start `cd frontend && yarn web --port 8081`, then open
`http://localhost:8081/?debug=True`. Expand **Debug tools** at the top to move to
the previous/next animal level, unlock all fourteen animals, open parent
preparation, or reset the debug record. Preparation, daily limits, rest days, and
session spacing do not block debug practice. Changing levels during a session
returns to the daily plan so the old session retains its original animal choices.

Debug practice uses a separate local record and never signs in, syncs, or sends
reminders. The flag follows internal navigation and survives refresh. **Exit debug
mode** returns to the normal record; removing the flag and reloading does the same.
This URL mode is web-only and is not a curriculum advancement rule.

## Configuration

This app uses a centralized configuration system. Main configuration files:

- `frontend/lib/app-config.ts` - Main app configuration
- `.env.local` - Environment variables
- `frontend/app.json` - Expo configuration

## Features

- Complete fourteen-chord color/animal phase, with fixed English voicings and prescribed color order.
- Three short parent preparation steps, visual practice instructions, and an offline parent guide.
- Manual stage/active-animal settings; automatic advancement and AI assessment remain deferred.
- Four or five brief daily sessions, remaining-today count, spacing, rest days, and recurring parent check-ins.
- Local-first practice history with optional authenticated backup, separate verified parent email, and per-category reminders.
- Light-only interface on every platform. Native reminders work locally; remote push requires app-specific provisioning and credentials.

See [method evidence and operational configuration](docs/eguchi-foundation.md).

## Customization

See `BASE_APP_CUSTOMIZATION_GUIDE.md` for detailed customization instructions.

## Deployment

### Frontend (Web)
```bash
cd frontend
yarn build:web
```

### Mobile Apps

For routine iPad UI/content changes, use **EAS Update** after installing an
update-enabled native build once:

```bash
cd frontend
yarn update:check                         # Local iOS export; publishes nothing
yarn update:ios --message "Improve practice controls"
```

Commit and test before publishing. Updates use the production profile's API/auth
configuration and download when the app starts; they apply on a subsequent cold
launch. They never force a restart during practice. A native dependency, permission,
or Expo SDK change needs a new native build. Expo's fingerprint policy keeps
incompatible updates away from older installed builds.

The web/backend Railway deployment and native EAS Update are separate release
steps. See [Wireless iPad updates](docs/eas-updates.md) for first installation,
verification, channels, and recovery.

Production iOS builds use the same persistent local build approach as hue-2 and
House Lights. On macOS, install Xcode, Python 3.11+, frontend dependencies, and
CocoaPods (the builder prefers `/opt/homebrew/bin/pod`). Download the existing
internal-distribution credentials once:

```bash
cd frontend
eas credentials --platform ios
# Select production, then credentials.json -> download credentials from EAS.
yarn build:ios:production
```

`frontend/credentials.json` and its downloaded signing files stay ignored. An
alternative credentials file can be selected with `--credentials PATH` or
`EGUCHI_IOS_CREDENTIALS`; paths inside credentials.json are relative to `frontend`,
as with EAS. Existing `frontend/.signing/credentials.json` takes precedence.

The verified, signed IPA is written to `frontend/builds/eguchi-ios-fast.ipa`.
The provisioning profile must include the devices that will install it.

From the repository root:

```bash
./scripts/build-prod.sh ios
./scripts/build-prod.sh ios https://your-api.example.com
./scripts/build-ios-ipa-fast.sh --build-number 2

# Validate a device Release build without signing credentials (not installable).
./scripts/build-ios-ipa-fast.sh --archive-only

# Force native configuration or Pods to refresh in place.
./scripts/build-ios-ipa-fast.sh --prepare-only --refresh-native --install-pods

# Fall back to a fresh local EAS build.
./scripts/build-prod.sh ios --eas-build

# Android continues to use EAS.
./scripts/build-prod.sh android
```

The first build generates the native project and compiles dependencies. Later
builds reuse `frontend/ios/`, Pods, and `frontend/builds/native-cache/`. The builder
uses an incremental Xcode Release `install` action and packages its output as an
archive for export, preserving compiled intermediates between runs. JavaScript
is bundled on every build. Failed builds never replace the last verified IPA.

Changes to dependencies, the Yarn lockfile, Expo configuration, or configured
`nativeInputs` trigger an in-place prebuild; ordinary JavaScript edits do not.
Add custom native inputs to `frontend/ios-fast-build.json` when adding plugins or
assets referenced by Expo configuration. Native source customizations should
live in Expo config plugins because generated `ios/` is ignored. In-place
prebuild does not remove every change from a deleted plugin; removing native
plugins may require deliberate regeneration after preserving any local work.

Public environment values come from the selected `frontend/eas.json` profile;
explicit shell values take precedence, and `--api-url` overrides the selected
environment's API URL. Local dotenv files are disabled for release builds.
The default profile is `production`; development clients, simulator profiles,
and App Store distribution still use EAS. From `frontend`, `yarn build:ios:eas`
uses local EAS and `yarn build:ios:cloud` uses the original cloud build.

Build logs are in `frontend/builds/native-cache/` (`expo-prebuild.log`,
`pod-install.log`, `xcode-archive.log`, and `xcode-export.log`). Run
`python3 -m pytest tests/test_ios_fast_build.py` to test the build tooling.

### Diawi distribution

Set `DIAWI_TOKEN` in your local shell, or save the token in the ignored file
`frontend/.signing/diawi-token` with file permissions `600`. The helper also accepts
`--token-file PATH`. Tokens are never passed in curl command arguments or printed.

```bash
# From frontend: build a fresh signed IPA locally, then upload it.
yarn diawi:ios

# Re-upload the unchanged IPA from the previous build.
yarn diawi:ios --skip-build
yarn diawi:ios --skip-build --file builds/eguchi-ios-fast.ipa

# Optional build settings, or a fresh local EAS build.
yarn diawi:ios -- --build-number 2
yarn diawi:ios --eas-build
```

From the repository root, use `./scripts/build_and_upload_diawi.sh ios` with the
same options. `--file` paths are relative to your current directory and require
`--skip-build`. The default existing IPA is `frontend/builds/eguchi-ios-fast.ipa`.

The helper builds into a unique temporary output, validates the app identity and
presence of JavaScript/signing files, and saves the new IPA to the standard build
path before uploading. Failed builds cannot upload an older IPA; upload failures
leave the new IPA available for retry. Signed fast builds perform full signature
verification in the builder. Existing-file uploads only check the IPA structure.

The helper prints the installation link and an optional terminal QR code when
`qrencode` is installed. The latest successful result and IPA SHA-256 are saved
to the ignored `frontend/builds/diawi-last-success.json`. Uploads disable the
public wall and discovery by device UDID. Your Diawi plan must allow the IPA's
size; a rejected upload or failed processing returns an error instead of a link.

Test the integration with `pytest tests/test_diawi_upload.py tests/test_ios_fast_build.py`.

### Backend
Deploy the backend to your preferred hosting platform (Railway, Render, AWS, etc.).

## Support

- Company: Eguchi Labs
- Email: founder@eguchi.app

## License

[Add your license here]
