# 🔧 "Sometimes Works, Sometimes Doesn't" - Fix Guide

## 🐛 The Problem

You're experiencing intermittent sync failures with this error:
```
❌ Firestore connection test failed: [FirebaseError: Missing or insufficient permissions.]
```

**Why it's intermittent:** Firebase Auth tokens take time to propagate to Firestore. Sometimes the sync happens before the token is ready.

---

## ✅ What Was Fixed

### 1. **Added Auth Token Refresh**
```typescript
// Force token refresh to ensure it's valid
const idToken = await auth.currentUser.getIdToken(true); // force refresh
```
**Why:** Ensures the auth token is fresh and valid before Firestore calls

### 2. **Added Retry Logic with Backoff**
```typescript
// Try up to 3 times with increasing delays
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    await getDoc(testRef);
    break; // Success!
  } catch (error) {
    if (error.code === 'permission-denied' && attempt < 3) {
      // Wait 500ms, then 1000ms before retrying
      await new Promise(resolve => setTimeout(resolve, attempt * 500));
    }
  }
}
```
**Why:** Gives auth token time to propagate to Firestore backend

### 3. **Better Error Messages**
```typescript
throw new Error('Access denied. Auth token not ready or Firestore security rules issue.\n\nTroubleshooting:\n1. Wait a few seconds and try again\n2. Sign out and sign in again\n3. Check Firestore security rules in Firebase Console');
```
**Why:** Helps you understand what's happening and how to fix it

---

## 🧪 How to Test

### Test 1: Fresh Login Sync
1. Sign out completely
2. Sign in again
3. **Immediately** tap "Sync Now"
4. **Expected:** Should succeed (might see retry messages)

**Console logs to watch for:**
```
🔐 Validating authentication token...
🔄 Refreshing auth token...
✅ Auth token refreshed, length: 1234
🧪 Testing Firestore connection...
🔄 Connection attempt 1/3...
✅ Firestore connection test passed
```

### Test 2: After Idle Period
1. Leave app idle for 10+ minutes (token expires)
2. Come back and tap "Sync Now"
3. **Expected:** Should succeed after token refresh

**Console logs to watch for:**
```
🔄 Refreshing auth token...
✅ Auth token refreshed
🔄 Connection attempt 1/3...
⚠️ Attempt 1 failed: permission-denied
⏳ Waiting 500ms for auth to propagate...
🔄 Connection attempt 2/3...
✅ Firestore connection test passed
```

### Test 3: Multiple Rapid Syncs
1. Tap "Sync Now" 3 times quickly
2. **Expected:** All should succeed (or skip if already syncing)

---

## 🔍 Understanding the Logs

### Success Pattern:
```
🔐 Validating authentication token...
✅ Auth token refreshed, length: 1234
🧪 Testing Firestore connection...
🔄 Connection attempt 1/3...
✅ Firestore connection test passed
📄 Checking user document...
✅ Sync completed
```

### Retry Pattern (Normal):
```
🔐 Validating authentication token...
✅ Auth token refreshed
🧪 Testing Firestore connection...
🔄 Connection attempt 1/3...
⚠️ Attempt 1 failed: permission-denied
⏳ Waiting 500ms for auth to propagate...
🔄 Connection attempt 2/3...
✅ Firestore connection test passed
✅ Sync completed
```

### Still Failing (Check Rules):
```
🔐 Validating authentication token...
✅ Auth token refreshed
🧪 Testing Firestore connection...
🔄 Connection attempt 1/3...
⚠️ Attempt 1 failed: permission-denied
⏳ Waiting 500ms for auth to propagate...
🔄 Connection attempt 2/3...
⚠️ Attempt 2 failed: permission-denied
⏳ Waiting 1000ms for auth to propagate...
🔄 Connection attempt 3/3...
⚠️ Attempt 3 failed: permission-denied
❌ Firestore connection test failed after all attempts
```

**If you see this:** Your Firestore security rules are not properly configured!

---

## 🔧 Manual Fixes

### If Still Having Issues:

#### Fix 1: Sign Out and Back In
```typescript
// This refreshes all auth tokens
1. Tap "Sign Out" in app
2. Close app completely
3. Reopen app
4. Sign in again
5. Try syncing
```

