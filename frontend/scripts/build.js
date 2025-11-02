#!/usr/bin/env node

/**
 * Build script for different environments
 * Usage: node scripts/build.js [platform] [environment] [options]
 *
 * Examples:
 *   node scripts/build.js ios production
 *   node scripts/build.js android staging
 *   node scripts/build.js web development
 */

const { spawn } = require('child_process');
const path = require('path');

const ENVIRONMENTS = ['development', 'staging', 'production'];
const PLATFORMS = ['ios', 'android', 'web', 'all'];

function showHelp() {
  console.log(`
🚀 Build Script for Base App

Usage: node scripts/build.js [platform] [environment] [options]

Platforms:
  ios         Build for iOS
  android     Build for Android
  web         Build for web
  all         Build for both iOS and Android

Environments:
  development  Local development server (default)
  staging      Staging server
  production   Production server

Options:
  --api-url    Override API URL (e.g., --api-url=https://my-api.com)
  --help       Show this help message

Examples:
  node scripts/build.js ios production
  node scripts/build.js android staging --api-url=https://my-custom-api.com
  node scripts/build.js web development
  node scripts/build.js all production

Environment Variables:
  The script will set EXPO_PUBLIC_ENVIRONMENT automatically.
  Use --api-url to override the default API URL for the environment.
`);
}

function parseArgs(args) {
  const platform = args[0];
  const environment = args[1] || 'development';

  let apiUrl = null;
  let showHelpFlag = false;

  args.forEach(arg => {
    if (arg === '--help' || arg === '-h') {
      showHelpFlag = true;
    } else if (arg.startsWith('--api-url=')) {
      apiUrl = arg.split('=')[1];
    }
  });

  return { platform, environment, apiUrl, showHelpFlag };
}

function validateArgs(platform, environment) {
  if (!platform || !PLATFORMS.includes(platform)) {
    console.error(`❌ Invalid platform: ${platform}`);
    console.error(`Valid platforms: ${PLATFORMS.join(', ')}`);
    return false;
  }

  if (!ENVIRONMENTS.includes(environment)) {
    console.error(`❌ Invalid environment: ${environment}`);
    console.error(`Valid environments: ${ENVIRONMENTS.join(', ')}`);
    return false;
  }

  return true;
}

function runBuild(platform, environment, apiUrl) {
  console.log(`\n🏗️  Building ${platform} app for ${environment} environment`);

  const env = {
    ...process.env,
    EXPO_PUBLIC_ENVIRONMENT: environment,
  };

  if (apiUrl) {
    env.EXPO_PUBLIC_API_URL = apiUrl;
    console.log(`🔗 Using custom API URL: ${apiUrl}`);
  }

  let command, args;

  if (platform === 'web') {
    command = 'yarn';
    args = [`build:web:${environment}`];
  } else {
    // For mobile builds, use EAS
    command = 'eas';
    args = ['build', '--platform', platform === 'all' ? 'all' : platform, '--profile', environment];
  }

  console.log(`📋 Running: ${command} ${args.join(' ')}`);
  console.log(`🌍 Environment: ${environment}`);
  console.log(`📱 Platform: ${platform}`);
  console.log('');

  const child = spawn(command, args, {
    env,
    stdio: 'inherit',
    cwd: path.dirname(__dirname),
  });

  child.on('close', code => {
    if (code === 0) {
      console.log(`\n✅ Build completed successfully!`);
    } else {
      console.log(`\n❌ Build failed with exit code ${code}`);
      process.exit(code);
    }
  });

  child.on('error', error => {
    console.error(`❌ Build error: ${error.message}`);
    process.exit(1);
  });
}

// Main execution
const args = process.argv.slice(2);
const { platform, environment, apiUrl, showHelpFlag } = parseArgs(args);

if (showHelpFlag || args.length === 0) {
  showHelp();
  process.exit(0);
}

if (!validateArgs(platform, environment)) {
  showHelp();
  process.exit(1);
}

runBuild(platform, environment, apiUrl);
