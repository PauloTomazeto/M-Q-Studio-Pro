/**
 * Jest Global Setup File
 * Initializes global test configuration and mocks
 */

// Suppress console output in tests
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

beforeAll(() => {
  // Only show errors and warnings from our code, not from dependencies
  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    if (message.includes('Not implemented') || message.includes('SKIP')) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    if (message.includes('Not implemented') || message.includes('SKIP')) {
      return;
    }
    originalWarn.call(console, ...args);
  };

  console.log = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    if (message.includes('✓') || message.includes('✅') || message.includes('✔️')) {
      originalLog.call(console, ...args);
    }
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
});

// Global timeout for async tests
jest.setTimeout(30000);

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = jest.fn();
}

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.VITE_FIREBASE_API_KEY = 'test_key';
process.env.VITE_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
process.env.VITE_FIREBASE_PROJECT_ID = 'test_project';
process.env.VITE_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
process.env.VITE_FIREBASE_MESSAGING_SENDER_ID = '123456789';
process.env.VITE_FIREBASE_APP_ID = 'test_app_id';
process.env.VITE_KIE_API_BASE_URL = 'http://localhost:3000/api';
