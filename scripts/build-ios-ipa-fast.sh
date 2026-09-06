#!/usr/bin/env bash
set -euo pipefail

# Keep the entry point consistent with the House Lights build workflow.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/ios_fast_build.py" "$@"
