# Firebase Firestore Security Rules Setup

## Current Issue
```
ERROR: Missing or insufficient permissions
```

This occurs because Firestore security rules are either:
- In test mode (expired after 30 days)
- Too restrictive
- Not properly configured for authenticated users

## Solution: Update Firestore Security Rules

### Step 1: Open Firebase Console
1. Go to https://console.firebase.google.com
2. Select your project
3. Navigate to **Firestore Database** → **Rules** tab

### Step 2: Replace Rules with Production-Ready Configuration

Replace your current rules with these:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    // Users collection: Users can read/write their own document
    match /users/{userId} {
      allow read, write: if isSignedIn() && isOwner(userId);
      
      // Allow users to create their own document on first sign-in
      allow create: if isSignedIn() && request.auth.uid == userId;
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Step 3: Publish Rules
Click **"Publish"** button in Firebase Console

### Step 4: Verify Rules Work
Reload your app and check if sync works.

---

## Alternative: Temporary Test Mode (Development Only)

**⚠️ WARNING: Only use this for development/testing!**

If you need to quickly test and debug, you can temporarily use test mode:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      // WARNING: Allows all reads and writes for 30 days
      // DO NOT USE IN PRODUCTION!
      allow read, write: if request.time < timestamp.date(2025, 11, 15);
    }
  }
}
```

This allows all access until November 15, 2025. **Replace with production rules before deploying!**

---

## Understanding the Production Rules

### What Each Rule Does:

1. **`isSignedIn()`**: Checks if user is authenticated via Firebase Auth
   ```javascript
   function isSignedIn() {
     return request.auth != null;
   }
   ```

2. **`isOwner(userId)`**: Verifies the authenticated user owns the document
   ```javascript
   function isOwner(userId) {
     return request.auth.uid == userId;
   }
   ```

3. **User Document Access**: 
   - Users can only read/write their own data (`/users/{userId}`)
   - `{userId}` must match `request.auth.uid`
   
   ```javascript
   match /users/{userId} {
     allow read, write: if isSignedIn() && isOwner(userId);
   }
   ```

### Data Structure Supported:
```
/users/{userId}/
  ├─ books: []           // User's books
  ├─ entries: []         // User's entries
  ├─ categories: []      // User's categories
  └─ lastSyncAt: timestamp
```

---

## Debugging Permission Issues

### Check Auth State in Console:
Look for these logs when app loads:
```
✅ GOOD: "LOG  👤 Authenticated user: {uid: '...'}"
❌ BAD:  "LOG  👤 No authenticated user"
```

If you see "No authenticated user", the issue is:
- User not signed in
- Firebase Auth not initialized properly
- Token expired

### Check Firestore Request:
```javascript
// In AuthContext.tsx, add debug logging:
console.log('🔐 Auth state:', {
  hasAuth: !!auth.currentUser,
  uid: auth.currentUser?.uid,
  email: auth.currentUser?.email
});
```

### Test Rules in Firebase Console:
1. Go to Firestore Database → Rules
2. Click **"Rules Playground"** tab
3. Test these scenarios:
   - **Authenticated as**: `user123@example.com`
   - **Location**: `/users/user123`
   - **Read**: Should be ✅ Allowed
   - **Write**: Should be ✅ Allowed
   
   - **Location**: `/users/otherUser456`
   - **Read**: Should be ❌ Denied
   - **Write**: Should be ❌ Denied

---

## Next Steps After Fixing Rules

1. **Restart your app** (press `r` in Metro terminal)
2. **Sign in** if not already signed in
3. **Test sync** by pulling down to refresh
4. **Watch logs** for:
   ```
   📥 Step 1: PULL - Downloading data from Firebase...
   ✅ Git-style sync complete!
   ```

---

## Common Issues & Solutions

### Issue 1: "Auth token expired"
**Solution**: Sign out and sign in again

### Issue 2: "User not found in Firestore"
**Solution**: The first sync will create the user document automatically

### Issue 3: Rules work in test mode but not production mode
**Solution**: Make sure user is properly authenticated with Firebase Auth before calling Firestore

### Issue 4: "Permission denied" only on specific operations
**Solution**: Check if you're trying to access another user's data

---

## Security Best Practices

✅ **DO:**
- Use authentication for all operations
- Validate user owns the data being accessed
- Use server timestamps (`serverTimestamp()`)
- Limit document size (max 1MB per document)

❌ **DON'T:**
- Leave test mode rules in production
- Store sensitive data in Firestore without encryption
- Allow unrestricted read/write access
- Trust client-side validation alone

---

## Quick Fix Command

Copy and paste these rules into Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    match /users/{userId} {
      allow read, write: if isSignedIn() && isOwner(userId);
      allow create: if isSignedIn() && request.auth.uid == userId;
    }
    
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Then click **Publish** ✅

Your app should work immediately after publishing!
