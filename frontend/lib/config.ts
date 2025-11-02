/**
 * Central configuration for the base app
 * Supports multiple environments: development, staging, production
 */

type Environment = 'development' | 'staging' | 'production';

// Get current environment
const getEnvironment = (): Environment => {
  const env = process.env.EXPO_PUBLIC_ENVIRONMENT?.toLowerCase();
  if (env === 'production' || env === 'prod') return 'production';
  if (env === 'staging' || env === 'stage') return 'staging';
  return 'development';
};

// Read an API base URL with precedence:
// 1) Environment-specific EXPO_PUBLIC_API_URL_<ENV>
// 2) Generic EXPO_PUBLIC_API_URL
// 3) Hardcoded default for the template
const readApiUrl = (env: Environment, defaultUrl: string): string => {
  const generic = process.env.EXPO_PUBLIC_API_URL;
  const specific =
    env === 'development'
      ? process.env.EXPO_PUBLIC_API_URL_DEVELOPMENT
      : env === 'staging'
        ? process.env.EXPO_PUBLIC_API_URL_STAGING
        : process.env.EXPO_PUBLIC_API_URL_PRODUCTION;
  return specific || generic || defaultUrl;
};

// Environment-specific configurations
const ENV_CONFIGS = {
  development: {
    api: {
      baseUrl: readApiUrl('development', 'https://127.0.0.1:8000'),
    },
    debug: true,
  },
  staging: {
    api: {
      baseUrl: readApiUrl('staging', 'https://baseapp-staging.up.railway.app'),
    },
    debug: true,
  },
  production: {
    api: {
      baseUrl: readApiUrl('production', 'REPLACE_WITH_PROD_URL'),
    },
    debug: false,
  },
} as const;

const currentEnv = getEnvironment();
const envConfig = ENV_CONFIGS[currentEnv];

export const APP_CONFIG = {
  // Environment
  environment: currentEnv,
  debug: envConfig.debug,

  // App Identity
  name: 'Base App',
  version: '1.0.0',
  description: 'A modular base app for rapid development',

  // API Configuration
  api: {
    baseUrl: envConfig.api.baseUrl,
    timeout: 10000,
  },

  // Auth0 Configuration
  auth0: {
    domain: process.env.EXPO_PUBLIC_AUTH0_DOMAIN || '',
    clientId: process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID || '',
    audience: process.env.EXPO_PUBLIC_AUTH0_AUDIENCE || '',
  },

  // UI Configuration
  ui: {
    maxContentWidth: 800,
    enableDarkMode: true,
    enableHaptics: true,
  },

  // Feature Flags
  features: {
    profilePictures: true,
    userSettings: true,
    pushNotifications: false,
    analytics: false,
  },
} as const;

export type AppConfig = typeof APP_CONFIG;

// Always log API configuration for debugging
console.log('🔧 === APP CONFIGURATION ===');
console.log(`🌍 Environment: ${APP_CONFIG.environment}`);
console.log(`🔗 API Base URL: ${APP_CONFIG.api.baseUrl}`);
console.log(`🐛 Debug Mode: ${APP_CONFIG.debug}`);
console.log('=============================');

// Additional debug logging (opt-in via env)
if (
  process.env.EXPO_PUBLIC_DEBUG_CONFIG === '1' ||
  process.env.EXPO_PUBLIC_DEBUG_CONFIG === 'true'
) {
  console.log('📋 Full Configuration:', APP_CONFIG);
}
