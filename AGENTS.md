# Repository Guidelines

This is a template repository. Treat changes as reusable patterns, keep modules isolated,
and prefer configuration over hard-coded app-specific logic.

## Project Structure & Module Organization
- Frontend (React Native/Expo): `frontend/` (app code, components, hooks, lib, assets, tests in `frontend/__tests__/`).
- Backend (FastAPI): `backend/` (`main.py`, `auth.py`, `models.py`, `database.py`).
- Tests (backend): `tests/` with `test_*.py` files.
- Tooling & scripts: `scripts/` (dev, test, formatting, deploy), config in `pyproject.toml`, `.pre-commit-config.yaml`, `package.json`.
- Environment: `.env.example` (root and `frontend/`); never commit secrets.

## Build, Test, and Development Commands
- Install deps: `cd frontend && yarn install` and `pip install -r requirements.txt`.
- Start backend: `cd backend && python -m uvicorn main:app --reload --port 8000`.
- Start frontend: `cd frontend && yarn start` (or `yarn ios|android|web`).
- One-shot dev script: `./scripts/dev.sh [web|ios|android]`.
- Run tests (all): `./scripts/test.sh` or `npm run test` (root).
- Coverage: `./scripts/test.sh --coverage`, `pytest --cov=backend`, `yarn test:coverage` (frontend).
- Format: `npm run format` (or `npm run format:check`).

## Coding Style & Naming Conventions
- Python: Black (100 chars), PEP 8, 4-space indent; modules/files `snake_case.py`.
- JS/TS: Prettier (100 cols), 2-space indent; variables `camelCase`, components `PascalCase.tsx`.
- Lint/format hooks: enable with `pre-commit install` (runs Black, Prettier, and tests on commit).

## Testing Guidelines
- Frameworks: Pytest (backend), Jest + RTL (frontend).
- Locations: backend tests in `tests/test_*.py`; frontend tests in `frontend/__tests__/**/*.test.ts(x)`.
- Coverage: maintain high coverage for critical paths (aim ≥80% overall). Generate HTML via
  `pytest --cov-report=html` and view frontend reports in `frontend/coverage/`.

## iOS Production Builds
- Default prod API: `REPLACE_WITH_PROD_URL` (template default).
- Override via env: set `EXPO_PUBLIC_API_URL_PRODUCTION` (preferred) or `EXPO_PUBLIC_API_URL`.
- EAS profile: `frontend/eas.json` `production.env` pre-configures the default; customize when inheriting.
- Build: `cd frontend && EXPO_PUBLIC_API_URL_PRODUCTION=https://your-api eas build --platform ios --profile production`.

## Commit & Pull Request Guidelines
- Current history is informal. Prefer Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, etc.; imperative, ≤72-char subject.
- PRs: clear description, linked issues, screenshots for UI, test plan, and checklist (formatting passes, tests added/updated, no secrets in `.env`).

## Security & Configuration Tips
- Copy envs from `.env.example` → `.env`/`.env.local`; keep secrets out of VCS.
- HTTPS dev certs live in `certs/` (see `scripts/create_dev_cert.sh`).
- Frontend runtime config uses `EXPO_PUBLIC_*` vars; backend reads from environment.
