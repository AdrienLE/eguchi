# Quick Start: Building for Production

## TL;DR - Build Commands

### For iOS production build (connects to your Railway server):

```bash
yarn build:ios:production
```

### For Android production build:

```bash
yarn build:android:production
```

### For both platforms:

```bash
yarn build:all:production
```

### For web production build:

```bash
yarn build:web:production
```

## Custom API URL

To build with a different API server:

```bash
EXPO_PUBLIC_API_URL=https://your-api.com yarn build:ios:production
```

## Prerequisites

1. Install EAS CLI (for mobile builds):

   ```bash
   npm install -g @expo/eas-cli
   eas login
   ```

2. Set up your Auth0 environment variables in `.env`:
   ```bash
   cp .env.example .env
   # Edit .env with your Auth0 credentials
   ```

## Environment Targets

- **Development**: Local server at `http://127.0.0.1:8000`
- **Staging**: `https://baseapp-staging.up.railway.app`
- **Production**: `REPLACE_WITH_PROD_URL`

The production builds will automatically use your Railway production server at `REPLACE_WITH_PROD_URL/api`

## More Options

See [BUILD_ENVIRONMENTS.md](./BUILD_ENVIRONMENTS.md) for detailed documentation.
