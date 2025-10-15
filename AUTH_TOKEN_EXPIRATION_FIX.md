# Firebase Auth Token Expiration Fix

## Problem

Firebase Auth tokens expire after **1 hour**. When the token expires:
- Firestore requests fail with "Missing or insufficient permissions"
- User has to manually sign out and sign back in
- Sync operations fail until user re-authenticates

## Root Cause

Firebase automatically refreshes tokens in web browsers, but in React Native/Expo:
1. Token refresh needs to be handled explicitly
2. Auth state persistence may not work properly
3. Background token refresh isn't automatic

## Solution: Multi-Layer Fix

### 1. Enable Proper Auth Persistence (CRITICAL)

Your current Firebase initialization is missing AsyncStorage persistence!

**File: `src/services/firebase.ts`**

Add this at the top:
```typescript
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
```

Replace:
```typescript
export const auth = getAuth(app);
```

With:
```typescript
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
```

This ensures tokens are persisted across app restarts and automatically refreshed!

### 2. Add Automatic Token Refresh

**File: `src/contexts/AuthContext.tsx`**

Add this effect after `onAuthStateChanged`:

```typescript
// Automatic token refresh every 50 minutes (before 1-hour expiry)
useEffect(() => {
  if (!user || !auth.currentUser) return;

  const refreshInterval = setInterval(async () => {
    try {
      console.log('🔄 Auto-refreshing auth token...');
      await auth.currentUser?.getIdToken(true);
      console.log('✅ Token refreshed successfully');
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
    }
  }, 50 * 60 * 1000); // 50 minutes

  return () => clearInterval(refreshInterval);
}, [user]);
```

### 3. Add Token Validation Before Operations

**In `syncNow()` function** (before attempting sync):

```typescript
// Validate and refresh token before sync
try {
  const token = await auth.currentUser?.getIdToken(false); // Get cached token
  if (!token) {
    throw new Error('No auth token available');
  }
  
  // Check if token is about to expire (less than 5 minutes left)
  const tokenResult = await auth.currentUser?.getIdTokenResult();
  const expirationTime = new Date(tokenResult?.expirationTime || 0).getTime();
  const now = Date.now();
  const timeUntilExpiry = expirationTime - now;
  
  if (timeUntilExpiry < 5 * 60 * 1000) {
    console.log('🔄 Token expiring soon, refreshing...');
    await auth.currentUser?.getIdToken(true); // Force refresh
  }
} catch (error) {
  console.error('❌ Token validation failed:', error);
  return {
    success: false,
    message: '🔐 Session expired. Please sign in again.'
  };
}
```

### 4. Add Network Connectivity Check

Before syncing, check if device is online:

```typescript
import NetInfo from '@react-native-community/netinfo';

// Before sync operations
const netInfo = await NetInfo.fetch();
if (!netInfo.isConnected) {
  return {
    success: false,
    message: '📡 No internet connection. Sync will retry when online.'
  };
}
```

### 5. Graceful Token Expiry Handling

Wrap all Firestore operations with token refresh:

```typescript
const withTokenRefresh = async (operation: () => Promise<any>) => {
  try {
    return await operation();
  } catch (error: any) {
    if (error.code === 'permission-denied' || 
        error.code === 'unauthenticated') {
      
      console.log('🔄 Permission denied, refreshing token and retrying...');
      
      try {
        await auth.currentUser?.getIdToken(true); // Force refresh
        return await operation(); // Retry
      } catch (retryError) {
        console.error('❌ Token refresh failed:', retryError);
        throw new Error('Session expired. Please sign in again.');
      }
    }
    throw error;
  }
};

// Usage:
await withTokenRefresh(async () => {
  await setDoc(userDocRef, userData);
});
```

## Implementation Priority

### IMMEDIATE (Do First):
1. **Fix AsyncStorage persistence** in `firebase.ts`
   - This is the #1 issue causing re-login requirements
   
### HIGH (Do Soon):
2. **Add automatic token refresh** in `AuthContext.tsx`
   - Prevents token expiry during active use

### MEDIUM (Nice to Have):
3. **Add token validation** before sync operations
   - Proactive refresh before expiry
   
4. **Add graceful retry** on permission errors
   - Automatic recovery from token expiry

### LOW (Optional):
5. **Network connectivity check**
   - Better UX for offline scenarios

## Testing

After implementing fixes:

1. **Test token persistence:**
   - Sign in
   - Close app
   - Reopen app → Should still be signed in ✅

2. **Test automatic refresh:**
   - Sign in
   - Wait 55 minutes
   - Try syncing → Should work without re-login ✅

3. **Test recovery:**
   - Sign in
   - Manually expire token (wait 65+ minutes or clear Firebase cache)
   - Try syncing → Should auto-refresh and work ✅

## Why You Need to Re-Login Currently

**Current Flow (Broken):**
```
1. User signs in → Token valid for 1 hour
2. After 1 hour → Token expires
3. Sync operation → Firestore rejects (permission denied)
4. User forced to manually sign out + sign in → New token
```

**Fixed Flow (With Persistence + Auto-Refresh):**
```
1. User signs in → Token valid for 1 hour, saved to AsyncStorage
2. After 50 minutes → Auto-refresh token (background)
3. Token always valid → Sync always works ✅
4. App restart → Token loaded from AsyncStorage ✅
```

## Summary

Your issue is caused by:
- ✅ Missing AsyncStorage persistence (tokens not saved)
- ✅ No automatic token refresh (expires after 1 hour)
- ✅ No retry logic on permission errors

**Quick Fix:**
Just adding AsyncStorage persistence will solve 80% of the problem!

**Complete Fix:**
AsyncStorage persistence + automatic refresh = Never need to re-login ✅
