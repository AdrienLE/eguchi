import { APP_CONFIG } from '../lib/config';

export const API_URL = APP_CONFIG.api.baseUrl;

// Log the API URL for debugging
console.log(`=== API Configuration ===`);
console.log(`API_URL: ${API_URL}`);
console.log(`EXPO_PUBLIC_API_URL env: ${process.env.EXPO_PUBLIC_API_URL}`);
console.log(`========================`);
