# Production Diawi Rollout Plan

Created: 2026-05-02

Goal: deploy the Eguchi backend to a production Railway service, use Railway Buckets for object storage instead of S3, configure Auth0 for the production app, build the mobile app against that production server, upload the install artifact to Diawi, and return the Diawi install code/link.

## Current Findings

- `eguchi-ear-trainer` has no Diawi helper script yet.
- `DIAWI_TOKEN` is available in the current shell environment, but should not be committed or printed.
- EAS CLI is installed and the local Expo account is logged in.
- Production API defaults are configured for `https://eguchi-api-production.up.railway.app`.
- Backend profile-picture upload currently uses direct S3 globals in `backend/main.py`.
- `hue-2` has the newer pattern to copy:
  - `/Users/adrien/projects/hue-2/scripts/build_and_upload_diawi.sh`
  - `/Users/adrien/projects/hue-2/scripts/build-prod.sh`
  - `/Users/adrien/projects/hue-2/backend/storage.py`
  - `/Users/adrien/projects/hue-2/tests/test_storage.py`
  - Railway bucket env shape in `/Users/adrien/projects/hue-2/.env.example`

## Phase 1 - Preflight

1. Check repo state:
   ```bash
   git status --short --branch
   ```
2. Run current tests before changing behavior:
   ```bash
   npm run test
   ```
3. Check whether this repo is already linked to Railway:
   ```bash
   railway status
   railway list
   railway variables --kv
   ```
4. If no Railway project/service exists, create or link one for Eguchi Ear Trainer. Record the production domain, expected shape:
   ```text
   https://eguchi-ear-trainer-production.up.railway.app
   ```

## Phase 2 - Port Railway Bucket Storage

1. Add `backend/storage.py` based on `hue-2/backend/storage.py`.
2. Replace S3 globals in `backend/main.py` with:
   - `ObjectStorage.from_env()`
   - `RAILWAY_PUBLIC_DOMAIN` / `PUBLIC_BASE_URL` aware public URLs
   - `/api/profile-picture/{object_key:path}` redirect endpoint for signed Railway Bucket access
3. Keep generic fallback env names supported:
   - `RAILWAY_BUCKET_NAME` or `BUCKET_NAME`
   - `RAILWAY_BUCKET_ENDPOINT` or `BUCKET_ENDPOINT`
   - `RAILWAY_BUCKET_ACCESS_KEY_ID` or `BUCKET_ACCESS_KEY_ID`
   - `RAILWAY_BUCKET_SECRET_ACCESS_KEY` or `BUCKET_SECRET_ACCESS_KEY`
   - `RAILWAY_BUCKET_REGION` or `BUCKET_REGION`
4. Update tests from S3 mocks to object-storage mocks:
   - Add `tests/test_storage.py`.
   - Update upload tests to expect `Object storage bucket not configured`.
   - Verify public profile-picture URLs are served through the API, not S3 URLs.
5. Update `.env.example` to remove AWS S3 as the preferred path and add Railway Bucket variable references.

## Phase 3 - Railway Setup And Deploy

1. In Railway, ensure the project has:
   - Backend service connected to this repo.
   - PostgreSQL if needed by the template backend.
   - Railway Bucket resource for profile uploads.
2. Set service variables:
   ```text
   PORT=8000
   RAILWAY_ENVIRONMENT=production
   AUTH0_DOMAIN=<auth0-domain>
   AUTH0_AUDIENCE=<auth0-audience>
   PUBLIC_BASE_URL=https://<railway-production-domain>
   RAILWAY_BUCKET_NAME=${{ <bucket-resource>.BUCKET }}
   RAILWAY_BUCKET_ACCESS_KEY_ID=${{ <bucket-resource>.ACCESS_KEY_ID }}
   RAILWAY_BUCKET_SECRET_ACCESS_KEY=${{ <bucket-resource>.SECRET_ACCESS_KEY }}
   RAILWAY_BUCKET_REGION=${{ <bucket-resource>.REGION }}
   RAILWAY_BUCKET_ENDPOINT=${{ <bucket-resource>.ENDPOINT }}
   ```
