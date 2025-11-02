# Feature Development Guide

This guide explains how to develop new features using the Base App's modular feature system.

## Feature Architecture

The Base App uses a modular feature system where each feature is self-contained and can be easily enabled/disabled through configuration flags.

### Feature Structure

Each feature follows this structure:
```
lib/features/[feature-name]/
├── index.ts              # Feature module definition
├── [Feature]Provider.tsx # React context provider (if needed)
├── [Feature]Service.ts   # Core business logic
├── use[Feature].ts       # React hooks
├── components/           # Feature-specific components
├── types.ts             # TypeScript types
└── __tests__/           # Feature tests
```

## Creating a New Feature

### 1. Define the Feature Module

Create `lib/features/my-feature/index.ts`:

```typescript
import { FeatureModule } from '../index';
import { MyFeatureProvider } from './MyFeatureProvider';
import { MyFeatureSettings } from './MyFeatureSettings';
import { useMyFeature } from './useMyFeature';
import { myFeatureService } from './myFeatureService';

export const myFeature: FeatureModule = {
  name: 'myFeature',
  version: '1.0.0',
  description: 'Description of what this feature does',
  dependencies: ['auth'], // Optional dependencies

  components: {
    MyFeatureProvider,
    MyFeatureSettings,
  },

  hooks: {
    useMyFeature,
  },

  services: {
    myFeatureService,
  },

  routes: [
    {
      path: '/my-feature',
      component: MyFeatureSettings,
      exact: true,
      private: true, // Requires authentication
    },
  ],

  initialize: async () => {
    console.log('Initializing my feature...');
    await myFeatureService.initialize();
  },

  cleanup: async () => {
    console.log('Cleaning up my feature...');
    await myFeatureService.cleanup();
  },
};
```

### 2. Add Feature Flag

Add the feature flag to `lib/app-config.ts`:

```typescript
export const FEATURE_FLAGS = {
  // ... existing flags
  enableMyFeature: false, // Start disabled by default
} as const;
```

### 3. Create the Service

Create `lib/features/my-feature/myFeatureService.ts`:

```typescript
import { APP_CONFIG } from '@/lib/app-config';
import { storage } from '@/lib/storage';
import { api } from '@/lib/api';

class MyFeatureService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize the service
    console.log('Initializing MyFeature service');

    // Load saved settings
    const settings = await storage.getItem('myFeature_settings');
    if (settings) {
      this.loadSettings(JSON.parse(settings));
    }

    this.initialized = true;
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  async saveData(data: any): Promise<void> {
    // Save data via API
    const response = await api.post('/api/my-feature/data', data);
    return response.data;
  }

  async loadData(): Promise<any> {
    // Load data from API
    const response = await api.get('/api/my-feature/data');
    return response.data;
  }

  private loadSettings(settings: any): void {
    // Load settings into the service
  }
}

export const myFeatureService = new MyFeatureService();
```

### 4. Create React Hook

Create `lib/features/my-feature/useMyFeature.ts`:

```typescript
import { useState, useEffect } from 'react';
import { myFeatureService } from './myFeatureService';
import { APP_CONFIG } from '@/lib/app-config';

export const useMyFeature = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEnabled = APP_CONFIG.features.enableMyFeature;

  const loadData = async () => {
    if (!isEnabled) return;

    setLoading(true);
    setError(null);

    try {
      const result = await myFeatureService.loadData();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const saveData = async (newData: any) => {
    if (!isEnabled) return;

    setLoading(true);
    setError(null);

    try {
      await myFeatureService.saveData(newData);
      setData(newData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isEnabled) {
      loadData();
    }
  }, [isEnabled]);

  return {
    data,
    loading,
    error,
    loadData,
    saveData,
    isEnabled,
  };
};
```

### 5. Create Components

Create `lib/features/my-feature/MyFeatureSettings.tsx`:

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText, ThemedView } from '@/components';
import { useMyFeature } from './useMyFeature';

