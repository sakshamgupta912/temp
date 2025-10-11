# Installation Script for Firebase & Google Sign-In

## Step 1: Install Required Packages

Run this command in your project root:

```bash
npm install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore @react-native-firebase/storage @react-native-google-signin/google-signin @react-native-community/netinfo
```

## Step 2: Update package.json Dependencies

Your package.json should include these dependencies:

```json
{
  "dependencies": {
    "@react-native-firebase/app": "^18.6.1",
    "@react-native-firebase/auth": "^18.6.1",
    "@react-native-firebase/firestore": "^18.6.1",
    "@react-native-firebase/storage": "^18.6.1",
    "@react-native-google-signin/google-signin": "^10.1.0",
    "@react-native-community/netinfo": "^11.0.0"
  }
}
```

## Step 3: Configure Firebase

### 3.1 Download Configuration Files

From Firebase Console (https://console.firebase.google.com/):

**For Android:**
1. Go to Project Settings → Your apps
2. Select your Android app (or add one)
3. Download `google-services.json`
4. Place it in: `android/app/google-services.json`

**For iOS:**
1. Go to Project Settings → Your apps
2. Select your iOS app (or add one)  
3. Download `GoogleService-Info.plist`
4. Place it in: `ios/GoogleService-Info.plist`

### 3.2 Android Configuration

Edit `android/build.gradle`:
```gradle
buildscript {
  dependencies {
    // Add this line
    classpath 'com.google.gms:google-services:4.3.15'
  }
}
```

Edit `android/app/build.gradle`:
```gradle
// At the bottom of the file, add:
apply plugin: 'com.google.gms.google-services'
```

### 3.3 iOS Configuration

Install CocoaPods dependencies:
```bash
cd ios
pod install
cd ..
```

## Step 4: Enable Google Sign-In

### 4.1 Get Web Client ID

From Firebase Console:
1. Go to Authentication → Sign-in method
2. Click on Google
3. Copy the "Web SDK configuration" → Web client ID
4. Update `src/config/firebaseConfig.ts` with this value

### 4.2 iOS Setup

Add to `ios/[YourApp]/Info.plist`:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <!-- Replace with your REVERSED_CLIENT_ID from GoogleService-Info.plist -->
      <string>com.googleusercontent.apps.YOUR-CLIENT-ID</string>
    </array>
  </dict>
</array>
```

### 4.3 Android Setup

Add to `android/app/build.gradle`:
```gradle
dependencies {
  implementation 'com.google.android.gms:play-services-auth:20.7.0'
}
```

## Step 5: Update Firebase Config File

Edit `src/config/firebaseConfig.ts` and replace with your actual values:

```typescript
export const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456",
};

export const googleSignInConfig = {
  webClientId: "YOUR-WEB-CLIENT-ID.apps.googleusercontent.com",
  offlineAccess: true,
  forceCodeForRefreshToken: true,
};
```

## Step 6: Set Up Firestore Security Rules

In Firebase Console → Firestore Database → Rules, paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /books/{bookId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
        
        match /entries/{entryId} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
      }
      
      match /preferences/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /sync_metadata/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## Step 7: Update AppPreferences Interface

Add autoSync property to preferences:

Edit `src/services/preferences.ts`:

```typescript
export interface AppPreferences {
  currency: string;
  theme?: 'light' | 'dark' | 'auto';
  autoSync?: boolean; // Add this line
  // ... other properties
}
```

## Step 8: Rebuild the App

After all configuration:

**For iOS:**
```bash
cd ios
pod install
cd ..
npx react-native run-ios
```

**For Android:**
```bash
npx react-native run-android
```

## Step 9: Verify Installation

Test Firebase connection by adding this to `App.tsx`:

```typescript
import firestore from '@react-native-firebase/firestore';

useEffect(() => {
  firestore()
    .collection('test')
    .add({ test: true, timestamp: new Date() })
    .then(() => console.log('✅ Firestore connected!'))
    .catch(err => console.error('❌ Firestore error:', err));
}, []);
```

## Troubleshooting

### Common Issues:

**1. "Default FirebaseApp is not initialized"**
- Check if google-services.json (Android) or GoogleService-Info.plist (iOS) is in correct location
- Rebuild the app

**2. "Google Sign-In not configured"**
- Verify webClientId in firebaseConfig.ts
- Check if Google Sign-In is enabled in Firebase Console

**3. "Module not found: @react-native-firebase"**
- Run `npm install` again
- Clear cache: `npm start --reset-cache`
- For iOS: `cd ios && pod install`

**4. "Play Services not available" (Android)**
- Make sure Google Play Services is installed on device/emulator
- Update Play Services on device

**5. "Permission denied" in Firestore**
- Check Firestore security rules
- Ensure user is authenticated before accessing data

## Next Steps

Once installation is complete:
1. Update AuthContext to support Google login
2. Add Google Sign-In button to LoginScreen
3. Test the sync functionality
4. Add sync status indicators to UI

## Support

If you encounter issues:
1. Check Firebase Console for errors
2. Check React Native logs: `npx react-native log-ios` or `log-android`
3. Verify all configuration files are in place
4. Ensure Firebase project is properly set up

Happy coding! 🚀