#### Fix 2: Check Firestore Rules (Again)
Go to Firebase Console:
1. Firestore Database → Rules
2. Verify you see:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
3. Check the timestamp - should be recent
4. If not, republish the rules

#### Fix 3: Clear App Data
```
Settings → Apps → Your App → Clear Data
(Then sign in again)
```

---

## 🎓 Why This Happens

### Firebase Auth Token Lifecycle:
```
1. User signs in
   ↓
2. Firebase generates auth token (JWT)
   ↓
3. Token needs to propagate to all Firebase services
   ↓ (This takes 100-1000ms)
4. Firestore backend receives token
   ↓
5. Firestore can validate requests with request.auth
```

### The Race Condition:
```
User signs in → App tries to sync immediately
             ↓
          Token not propagated yet
             ↓
          permission-denied error
```

### The Fix:
```
User signs in → Force token refresh
             ↓
          Try connection
             ↓
          If fails, wait and retry
             ↓
          Success!
```

---

## 📊 Technical Details

### Auth Token Refresh:
```typescript
await auth.currentUser.getIdToken(true); // true = force refresh
```
- **When to use:** Before any Firestore operation
- **What it does:** Ensures token is fresh (not expired)
- **Cost:** Negligible (cached for 1 hour)

### Retry Backoff Strategy:
```
Attempt 1: Immediate (0ms wait)
Attempt 2: 500ms wait
Attempt 3: 1000ms wait
Total max delay: 1.5 seconds
```

### Why 3 Attempts?
- Attempt 1: Catches already-ready tokens (fast path)
- Attempt 2: Allows 500ms propagation (catches most cases)
- Attempt 3: Allows 1500ms total (catches slow networks)

---

## ✅ Expected Behavior After Fix

### What Should Happen:
- ✅ Sync works **consistently** after sign-in
- ✅ Sync works after idle periods
- ✅ Rarely see retry attempts (only on slow networks)
- ✅ Clear error messages when rules are wrong

### What Should NOT Happen:
- ❌ Random "permission-denied" errors
- ❌ Need to restart app to make sync work
- ❌ Sync works once then fails

---

## 🚨 When to Worry

If you still see failures after this fix:

### Scenario 1: All 3 Attempts Fail
**Problem:** Firestore rules are wrong
**Solution:** Follow `FIREBASE_RULES_SETUP.md` exactly

### Scenario 2: Token Refresh Fails
```
❌ Token refresh failed: [Error: ...]
```
**Problem:** Auth state is corrupted
**Solution:** Sign out and sign in again

### Scenario 3: Works in One Place, Not Another
**Problem:** Multiple Firebase projects or API keys
**Solution:** Check `src/services/firebase.ts` config

---

## 💡 Pro Tips

### 1. Always Wait After Sign-In
```typescript
// In your login flow:
await signIn(email, password);
await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
await syncNow(); // Now sync will work
```

### 2. Add Sync Status Indicator
Show user when sync is retrying:
```typescript
if (attempt > 1) {
  setStatus(`Connecting... (attempt ${attempt}/3)`);
}
```

### 3. Batch Operations
Instead of syncing after every change, batch them:
```typescript
// Auto-sync already does this with 2-second debounce
// No need to change anything
```

---

## 📝 Testing Checklist

After this fix, verify:

- [ ] Fresh sign-in → sync works immediately
- [ ] After 10 min idle → sync still works
- [ ] Multiple rapid syncs → no errors
- [ ] Sign out/in → sync works
- [ ] Poor network → retries work
- [ ] Wrong rules → clear error message

---

## 🎉 Summary

**What was happening:**
- Auth token wasn't ready when sync tried to access Firestore
- Race condition between auth and sync

**What's fixed:**
- ✅ Force token refresh before sync
- ✅ Retry with backoff (up to 3 attempts)
- ✅ Clear error messages
- ✅ Better logging for debugging

**Result:**
- 🎯 Sync should work **consistently** now
- 🎯 Rare retry attempts on slow networks (expected)
- 🎯 Clear feedback when something is wrong

**Try it now and let me know if you still see issues!** 🚀
