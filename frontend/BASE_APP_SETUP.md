# Base App Setup Guide

This is a modular React Native/Expo base app that can be used as a foundation for future projects. It includes authentication, user settings, profile management, and a clean, testable architecture.

## Features

✅ **Authentication** - Auth0 integration with automatic profile population
✅ **User Settings** - Profile picture, name, nickname, email
✅ **Image Handling** - Client-side compression and S3 upload
✅ **Modular API Client** - Centralized HTTP client with error handling
✅ **Cross-platform** - iOS, Android, and Web support
✅ **Dark Mode** - Built-in theme support
✅ **Testing** - Comprehensive test suite for utilities

## Project Structure

```
frontend/
├── lib/                    # Modular utilities (NEW)
│   ├── config.ts          # App configuration
│   ├── api.ts             # HTTP client
│   ├── storage.ts         # AsyncStorage wrapper
│   └── utils.ts           # General utilities
├── app/                   # Expo Router pages
│   ├── (tabs)/           # Tab navigation
│   ├── settings.tsx      # User settings
│   └── _layout.tsx       # Root layout
├── components/           # Reusable components
├── auth/                # Authentication context
├── constants/           # App constants
└── __tests__/          # Test suites
```

## Quick Start for New Projects

### 1. Clone and Setup

```bash
# Clone the base app
git clone <this-repo> my-new-app
cd my-new-app/frontend

# Install dependencies
yarn install

# Configure environment
cp .env.example .env.local
```

### 2. Customize Configuration

Edit `lib/config.ts` to match your new app:

```typescript
export const APP_CONFIG = {
  name: 'My New App', // 👈 Change this
  api: {
    baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
    timeout: 10000,
  },
  features: {
    profilePictures: true, // 👈 Enable/disable features
    userSettings: true,
    // Add new feature flags here
  },
} as const;
```

### 3. Update Branding

- Replace app icon in `assets/images/`
- Update app name in `app.json`
- Modify color scheme in `constants/Colors.ts`
- Update splash screen if needed

### 4. Backend Integration

The app expects these API endpoints:

- `GET /api/settings` - Get user settings
- `POST /api/settings` - Save user settings
- `POST /api/upload-profile-picture` - Upload profile image
- `GET /api/nugget` - Example protected endpoint
- `POST /api/nugget/regenerate` - Example POST endpoint

Update the backend URL in your `.env.local`:

```
EXPO_PUBLIC_API_URL=https://your-api.com
```

### 5. Authentication Setup

Configure Auth0 in your `.env.local`:

```
EXPO_PUBLIC_AUTH0_DOMAIN=your-domain.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=your-client-id
```

## Development Workflow

### Adding New Features

1. **Create API methods** in `lib/api.ts`:

```typescript
// Add to ApiClient interface
newFeature<T>(data: any, token?: string): Promise<ApiResponse<T>>;

// Add to BaseApiClient class
async newFeature<T>(data: any, token?: string): Promise<ApiResponse<T>> {
  return this.request<T>('/api/new-feature', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(data),
  });
}
```

2. **Add configuration** in `lib/config.ts`:

```typescript
features: {
  // existing features...
  newFeature: true,
}
```

3. **Create components** using existing patterns
4. **Add tests** in `__tests__/`

### Using the Modular API Client

```typescript
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';

const { token } = useAuth();

// GET request
const response = await api.get('/api/data', token);
if (response.data) {
  // Handle success
} else {
  console.error('Error:', response.error);
}

// POST request
const response = await api.post('/api/data', { name: 'value' }, token);

// File upload
const response = await api.upload('/api/upload', formData, token);
```

### Using Storage Utilities

```typescript
import { storage, STORAGE_KEYS } from '@/lib/storage';

// Store data
await storage.set(STORAGE_KEYS.USER_PREFERENCES, { theme: 'dark' });

// Retrieve data
const prefs = await storage.get(STORAGE_KEYS.USER_PREFERENCES);

// Remove data
await storage.remove(STORAGE_KEYS.AUTH_TOKEN);
```

### Using General Utilities

```typescript
import { formatDate, formatTime, debounce, isValidEmail, getInitials } from '@/lib/utils';

const formattedDate = formatDate(new Date()); // "Mar 15, 2024"
const initials = getInitials('John Doe'); // "JD"
const debouncedFn = debounce(myFunction, 500);
```

## Testing

The app includes comprehensive tests for the modular utilities:

```bash
# Run all tests
yarn test

# Run tests with coverage
yarn test:coverage

# Run tests in watch mode
yarn test:watch
```

### Writing Tests

Follow the existing patterns in `__tests__/lib/`:

```typescript
import { myUtility } from '../../lib/utils';

describe('myUtility', () => {
  test('should do something correctly', () => {
    const result = myUtility('input');
    expect(result).toBe('expected');
  });
});
```

## Customization Examples

### Adding a New Tab

1. Create `app/(tabs)/newtab.tsx`:

```typescript
export default function NewTabScreen() {
  return <ThemedView>...</ThemedView>;
}
```

2. The tab will automatically appear (Expo Router magic!)

### Adding New Settings Fields

1. Update the settings form in `app/settings.tsx`
2. Update the backend API to handle new fields
3. Test the flow

### Changing the API Base URL

Update `lib/config.ts`:

```typescript
api: {
  baseUrl: 'https://new-api.com',
  timeout: 15000, // Also adjust timeout if needed
}
```

## Common Pitfalls

1. **Always use the modular API client** - Don't use fetch() directly
2. **Follow the existing patterns** - Look at how settings.tsx works
3. **Update both frontend and backend** - API changes need both sides
4. **Test on all platforms** - iOS, Android, and Web behave differently
5. **Use the storage utilities** - Don't access AsyncStorage directly

## Deployment

The app is ready for deployment to:

- **iOS**: `yarn ios` then archive in Xcode
- **Android**: `yarn android` then build APK/AAB
- **Web**: `yarn build` then deploy the `dist/` folder

## Support

This base app provides a solid foundation with:

- Modular, testable code architecture
- Cross-platform compatibility
- Modern React Native/Expo patterns
- Comprehensive utilities and helpers

Build something amazing! 🚀
