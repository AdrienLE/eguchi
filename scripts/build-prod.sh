#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../frontend" && pwd)"

usage() {
  echo "Usage: $0 <ios|android> [API_URL] [build options...]"
  echo "iOS uses the cached local builder; --eas-build selects a local EAS build."
  echo "Android retains the EAS cloud build."
}

if [[ $# -eq 0 ]]; then usage; exit 1; fi
TARGET="$1"
shift
case "$TARGET" in
  -h|--help) usage; exit 0 ;;
  ios|android) ;;
  *) usage >&2; exit 1 ;;
esac

API_URL=""
if [[ $# -gt 0 && "$1" != -* ]]; then
  API_URL="$1"
  shift
fi

EAS_BUILD=0
BUILD_ARGS=()
# The guarded array expansions below also support macOS's Bash 3.2 with set -u.
for arg in "$@"; do
  if [[ "$arg" == "--eas-build" ]]; then EAS_BUILD=1; else BUILD_ARGS+=("$arg"); fi
done

if [[ "$TARGET" == "ios" && "$EAS_BUILD" -eq 0 ]]; then
  if [[ -n "$API_URL" ]]; then BUILD_ARGS=(--api-url "$API_URL" ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"}); fi
  exec bash "$SCRIPT_DIR/build-ios-ipa-fast.sh" ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"}
fi

cd "$APP_DIR"
if [[ -n "$API_URL" ]]; then
  export EXPO_PUBLIC_API_URL="$API_URL"
  export EXPO_PUBLIC_API_URL_PRODUCTION="$API_URL"
fi
if [[ "$TARGET" == "ios" ]]; then BUILD_ARGS=(--local ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"}); fi
exec npx eas build --platform "$TARGET" --profile production ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"}
