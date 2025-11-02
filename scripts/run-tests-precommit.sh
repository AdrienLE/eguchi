#!/usr/bin/env bash
set -e

# Only run tests when explicitly enabled to keep commits fast locally.
# CI should still run the full suite.
if [ "${PRECOMMIT_RUN_TESTS:-}" = "1" ] || [ "${PRECOMMIT_RUN_TESTS:-}" = "true" ]; then
  echo "[pre-commit] Running tests with coverage (PRECOMMIT_RUN_TESTS enabled)"
  CI=true ./scripts/test.sh --coverage
else
  echo "[pre-commit] Skipping tests (set PRECOMMIT_RUN_TESTS=1 to enable)"
fi
