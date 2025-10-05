# Firebase & Google Login Setup Guide

## Prerequisites

Before implementing, you need to:

1. **Create Firebase Project**
   - Go to https://console.firebase.google.com/
   - Click "Add Project"
   - Name it (e.g., "khata-book-app")
   - Enable Google Analytics (optional)

2. **Enable Authentication**
   - In Firebase Console → Authentication
   - Click "Sign-in method"
   - Enable "Email/Password" (already used)
   - Enable "Google" sign-in provider
   - Add support email

3. **Create Firestore Database**
   - In Firebase Console → Firestore Database
   - Click "Create database"
   - Start in "production mode" (we'll set rules later)
   - Choose location (closest to your users)

4. **Add Firebase to Your Expo App**

### For iOS:
- Download `GoogleService-Info.plist` from Firebase Console
- Place in project root or ios/ folder

### For Android:
- Download `google-services.json` from Firebase Console
- Place in project root or android/app/ folder

## Required Dependencies

Run these commands to install all necessary packages:

```bash
# Core Firebase SDK
npm install @react-native-firebase/app

# Firebase Authentication
npm install @react-native-firebase/auth

# Firestore Database
npm install @react-native-firebase/firestore

# Firebase Storage (for attachments)
npm install @react-native-firebase/storage

# Google Sign-In
npm install @react-native-google-signin/google-signin

# Network info (for offline detection)
npm install @react-native-community/netinfo

# Optional: Analytics
npm install @react-native-firebase/analytics
```

## Expo Configuration

If using Expo (managed workflow), you need to use EAS Build or eject to bare workflow:

### Option 1: EAS Build (Recommended)
```bash
npm install -g eas-cli
eas build:configure
```

Add to `app.json`:
```json
{
  "expo": {
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.YOUR-CLIENT-ID"
        }
      ]
    ],
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "android": {
      "googleServicesFile": "./google-services.json",
      "package": "com.yourcompany.khatabook"
    }
  }
}
```

### Option 2: Bare Workflow (if already ejected)
Follow standard React Native Firebase setup:
- iOS: Add GoogleService-Info.plist to Xcode project
- Android: Add google-services.json to android/app/

## Firebase Configuration File

The implementation assumes your Firebase config will be in:
- `src/config/firebaseConfig.ts`

You'll need:
- API Key
- Auth Domain  
- Project ID
- Storage Bucket
- Messaging Sender ID
- App ID

All these are available in Firebase Console → Project Settings

## Environment Variables (Optional but Recommended)

Create `.env` file:
```env
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-app.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc123
GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

Install env package:
```bash
npm install react-native-dotenv
```

## Firestore Security Rules

Set these rules in Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Books subcollection
      match /books/{bookId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
        
        // Entries subcollection
        match /entries/{entryId} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
      }
    }
    
    // Preferences subcollection
    match /users/{userId}/preferences/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Testing Before Implementation

Before running the code:

1. **Test Firebase Connection**
   ```typescript
   import firestore from '@react-native-firebase/firestore';
   
   firestore()
     .collection('test')
     .add({ test: true })
     .then(() => console.log('Firebase connected!'));
   ```

2. **Test Google Sign-In**
   ```typescript
   import { GoogleSignin } from '@react-native-google-signin/google-signin';
   
   GoogleSignin.configure({
     webClientId: 'YOUR_WEB_CLIENT_ID',
   });
   ```

## Post-Installation Steps

After installing all packages:

1. **iOS:** 
   ```bash
   cd ios && pod install && cd ..
   ```

2. **Rebuild app:**
   ```bash
   npm run ios
   # or
   npm run android
   ```

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Your App                        │
│                                                  │
│  ┌────────────┐           ┌────────────┐       │
│  │   Local    │◄─────────►│  Firebase  │       │
│  │  Storage   │   Sync    │  Firestore │       │
│  │ (SQLite +  │           │  (Cloud)   │       │
│  │ AsyncStore)│           │            │       │
│  └────────────┘           └────────────┘       │
│        ▲                         ▲              │
│        │                         │              │
│        └──────┬──────────────────┘              │
│               │                                 │
│        ┌──────▼──────┐                         │
│        │ Sync Engine │                         │
│        │  (Conflict  │                         │
│        │  Resolution)│                         │
│        └─────────────┘                         │
└─────────────────────────────────────────────────┘
```

## Data Structure in Firestore

```
users/
  {userId}/
    profile: { email, displayName, photoURL }
    books/
      {bookId}/
        name, currency, createdAt, etc.
        entries/
          {entryId}/
            amount, date, category, etc.
    preferences/
      settings: { currency, theme, etc. }
    sync_metadata/
      last_sync: timestamp
      device_id: string
```

## Next Steps

Once you've completed the setup above, the implementation files will handle:
- ✅ Google authentication
- ✅ Automatic background sync
- ✅ Conflict resolution
- ✅ Offline queue
- ✅ Manual backup/restore
- ✅ Sync status indicators

## Troubleshooting

**"GoogleSignin not configured"**
- Make sure you called `GoogleSignin.configure()` before using

**"Missing GoogleService-Info.plist"**
- Download from Firebase Console and add to project

**"Auth domain not whitelisted"**
- Add your domain to Firebase Console → Authentication → Settings

**"Firestore permission denied"**
- Check security rules in Firestore console
- Ensure user is authenticated

**"Module not found: @react-native-firebase"**
- Run `npm install` again
- For iOS: `cd ios && pod install`
- Rebuild the app

## Ready to Proceed?

Once you've completed the Firebase setup and installed the packages, the implementation will provide:

1. **GoogleAuthService** - Handle Google Sign-In
2. **FirebaseSyncService** - Bidirectional data sync
3. **SyncQueue** - Offline changes queue
4. **ConflictResolver** - Handle data conflicts
5. **UI Components** - Sync indicators, settings
6. **Updated Screens** - Login, Settings, Data Export

Would you like me to proceed with the implementation?
