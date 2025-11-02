#!/usr/bin/env bash
set -e

source .env

# Kill any existing development processes to ensure clean restart
echo "Cleaning up any existing development processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "expo run" 2>/dev/null || true
pkill -f "@expo/cli" 2>/dev/null || true
pkill -f "Metro" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
# Kill any uvicorn processes running on port 8000
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

# Reset simulator apps for fresh start
reset_simulators() {
    local target=$1

    if [ "$target" = "ios" ]; then
        echo "Resetting iOS Simulator..."
        # Close Expo Go app if running
        xcrun simctl terminate booted host.exp.Exponent 2>/dev/null || true
        # Reset Expo Go app data
        xcrun simctl uninstall booted host.exp.Exponent 2>/dev/null || true
        echo "iOS Simulator reset complete"
    elif [ "$target" = "android" ]; then
        echo "Resetting Android emulator..."
        # Close Expo Go app if running
        adb shell am force-stop host.exp.exponent 2>/dev/null || true
        # Clear Expo Go app data
        adb shell pm clear host.exp.exponent 2>/dev/null || true
        echo "Android emulator reset complete"
    fi
}

# Default production API URL
DEFAULT_PROD_API_URL="REPLACE_WITH_PROD_URL"

TARGET=${1:-web}
CUSTOM_API_URL=""

# Check if second argument is PROD or a custom URL (only for mobile targets)
if [ $# -ge 2 ]; then
    if [ "$TARGET" = "web" ]; then
        echo "Error: Custom API URLs are not supported for web target"
        echo "Usage: $0 web"
        echo "Usage: $0 [ios|android] [PROD|API_URL]"
        echo "Examples:"
        echo "  $0 web"
        echo "  $0 ios PROD"
        echo "  $0 android https://staging-api.example.com"
        exit 1
    fi

    if [ "$2" = "PROD" ]; then
        CUSTOM_API_URL="$DEFAULT_PROD_API_URL"
        echo "Using production API: $CUSTOM_API_URL"
    elif [[ "$2" =~ ^https?:// ]]; then
        CUSTOM_API_URL="$2"
        echo "Using custom API: $CUSTOM_API_URL"
    else
        echo "Error: Second argument must be 'PROD' or a valid URL starting with http:// or https://"
        echo "Usage: $0 [ios|android] [PROD|API_URL]"
        echo "Examples:"
        echo "  $0 ios PROD"
        echo "  $0 android https://staging-api.example.com"
        exit 1
    fi
fi

case "$TARGET" in
  web|ios|android)
    ;;
  *)
    echo "Usage: $0 [web|ios|android]"
    echo "Usage: $0 [ios|android] [PROD|API_URL]"
    echo ""
    echo "Examples:"
    echo "  $0 web"
    echo "  $0 ios"
    echo "  $0 ios PROD"
    echo "  $0 android https://staging-api.example.com"
    exit 1
    ;;
esac

# Build the web version if requested
if [ "$TARGET" = "web" ]; then
  (cd frontend && npx expo export --platform web)
fi

# Determine API URL and SSL configuration
if [ "$TARGET" = "web" ]; then
  # For web development, use HTTPS with localhost
  API_URL=${API_URL:-https://127.0.0.1:8000}
  CERT_FILE="certs/localhost.pem"
  KEY_FILE="certs/localhost-key.pem"
  USE_SSL=true
elif [ -n "$CUSTOM_API_URL" ]; then
  # For mobile with custom API URL
  API_URL="$CUSTOM_API_URL"
  USE_SSL=false
  echo "Using custom API URL: $API_URL"
  echo "Note: Backend server will not be started when using custom API URL"
else
  # For mobile development with Expo Go, use HTTP with localhost
  API_URL=${API_URL:-http://localhost:8000}
  USE_SSL=false
  echo "Using HTTP with localhost for Expo Go development: $API_URL"
fi

# Start the backend API server in the background (only if using localhost)
BACKEND_PID=""
if [ -z "$CUSTOM_API_URL" ]; then
  if [ "$USE_SSL" = "true" ]; then
    uvicorn backend.main:app --reload \
      --host 0.0.0.0 --port 8000 \
      --log-level debug \
      --ssl-certfile "$CERT_FILE" --ssl-keyfile "$KEY_FILE" &
  else
    uvicorn backend.main:app --reload \
      --host 0.0.0.0 --port 8000 \
      --log-level debug &
  fi
  BACKEND_PID=$!
fi

# Ensure servers are stopped when this script exits
cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID"
  fi
}
trap cleanup EXIT

if [ "$TARGET" = "web" ]; then
  # Open the built site served by FastAPI
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$API_URL"
  elif command -v open >/dev/null 2>&1; then
    open "$API_URL"
  elif command -v start >/dev/null 2>&1; then
    start "$API_URL"
  else
    echo "Browse to $API_URL"
  fi

  # Wait for the backend server until the user stops the script
  wait "$BACKEND_PID"
else
  # Reset simulator app for fresh start
  reset_simulators "$TARGET"

  # Start the Expo development server for iOS or Android
  echo "Starting Expo development server for $TARGET..."
  echo "Note: This will use Expo Go for managed development."
  (cd frontend && EXPO_PUBLIC_API_URL="$API_URL" npx expo start --$TARGET)
fi
