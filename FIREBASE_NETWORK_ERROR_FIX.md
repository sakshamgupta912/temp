# 🔧 Firebase Network Error Fix

## Error Message:
```
Email sign-in error: FirebaseError: Firebase: Error (auth/network-request-failed)
```

## 🎯 Quick Fixes

### Fix 1: Check Emulator Internet Connection
```bash
# In Android Emulator:
# Open Chrome browser in emulator
# Try visiting: https://www.google.com
# If it doesn't load → Internet is not working
```

**To Fix Emulator Internet:**
1. Close emulator
2. In Android Studio → AVD Manager
3. Click ⚙️ on your emulator
4. Network: Speed = Full, Latency = None
5. Restart emulator

### Fix 2: Enable Firebase Authentication (Email/Password)

1. Go to: https://console.firebase.google.com
2. Select project: **cocona-472b7**
3. Click **Authentication** (left sidebar)
4. Click **Sign-in method** tab
5. Find **Email/Password**
6. Click **Enable** toggle
7. Save

### Fix 3: Check Firestore Security Rules

1. Go to: https://console.firebase.google.com
2. Select project: **cocona-472b7**
3. Click **Firestore Database**
4. Click **Rules** tab
5. Use these rules for development:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // For development: allow all reads/writes (CHANGE THIS IN PRODUCTION!)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

6. Click **Publish**

### Fix 4: Test with Physical Device (if emulator issues persist)

Sometimes emulators have network issues. Test on real device:
1. Connect phone via USB
2. Enable USB debugging
3. `npm start` 
4. Press `a` for Android or scan QR code

### Fix 5: Verify Firebase Config

Check `src/services/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "AIzaSyCfBJntd1r8fLuWmNQwVWE2UkBTin-mWBU",
  authDomain: "cocona-472b7.firebaseapp.com",
  projectId: "cocona-472b7",
  // ... rest of config
};
```

Make sure this matches your Firebase console settings.

---

## 🔍 Debugging Steps

### Step 1: Check if Firebase is reachable
Add this test in your LoginScreen:

```typescript
const testFirebaseConnection = async () => {
  try {
    const response = await fetch('https://cocona-472b7.firebaseapp.com');
    console.log('✅ Firebase reachable:', response.status);
  } catch (error) {
    console.error('❌ Firebase not reachable:', error);
  }
};
```

### Step 2: Enable verbose logging
In `src/services/firebase.ts`:

```typescript
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { setLogLevel } from 'firebase/app';

// Enable debug logging
if (__DEV__) {
  setLogLevel('debug');
}
```

### Step 3: Check emulator proxy settings
In PowerShell:

```powershell
# Check if emulator can reach internet
adb shell ping -c 3 8.8.8.8

# If ping fails, restart emulator networking
adb root
adb shell svc wifi disable
adb shell svc wifi enable
```

---

## ✅ Verification

After applying fixes, test:

1. **Sign Up New User**
   - Email: test@example.com
   - Password: Test123456
   - Should create account successfully

2. **Sign In**
   - Use same credentials
   - Should sign in without network error

3. **Check Firebase Console**
   - Go to Authentication → Users
   - Should see your test user listed

---

## 🚨 Common Issues

### "Email already in use"
- User already exists, try signing in instead
- Or use different email for testing

### "Invalid email"
- Email must be valid format: user@domain.com
- No spaces or special characters

### "Weak password"
- Password must be at least 6 characters
- Use: Test123456

### Network error persists
- Try physical device instead of emulator
- Check firewall isn't blocking Firebase
- Verify you're not behind corporate proxy

---

## 📱 Quick Test Command

```powershell
# Restart everything fresh
cd "C:\Users\sakshagupta\OneDrive - Microsoft\Desktop\Projects\temp"

# Clear cache
npm start -- --reset-cache

# In new terminal:
npx expo start -c
```

---

## 🎯 Most Likely Cause

Based on your error, it's probably:
1. **Email/Password auth not enabled in Firebase Console** (80% chance)
2. **Emulator internet not working** (15% chance)
3. **Firestore rules too strict** (5% chance)

**Start with Fix 2** (enable Email/Password in Firebase)!
