# Firebase Rules Setup Guide

## Current Issue
Your app is getting "Missing or insufficient permissions" errors when trying to sync with Firestore.

## Root Cause
Firestore security rules are blocking access. Rules need to be updated to allow authenticated users.

---

## ✅ Solution: Update Firestore Rules

### Step 1: Access Firebase Console
1. Go to: https://console.firebase.google.com/
2. Select project: **cocona-472b7**
3. Click **"Firestore Database"** in left sidebar
4. Click **"Rules"** tab at the top

### Step 2: Replace Rules
**Delete everything** in the rules editor and paste this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Step 3: Publish
1. Click the blue **"Publish"** button
2. Wait for "Rules published successfully" message
3. **Wait 60 seconds** for rules to propagate

### Step 4: Verify
After publishing, the rules editor should show:
- **Status:** Published
- **Timestamp:** [current time]

---

## 🧪 Testing After Fix

### Test 1: Restart App
1. **Force close** the app (don't just minimize)
2. **Reopen** the app
3. **Sign in** with your account

### Test 2: Check Console Logs
You should see:
```
✅ Email sign-in successful: [your email]
🔑 Auth user ID: [your user ID]
🔑 Auth user email: [your email]
🧪 Testing Firestore connection...
✅ Firestore connection test passed
📄 Checking user document...
✅ Sync completed successfully
```

### Test 3: Manual Sync
1. Go to **Settings** screen
2. Tap **"Sync Now"**
3. Should see success message

### Test 4: Auto-Sync
1. Go to **Dashboard**
2. Create a new entry
3. Wait 2-3 seconds
4. Check console for: `🔄 Auto-sync triggered by data change`
5. Go to Firebase Console → Firestore Database
6. You should see your data in `userData/[your-user-id]`

---

## 🚨 If Still Not Working

### Check 1: Verify Rules Were Actually Published
- Refresh Firebase Console page
- Go to Rules tab
- Verify timestamp is recent (within last few minutes)
- Rules should match exactly what you pasted

### Check 2: Verify User Is Authenticated
Check console logs for:
```
🔑 Auth user ID: [should show a long ID]
🔑 Auth user email: [should show your email]
```

If these are `null` or `undefined`, the issue is authentication, not rules.

### Check 3: Clear App Data
Sometimes cached auth tokens cause issues:
1. Go to device Settings → Apps → [Your App]
2. Tap "Clear Data" and "Clear Cache"
3. Reopen app
4. Sign in again

### Check 4: Check Internet Connection
- Ensure device/emulator has internet
- Try opening a website in the device browser
- Firebase requires internet to connect

---

## 🔐 Understanding the Rules

The rules we're using:
```
match /{document=**} {
  allow read, write: if request.auth != null;
}
```

This means:
- ✅ **Allow:** Any authenticated user can read/write any document
- ❌ **Deny:** Unauthenticated users cannot access anything

**Note:** This is permissive for development. For production, you'd want more restrictive rules like:
```
match /userData/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

---

## 📞 Need More Help?

If you're still stuck, provide:
1. Screenshot of Firebase Console → Rules tab (showing published status)
2. Full console logs from app startup through sync attempt
3. Screenshot of Firebase Console → Authentication tab (showing your user account)

This will help diagnose the exact issue.
