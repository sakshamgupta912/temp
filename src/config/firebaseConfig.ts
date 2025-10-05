// Firebase Configuration
// Place your Firebase project configuration here
// Get these values from Firebase Console → Project Settings → General

export const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.FIREBASE_APP_ID || "1:123456789:web:abc123",
};

// Google Sign-In Configuration
export const googleSignInConfig = {
  webClientId: process.env.GOOGLE_WEB_CLIENT_ID || "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
  offlineAccess: true,
  forceCodeForRefreshToken: true,
};

// Firestore Collections
export const COLLECTIONS = {
  USERS: 'users',
  BOOKS: 'books',
  ENTRIES: 'entries',
  PREFERENCES: 'preferences',
  SYNC_METADATA: 'sync_metadata',
  SYNC_QUEUE: 'sync_queue',
};

// Sync Settings
export const SYNC_SETTINGS = {
  AUTO_SYNC_INTERVAL: 5 * 60 * 1000, // 5 minutes
  BATCH_SIZE: 50, // Number of items to sync per batch
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // 2 seconds
  CONFLICT_RESOLUTION: 'last-write-wins' as 'last-write-wins' | 'manual',
};

export default firebaseConfig;
