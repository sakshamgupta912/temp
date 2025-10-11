# Firebase Setup Guide for Expo

Since you're using Expo, you'll need to make some adjustments to use Firebase properly. Here's what you need to do:

## 1. Install Expo-Compatible Firebase Packages

The packages I installed earlier are for bare React Native. For Expo, run:

```bash
npm uninstall @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore @react-native-firebase/storage @react-native-google-signin/google-signin @react-native-community/netinfo

npm install expo-auth-session expo-crypto expo-web-browser @react-native-async-storage/async-storage
```

## 2. Update Firebase Configuration

Your `src/services/firebase.ts` is already set up correctly for Expo using the Web SDK.

**Update the configuration with your actual Firebase project details:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing project
3. Add a web app to your project
4. Copy the config object and replace the values in `firebase.ts`
5. Enable Authentication and Firestore Database in Firebase Console
6. Enable Google Sign-In provider in Authentication > Sign-in method

## 3. Configure Google Sign-In

Create a Google Cloud Console project and configure OAuth:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create credentials (OAuth 2.0 Client IDs)
3. For web application, add your domains
4. For Android, add your package name and SHA-1 fingerprint
5. For iOS, add your bundle identifier

## 4. Update Services for Expo Compatibility

I'll need to rewrite the Firebase services to use Expo-compatible packages instead of React Native Firebase.

## 5. Test the Integration

After updating the configuration:

1. Start your Expo development server
2. Test Google Sign-In functionality
3. Verify data sync with Firestore

## Current Status

✅ Installed packages
✅ Added missing types
✅ Fixed compilation errors
❌ Need to update services for Expo compatibility
❌ Need Firebase project configuration

## Next Steps

1. Uninstall React Native Firebase packages and install Expo packages
2. Update the services to use Expo APIs
3. Configure your Firebase project
4. Test the implementation

Would you like me to proceed with updating the services for Expo compatibility?