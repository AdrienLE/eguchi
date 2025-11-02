#!/usr/bin/env bash
set -e

# Default production API URL
DEFAULT_PROD_API_URL="REPLACE_WITH_PROD_URL"

# Parse arguments
TARGET=""
API_URL="$DEFAULT_PROD_API_URL"

# Function to show usage
show_usage() {
    echo "Usage: $0 <ios|android> [API_URL]"
    echo ""
    echo "Examples:"
    echo "  $0 ios"
    echo "  $0 android"
    echo "  $0 ios https://my-custom-api.com"
    echo "  $0 android https://staging-api.example.com"
    echo ""
    echo "Default API URL: $DEFAULT_PROD_API_URL"
}

# Parse command line arguments
if [ $# -lt 1 ]; then
    echo "Error: Target platform required"
    show_usage
    exit 1
fi

TARGET="$1"

# Validate target
case "$TARGET" in
  ios|android)
    ;;
  *)
    echo "Error: Invalid target '$TARGET'. Must be 'ios' or 'android'"
    show_usage
    exit 1
    ;;
esac

# Set API URL if provided as second argument
if [ $# -ge 2 ]; then
    API_URL="$2"
fi

echo "Building production app for $TARGET"
echo "API URL: $API_URL"

# Build the production app using EAS
echo "Starting EAS build..."
(cd frontend && EXPO_PUBLIC_API_URL="$API_URL" npx eas build --platform "$TARGET" --profile production)

echo ""
echo "Production build completed!"
echo "Platform: $TARGET"
echo "API URL: $API_URL"
echo ""
echo "You can check the build status at: https://expo.dev"