3. Deploy, then verify:
   ```bash
   railway up
   railway logs
   curl https://<railway-production-domain>/health
   curl https://<railway-production-domain>/api/
   ```

## Phase 4 - Auth0 Setup

1. Decide whether to keep Auth0 for this app. The Eguchi spec says no child accounts, but the template backend still has authenticated profile/settings endpoints. If those endpoints remain, configure Auth0.
2. Use the existing Auth0 tenant unless a separate Eguchi tenant/app is needed.
3. Configure the native application:
   - App scheme: `eguchieartrainer`
   - iOS bundle id: `com.eguchi.app`
   - Android package: `com.eguchi.app`
4. Auth0 Allowed Callback URLs:
   ```text
   eguchieartrainer://redirect
   https://<railway-production-domain>/
   ```
5. Auth0 Allowed Logout URLs:
   ```text
   eguchieartrainer://redirect
   https://<railway-production-domain>/
   ```
6. Auth0 Allowed Web Origins / CORS:
   ```text
   https://<railway-production-domain>
   ```
7. Put Auth0 values in Railway service variables and `frontend/eas.json` production env:
   ```text
   AUTH0_DOMAIN=<domain>
   AUTH0_AUDIENCE=<audience>
   EXPO_PUBLIC_AUTH0_DOMAIN=<domain>
   EXPO_PUBLIC_AUTH0_CLIENT_ID=<client-id>
   EXPO_PUBLIC_AUTH0_AUDIENCE=<audience>
   ```

## Phase 5 - Production Build Script Cleanup

1. Port the robust `hue-2/scripts/build-prod.sh` behavior:
   - `--local`
   - `--profile`
   - `--non-interactive`
   - `--interactive`
   - optional EAS Update mode if useful
   - default production API URL set to the Railway production domain
2. Copy and adapt `hue-2/scripts/build_and_upload_diawi.sh`.
3. Update docs and `.env.example` with:
   ```text
   DIAWI_TOKEN=your-diawi-token
   ```
4. Update production API values:
   - `frontend/eas.json`
   - `scripts/build-prod.sh`
   - `scripts/dev.sh`
   - `frontend/lib/config.ts` tests if they assert the old placeholder
   - any build docs that mention the production API default

## Phase 6 - Build And Diawi Upload

Preferred iOS path:

```bash
scripts/build_and_upload_diawi.sh ios --auto-yes -- --profile production
```

If local iOS signing is required and configured:

```bash
scripts/build_and_upload_diawi.sh ios --auto-yes -- --local --profile production
```

If an IPA already exists:

```bash
scripts/build_and_upload_diawi.sh ios --file frontend/build-*.ipa
```

Expected output:

```text
Diawi install link: https://i.diawi.com/<code>
```

Return both:

- Diawi code: `<code>`
- Diawi link: `https://i.diawi.com/<code>`

## Phase 7 - Verification

Before calling it done:

1. Run tests:
   ```bash
   npm run test
   ```
2. Verify audio assets:
   ```bash
   python scripts/check_audio_assets.py
   ```
3. Verify production backend:
   ```bash
   curl https://<railway-production-domain>/health
   ```
4. Install the Diawi build on a device and confirm:
   - App launches.
   - Training screen renders animal tiles.
   - Audio plays.
   - Settings opens.
   - Any authenticated/profile flow either works or is intentionally hidden.
   - Network calls point to the Railway production domain.

## Commit Cadence

Use small commits:

1. `feat: use railway bucket storage`
2. `chore: add diawi build helper`
3. `chore: configure production railway build`
4. `chore: document production rollout`

Run relevant tests before each commit.

## Known Risks

- `com.eguchi.app` may already be used by another app; confirm before production signing.
- The product spec says no accounts, while the template still includes Auth0/profile behavior. Decide whether to remove auth for v1 or keep it only for template endpoints.
- Railway project creation and bucket wiring may require dashboard actions if CLI support is incomplete.
- Diawi only distributes installable artifacts; iOS devices still need compatible signing/provisioning.