export const MyFeatureSettings: React.FC = () => {
  const { data, loading, error, saveData } = useMyFeature();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">My Feature Settings</ThemedText>

      {loading && <ThemedText>Loading...</ThemedText>}
      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      {data && (
        <View>
          <ThemedText>Feature Data: {JSON.stringify(data)}</ThemedText>
        </View>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  error: {
    color: 'red',
  },
});
```

### 6. Register the Feature

In `lib/features/index.ts`, register your feature:

```typescript
import { myFeature } from './my-feature';

// Register features
featureRegistry.register(authFeature);
featureRegistry.register(notificationsFeature);
featureRegistry.register(myFeature); // Add your feature
```

### 7. Add Backend Support (Optional)

If your feature needs backend support, add endpoints to `backend/main.py`:

```python
@app.get("/api/my-feature/data")
def get_my_feature_data(
    user=Depends(verify_jwt),
    db: Session = Depends(get_db)
):
    # Your backend logic here
    return {"data": "example"}

@app.post("/api/my-feature/data")
def save_my_feature_data(
    data: dict,
    user=Depends(verify_jwt),
    db: Session = Depends(get_db)
):
    # Save data logic
    return {"success": True}
```

## Using Features in Components

### Feature Gates

Conditionally render components based on feature flags:

```typescript
import { FeatureGate } from '@/lib/features';

export const MyScreen = () => {
  return (
    <View>
      <Text>Always visible content</Text>

      <FeatureGate feature="myFeature">
        <MyFeatureComponent />
      </FeatureGate>

      <FeatureGate
        feature="myFeature"
        fallback={<Text>Feature disabled</Text>}
      >
        <MyFeatureComponent />
      </FeatureGate>
    </View>
  );
};
```

### Using Feature Hooks

Use the `useFeature` hook to check feature status and access components:

```typescript
import { useFeature } from '@/lib/features';

export const MyComponent = () => {
  const { isEnabled, getComponent, getHook } = useFeature('myFeature');

  if (!isEnabled) {
    return <Text>Feature not available</Text>;
  }

  const MyFeatureComponent = getComponent('MyFeatureSettings');
  const useMyFeature = getHook('useMyFeature');

  return MyFeatureComponent ? <MyFeatureComponent /> : null;
};
```

### Direct Hook Usage

Use feature hooks directly when the feature is known to be enabled:

```typescript
import { useMyFeature } from '@/lib/features/my-feature';

export const MyComponent = () => {
  const { data, loading, saveData } = useMyFeature();

  if (!loading && data) {
    return <Text>{data.message}</Text>;
  }

  return <Text>Loading...</Text>;
};
```

## Feature Configuration

### Feature-Specific Config

Add feature-specific configuration to `app-config.ts`:

```typescript
// Add to SERVICE_CONFIG or create a new section
export const MY_FEATURE_CONFIG = {
  maxItems: 100,
  enableAdvancedMode: false,
  syncInterval: 30000, // 30 seconds
} as const;
```

### Environment Variables

Add feature-specific environment variables:

```bash
# In .env.example
EXPO_PUBLIC_MY_FEATURE_API_KEY=your-api-key
MY_FEATURE_SECRET_KEY=backend-only-secret
```

## Testing Features

### Unit Tests

Create `lib/features/my-feature/__tests__/myFeatureService.test.ts`:

```typescript
import { myFeatureService } from '../myFeatureService';

describe('MyFeatureService', () => {
  beforeEach(async () => {
    await myFeatureService.initialize();
  });

  afterEach(async () => {
    await myFeatureService.cleanup();
  });

  it('should save and load data', async () => {
    const testData = { message: 'test' };

    await myFeatureService.saveData(testData);
    const loadedData = await myFeatureService.loadData();

    expect(loadedData).toEqual(testData);
  });
});
```

### Component Tests

Create `lib/features/my-feature/__tests__/MyFeatureSettings.test.tsx`:

```typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import { MyFeatureSettings } from '../MyFeatureSettings';

// Mock the hook
jest.mock('../useMyFeature', () => ({
  useMyFeature: () => ({
    data: { message: 'test' },
    loading: false,
    error: null,
    saveData: jest.fn(),
  }),
}));

describe('MyFeatureSettings', () => {
  it('renders correctly', () => {
    const { getByText } = render(<MyFeatureSettings />);
    expect(getByText('My Feature Settings')).toBeTruthy();
  });
});
```

### Integration Tests

Test feature initialization and cleanup:

```typescript
import { featureRegistry } from '../index';
import { myFeature } from '../my-feature';

describe('MyFeature Integration', () => {
  beforeAll(() => {
    featureRegistry.register(myFeature);
  });

  it('should initialize and cleanup properly', async () => {
    await featureRegistry.initialize('myFeature');
    expect(featureRegistry.getFeature('myFeature')).toBeDefined();

    await featureRegistry.cleanup('myFeature');
  });
});
```

## Best Practices

### 1. Feature Independence
- Features should be as independent as possible
- Use dependency injection for shared services
- Avoid tight coupling between features

### 2. Configuration-Driven
- Use feature flags to control behavior
- Make features configurable through app-config.ts
- Support different configurations per environment

### 3. Error Handling
- Always handle errors gracefully
- Provide fallbacks when features fail
- Log errors for debugging

### 4. Performance
- Initialize features lazily when possible
- Clean up resources properly
- Use React.memo and useMemo for expensive operations

### 5. Testing
- Write unit tests for services and hooks
- Test component rendering and user interactions
- Test feature initialization and cleanup

### 6. Documentation
- Document feature configuration options
- Provide examples of usage
- Keep feature descriptions up to date

## Advanced Patterns

### Feature Communication

Features can communicate through events:

```typescript
// In your service
import { EventEmitter } from 'events';

class MyFeatureService extends EventEmitter {
  async doSomething() {
    // Do work
    this.emit('workCompleted', { data: 'result' });
  }
}

// In another feature
myFeatureService.on('workCompleted', (data) => {
  console.log('Work completed:', data);
});
```

### Dynamic Feature Loading

For large features, consider dynamic imports:

```typescript
export const myFeature: FeatureModule = {
  // ... other properties

  components: {
    MyFeatureSettings: React.lazy(() =>
      import('./MyFeatureSettings').then(m => ({ default: m.MyFeatureSettings }))
    ),
  },
};
```

### Feature Middleware

Add middleware for common functionality:

```typescript
const withFeatureLogging = (service: any) => {
  return new Proxy(service, {
    get(target, prop) {
      const originalMethod = target[prop];
      if (typeof originalMethod === 'function') {
        return function(...args: any[]) {
          console.log(`Calling ${String(prop)} with args:`, args);
          return originalMethod.apply(target, args);
        };
      }
      return originalMethod;
    },
  });
};
```

## Troubleshooting

### Common Issues

1. **Feature not initializing**: Check that the feature flag is enabled and the feature is registered
2. **Component not rendering**: Verify the feature is enabled and properly imported
3. **API calls failing**: Check backend endpoints and authentication
4. **Dependency errors**: Ensure required features are enabled and initialized first

### Debugging

Enable debug logging:
```typescript
// In app-config.ts
enableDebugMode: __DEV__,

// In your service
if (APP_CONFIG.features.enableDebugMode) {
  console.log('Debug info:', data);
}
```

Use the feature registry to inspect features:
```typescript
console.log('Enabled features:', featureRegistry.getEnabledFeatures());
console.log('Feature details:', featureRegistry.getFeature('myFeature'));
```
