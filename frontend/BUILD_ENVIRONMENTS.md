# Build Environments Configuration

This document explains how to build the app for different environments with different API servers.

## Environments

### Development (default)

- **API URL**: `http://127.0.0.1:8000` (local development server)
- **Debug Mode**: Enabled
- **Use Case**: Local development and testing

### Staging

- **API URL**: `https://baseapp-staging.up.railway.app` (staging server)
- **Debug Mode**: Enabled
- **Use Case**: Pre-production testing

### Production

- **API URL**: `https://eguchi-api-production.up.railway.app` (production server)
- **Debug Mode**: Disabled
- **Use Case**: Live app for end users

## Development Commands

### Local Development

```bash
# Start in development mode (default)
yarn start
yarn ios
yarn android
yarn web

# Start in production mode (useful for testing prod config locally)
yarn start:production
yarn ios:production
yarn android:production
yarn web:production
```

## Building for Distribution

### Web Builds

```bash
# Development build
yarn build:web

# Staging build
yarn build:web:staging

# Production build
yarn build:web:production
```

### Mobile App Builds (requires EAS CLI)

First, install EAS CLI and login:

```bash
npm install -g @expo/eas-cli
eas login
```

#### iOS Builds

```bash
# Development build (for testing on device)
yarn build:ios:dev

# Staging build (internal distribution)
yarn build:ios:staging

# Production build (App Store)
yarn build:ios:production
```

#### Android Builds

```bash
# Development build (for testing on device)
yarn build:android:dev

# Staging build (internal distribution)
yarn build:android:staging

# Production build (Google Play Store)
yarn build:android:production
```

#### Build Both Platforms

```bash
# Build both iOS and Android
yarn build:all:dev
yarn build:all:staging
yarn build:all:production
```

## Custom API URL

You can override the API URL for any environment by setting the `EXPO_PUBLIC_API_URL` environment variable:

```bash
# Use a custom API URL
EXPO_PUBLIC_API_URL=https://my-custom-api.com yarn start

# Build with custom API URL
EXPO_PUBLIC_API_URL=https://my-custom-api.com yarn build:ios:production
```

## Environment Variables

The app uses these environment variables:

- `EXPO_PUBLIC_ENVIRONMENT`: Sets the environment (development, staging, production)
- `EXPO_PUBLIC_API_URL`: Overrides the default API URL for the environment
- `EXPO_PUBLIC_AUTH0_DOMAIN`: Auth0 domain
- `EXPO_PUBLIC_AUTH0_CLIENT_ID`: Auth0 client ID
- `EXPO_PUBLIC_AUTH0_AUDIENCE`: Auth0 audience
- `EXPO_PUBLIC_AUTH_USE_PROXY`: Set to `true` or `false` to force using the Expo AuthSession proxy on native (defaults to direct native redirects).

## Auth0 Redirect URIs (iOS/Android/Web)

For Auth0 to accept logins, make sure these URLs are configured in your Auth0 Application settings:

- **Allowed Callback URLs**
  - Native (recommended): `eguchieartrainer://redirect`
  - Optional (Expo proxy): `https://auth.expo.io/@YOUR_EXPO_USERNAME/eguchieartrainer`

- **Allowed Logout URLs**
  - `eguchieartrainer://redirect`

Notes:

- The canonical app URL scheme is `eguchieartrainer` (see `app.json`). If you change it, update both the scheme and Auth0 settings.
- You can temporarily enable the Expo proxy in native builds by setting `EXPO_PUBLIC_AUTH_USE_PROXY=true`.
- If you change the Expo account or slug, update the Expo proxy URL accordingly.
- You can override the URL scheme via `EXPO_PUBLIC_URL_SCHEME`; it must match `expo.scheme` in `app.json`.

## Build Profiles

The EAS build profiles are configured in `eas.json`:

- **development**: Creates a development build with debugging enabled
- **staging**: Creates a staging build for internal testing
- **production**: Creates a production build for app stores

## Checking Current Configuration

The app will log its configuration on startup when debug mode is enabled. Check the console/logs to verify:

- Current environment
- API base URL
- Debug mode status

## Examples

### Building a production iOS app that connects to your Railway server:

```bash
yarn build:ios:production
```

### Testing production configuration locally:

```bash
yarn ios:production
```

### Building with a completely custom API:

```bash
EXPO_PUBLIC_API_URL=https://my-api.example.com yarn build:android:production
```
