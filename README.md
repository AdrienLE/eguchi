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

## Configuration

This app uses a centralized configuration system. Main configuration files:

- `frontend/lib/app-config.ts` - Main app configuration
- `.env.local` - Environment variables
- `frontend/app.json` - Expo configuration

## Features

Current feature configuration:
- Authentication: $([ "$AUTH_ENABLED" = "true" ] && echo "✅ Enabled" || echo "❌ Disabled")
- Profile Pictures: ✅ Enabled
- Dark Mode: ✅ Enabled
- Push Notifications: ❌ Disabled

To enable/disable features, modify the `FEATURE_FLAGS` in `app-config.ts`.

## Customization

See `BASE_APP_CUSTOMIZATION_GUIDE.md` for detailed customization instructions.

## Deployment

### Frontend (Web)
```bash
cd frontend
yarn build:web
```

### Mobile Apps
```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

### Backend
Deploy the backend to your preferred hosting platform (Railway, Render, AWS, etc.).

## Support

- Company: Eguchi Labs
- Email: founder@eguchi.app

## License

[Add your license here]
