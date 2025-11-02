// Jest setup file for frontend tests

// Mock React Native for testing
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  StyleSheet: {
    create: styles => styles,
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Suppress React Native warnings during tests
jest.mock('react-native/Libraries/Utilities/warnOnce', () => () => {});

// Mock expo modules that might cause coverage issues
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {},
    manifest: {},
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  Link: ({ children, ...props }) => children,
}));
