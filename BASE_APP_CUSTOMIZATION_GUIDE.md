# Base App Customization Guide

This guide explains how to customize the Base App to create your own application. The architecture is designed for maximum flexibility while maintaining clean separation of concerns.

## Table of Contents

1. [Quick Start](#quick-start)
2. [App Configuration](#app-configuration)
3. [Branding & UI Customization](#branding--ui-customization)
4. [Feature Management](#feature-management)
5. [Backend Customization](#backend-customization)
6. [Environment Setup](#environment-setup)
7. [Component System](#component-system)
8. [Navigation Structure](#navigation-structure)
9. [API Integration](#api-integration)
10. [Testing Strategy](#testing-strategy)
11. [Deployment](#deployment)

## Quick Start

### 1. Clone and Setup
```bash
git clone <repository-url> my-new-app
cd my-new-app
```

### 2. Essential Configuration Changes
Before you start developing, modify these key files:

#### Frontend Configuration (`frontend/lib/app-config.ts`)
```typescript
// Update branding information
export const BRANDING_CONFIG = {
  appName: 'Your App Name',
  displayName: 'Your App Display Name',
  description: 'Your app description',
  company: 'Your Company Name',
  scheme: 'yourapp', // URL scheme for deep linking
  // ... other branding options
};
```

#### App Metadata (`frontend/app.json`)
```json
{
  "expo": {
    "name": "Your App Name",
    "slug": "your-app-slug",
    "scheme": "yourapp"
  }
}
```

#### Package Information (`frontend/package.json`)
```json
{
  "name": "your-app-frontend",
  "version": "1.0.0"
}
```

## App Configuration

The base app uses a centralized configuration system in `frontend/lib/app-config.ts`. This file controls all aspects of your app's behavior.

### Core Configuration Sections

#### 1. Environment Configuration
```typescript
export const ENV_CONFIG = {
  development: {
    apiUrl: 'https://127.0.0.1:8000',
    logLevel: 'debug',
    enableDevTools: true,
  },
  production: {
    apiUrl: 'https://your-api.com',
    logLevel: 'error',
    enableDevTools: false,
  },
};
```

#### 2. Feature Flags
Control which features are enabled in your app:
```typescript
export const FEATURE_FLAGS = {
  enableAuth: true,
  enableProfilePictures: true,
  enablePushNotifications: false,
  enableAnalytics: true,
  // Add your custom features here
};
```

### Using Configuration in Components
```typescript
import { APP_CONFIG, isFeatureEnabled } from '@/lib/app-config';

export function MyComponent() {
  const colors = APP_CONFIG.ui.theme.colors.light;

  if (!isFeatureEnabled('enableProfilePictures')) {
    return null; // Feature disabled
  }

  return (
    <View style={{ backgroundColor: colors.background }}>
      {/* Component content */}
    </View>
  );
}
```

## Branding & UI Customization

### Color System
The app uses a comprehensive color system that supports light and dark themes:

```typescript
// In app-config.ts
colors: {
  light: {
    primary: '#your-primary-color',
    background: '#ffffff',
    text: '#000000',
    // ... other colors
  },
  dark: {
    primary: '#your-primary-color-dark',
    background: '#000000',
    text: '#ffffff',
    // ... other colors
  }
}
```

### Typography
Customize fonts and text styles:
```typescript
fonts: {
  regular: 'YourCustomFont-Regular',
  medium: 'YourCustomFont-Medium',
  bold: 'YourCustomFont-Bold',
}
```

### Logo and Assets
Replace these files with your branding:
- `frontend/assets/images/icon.png` - App icon
- `frontend/assets/images/favicon.png` - Web favicon
- `frontend/assets/images/splash-icon.png` - Splash screen
- `frontend/assets/images/adaptive-icon.png` - Android adaptive icon

### Generating Icons
Use the provided script to generate icons:
```bash
cd scripts
python generate_icons.py --source your-logo.png
```

## Feature Management

### Enabling/Disabling Features
Features are controlled through the `FEATURE_FLAGS` object:

```typescript
// Disable a feature
enableMessaging: false,

// Enable a feature
enableNotifications: true,
```

### Adding New Features
1. Add the feature flag to `FEATURE_FLAGS`
2. Create the feature components
3. Use `isFeatureEnabled()` to conditionally render
4. Add tests for the feature

Example:
```typescript
// 1. Add to FEATURE_FLAGS
enableCustomFeature: true,

// 2. In your component
if (isFeatureEnabled('enableCustomFeature')) {
  return <CustomFeatureComponent />;
}
```

### Feature-Specific Configuration
For complex features, add dedicated config sections:

```typescript
export const MESSAGING_CONFIG = {
  maxMessageLength: 500,
  enableFileSharing: true,
  supportedFileTypes: ['image/*', 'application/pdf'],
} as const;
```

## Backend Customization

### API Endpoints
The backend is built with FastAPI. Customize by modifying these files:

#### Core Files
- `backend/main.py` - Main application and routes
- `backend/models.py` - Database models
- `backend/auth.py` - Authentication logic
- `backend/database.py` - Database configuration

### Adding New Endpoints
```python
# In backend/main.py
@app.get("/api/your-endpoint")
def your_endpoint(
    user=Depends(verify_jwt),
    db: Session = Depends(get_db)
):
    # Your logic here
    return {"data": "your response"}
```

### Database Models
Add new models to `backend/models.py`:
```python
class YourModel(Base):
    __tablename__ = "your_table"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    name = Column(String)
    created_at = Column(DateTime, default=func.now())
```

### Environment Variables
Configure these in your deployment environment:
```bash
# Required
EXPO_PUBLIC_AUTH0_DOMAIN=your-auth0-domain
EXPO_PUBLIC_AUTH0_CLIENT_ID=your-client-id
EXPO_PUBLIC_AUTH0_AUDIENCE=your-audience

# Optional services
OPENAI_API_KEY=your-openai-key
AWS_S3_BUCKET=your-s3-bucket
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

## Environment Setup

### Development Environment
1. Copy environment template:
```bash
cp .env.example .env.local
```

2. Fill in your configuration:
```env
EXPO_PUBLIC_AUTH0_DOMAIN=dev-yourdomain.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=your-dev-client-id
EXPO_PUBLIC_API_URL=https://127.0.0.1:8000
```

### Production Environment
Set environment variables in your hosting platform:
- Vercel: Project Settings → Environment Variables
- Netlify: Site Settings → Build & Deploy → Environment Variables
- Heroku: Settings → Config Vars

## Component System

### Themed Components
The app includes themed components that automatically adapt to light/dark mode:

```typescript
import { ThemedText, ThemedView } from '@/components';

export function MyScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Welcome!</ThemedText>
      <ThemedText>Your content here</ThemedText>
    </ThemedView>
  );
}
```

### Creating Custom Components
Follow the existing patterns:

```typescript
import { useThemeColor } from '@/hooks/useThemeColor';

export function CustomButton({
  lightColor,
  darkColor,
  ...props
}: CustomButtonProps) {
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    'background'
  );

  return (
    <Pressable
      style={[{ backgroundColor }, props.style]}
      {...props}
    />
  );
}
```

### Component Guidelines
1. Use TypeScript interfaces for props
2. Support theme colors via `useThemeColor`
3. Include proper accessibility props
4. Follow naming convention: `[Purpose][Type]` (e.g., `SubmitButton`, `UserCard`)

## Navigation Structure

### Tab Navigation
Configure tabs in `app-config.ts`:

```typescript
screens: {
  home: { enabled: true, icon: 'house', title: 'Home' },
  explore: { enabled: false, icon: 'paperplane', title: 'Explore' },
  myFeature: { enabled: true, icon: 'star', title: 'My Feature' },
}
```

### Adding New Screens
1. Create the screen component in `app/(tabs)/`
2. Add route configuration to `NAVIGATION_CONFIG`
3. Update deep linking if needed

### Deep Linking
Configure URL schemes:
```typescript
linking: {
  prefixes: ['yourapp://'],
  config: {
    screens: {
      Home: '/',
      Profile: '/profile/:userId?',
      Settings: '/settings',
    },
  },
}
```

## API Integration

### API Client Setup
The app uses a configured API client in `lib/api.ts`:

```typescript
import { api } from '@/lib/api';

// GET request
const response = await api.get('/your-endpoint');

// POST request
const response = await api.post('/your-endpoint', { data });

// With authentication (automatic)
const response = await api.get('/protected-endpoint');
```

### Adding New API Methods
```typescript
// In lib/api.ts
export const customApi = {
  getYourData: () => api.get('/your-data'),
  createYourItem: (data: YourData) => api.post('/your-items', data),
  updateYourItem: (id: string, data: Partial<YourData>) =>
    api.put(`/your-items/${id}`, data),
};
```

### Error Handling
The API client includes automatic error handling:
```typescript
try {
  const data = await api.get('/your-endpoint');
  // Handle success
} catch (error) {
  // Error is automatically logged and formatted
  console.error('API Error:', error.message);
}
```

## Testing Strategy

### Unit Tests
Write tests for your business logic:
```typescript
// __tests__/lib/your-feature.test.ts
import { yourFunction } from '@/lib/your-feature';

describe('yourFunction', () => {
  it('should handle valid input', () => {
    const result = yourFunction('test input');
    expect(result).toBe('expected output');
  });
});
```

### Component Tests
Test React components:
```typescript
// __tests__/components/YourComponent.test.tsx
import { render } from '@testing-library/react-native';
import { YourComponent } from '@/components/YourComponent';

describe('YourComponent', () => {
  it('renders correctly', () => {
    const { getByText } = render(<YourComponent title="Test" />);
    expect(getByText('Test')).toBeTruthy();
  });
});
```

### API Tests
Test backend endpoints:
```python
# tests/test_your_feature.py
def test_your_endpoint(client, auth_headers):
    response = client.get("/api/your-endpoint", headers=auth_headers)
    assert response.status_code == 200
    assert "expected_field" in response.json()
```

### Running Tests
```bash
# Frontend tests
cd frontend
yarn test

# Backend tests
cd backend
python -m pytest

# Coverage reports
yarn test:coverage
python -m pytest --cov=backend
```

## Deployment

### Frontend Deployment

#### Web Deployment (Vercel/Netlify)
```bash
# Build for web
yarn build:web

# Deploy to Vercel
vercel --prod

# Deploy to Netlify
netlify deploy --prod --dir=dist
```

#### Mobile App Stores
```bash
# iOS
eas build --platform ios
eas submit --platform ios

# Android
eas build --platform android
eas submit --platform android
```

### Backend Deployment

#### Production Setup
1. Set up your hosting (Railway, Render, AWS, etc.)
2. Configure environment variables
3. Set up SSL certificates
4. Configure domain

#### Database Migration
```bash
# Run migrations
python -m alembic upgrade head

# Create migration for schema changes
python -m alembic revision --autogenerate -m "description"
```

## Customization Checklist

When creating a new app from this base, follow this checklist:

### Essential Changes
- [ ] Update app name and branding in `app-config.ts`
- [ ] Replace logo and icon assets
- [ ] Update `app.json` with new app metadata
- [ ] Configure Auth0 credentials
- [ ] Set up environment variables
- [ ] Update package.json information

### Feature Configuration
- [ ] Review and configure feature flags
- [ ] Disable unused features
- [ ] Configure enabled services (S3, OpenAI, etc.)
- [ ] Update API endpoints as needed
- [ ] Configure navigation structure

### UI Customization
- [ ] Update color scheme and themes
- [ ] Configure typography
- [ ] Update spacing and layout values
- [ ] Customize component styles
- [ ] Add custom animations if needed

### Backend Setup
- [ ] Review and modify API endpoints
- [ ] Update database models
- [ ] Configure external services
- [ ] Set up production database
- [ ] Configure logging and monitoring

### Testing & Quality
- [ ] Write tests for custom features
- [ ] Update existing tests for changes
- [ ] Set up CI/CD pipeline
- [ ] Configure error tracking
- [ ] Set up analytics if enabled

### Deployment
- [ ] Configure hosting environments
- [ ] Set up domain and SSL
- [ ] Configure app store information
- [ ] Set up monitoring and alerts
- [ ] Plan backup and recovery

## Best Practices

1. **Configuration-Driven Development**: Use the config system for all customizable aspects
2. **Feature Flags**: Always gate new features behind flags for easier rollback
3. **Type Safety**: Maintain TypeScript types for all configurations
4. **Environment Separation**: Keep development, staging, and production separate
5. **Security**: Never commit secrets; use environment variables
6. **Testing**: Write tests for all custom functionality
7. **Documentation**: Update this guide when adding new customization options

## Getting Help

- Check existing GitHub issues
- Review the codebase for examples
- Test changes in development environment first
- Use TypeScript to catch configuration errors early

## Contributing Back

If you create reusable features or improvements, consider contributing back to the base app template to help other developers.
