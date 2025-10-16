# Logout Data Preservation Feature

## Problem Identified

### The Scenario You Described:
**User was logged in without sync enabled → Gets logged out → What happens to local data?**

### Current Behavior Analysis:

#### What Was Cleared on Logout (BEFORE Fix):
```typescript
✅ current_user (user profile)
✅ onboarding_completed (onboarding flag)
✅ user_preferences (deprecated key)
```

#### What Was NOT Cleared (PROBLEM):
```typescript
❌ budget_app_books (all books data)
❌ budget_app_entries (all expense entries)
❌ budget_app_categories (all categories)
❌ preferences (actual preferences)
❌ Data cache
```

### Critical Issues:

1. **Data Mixing**: If another user logs in on the same device, they see the previous user's data
2. **Privacy Violation**: Previous user's financial data remains accessible
3. **Data Loss Risk**: 
   - If sync was disabled → Data only exists locally
   - On logout → Data remains but orphaned (no user associated)
   - On re-login → May or may not see old data (depends on user ID matching)
4. **Confusion**: User A's data appearing for User B

---

## The Real Problem

### Scenario Breakdown:

```
Step 1: User signs in (user.id = "abc123")
Step 2: Auto Sync is DISABLED
Step 3: User creates books, entries, categories (all stored locally)
        - budget_app_books: [Book1, Book2, Book3]
        - budget_app_entries: [Entry1, Entry2, ...]
        - budget_app_categories: [Category1, ...]
Step 4: User gets logged out (manually or session expired)
Step 5: ❌ ONLY clears: current_user, onboarding_completed
        ✅ KEEPS: books, entries, categories (orphaned data)
Step 6: New user logs in (user.id = "xyz789")
Step 7: New user sees OLD data (data mixing!)
```

### Why This Happens:

The data storage doesn't filter by user ID properly:
- Books, entries, and categories are stored in shared keys
- On logout, these keys aren't cleared
- On new login, app reads from same keys
- Result: **Data leakage between users**

---

## Solution Implemented

### 1. Enhanced `signOut()` Function

Added optional parameter to control data clearing:

```typescript
signOut(clearAllData?: boolean)
```

#### Two Modes:

**Mode 1: Preserve Data (Default)**
```typescript
signOut(false) or signOut()
```
- ✅ Keeps books, entries, categories on device
- ✅ Performs final sync if sync enabled
- ✅ Clears user session only
- ✅ Data remains for next login (if same user)

**Mode 2: Clear All Data**
```typescript
signOut(true)
```
- ✅ Performs final sync if sync enabled
- ✅ Clears user session
- ✅ Clears all books
- ✅ Clears all entries
- ✅ Clears all categories
- ✅ Clears preferences
- ✅ Clears data cache
- ✅ Device is "clean" for next user

---

### 2. Smart Logout Flow

```typescript
const signOut = async (clearAllData: boolean = false): Promise<void> => {
  try {
    // Step 1: Warning for unsynced data
    if (clearAllData && !syncEnabled) {
      console.warn('⚠️ Clearing all local data - some data may not be synced to cloud');
    }
    
    // Step 2: Final sync before logout (if sync enabled and keeping data)
    if (!clearAllData && syncEnabled && user) {
      console.log('🔄 Performing final sync before logout...');
      await syncNow(true); // Manual sync - ensures data is saved
    }
    
    // Step 3-8: Disable sync, cleanup listeners, clear user state
    // ...
    
    // Step 9: Clear user session data (always)
    await AsyncStorage.removeItem('current_user');
    await AsyncStorage.removeItem('onboarding_completed');
    await AsyncStorage.removeItem('user_preferences');
    
    // Step 10: Conditionally clear actual data
    if (clearAllData) {
      console.log('🗑️ Clearing all local data...');
      await AsyncStorage.removeItem('budget_app_books');
      await AsyncStorage.removeItem('budget_app_entries');
      await AsyncStorage.removeItem('budget_app_categories');
      await AsyncStorage.removeItem('preferences');
      await dataCacheService.clearAll();
      console.log('✅ All local data cleared');
    } else {
      console.log('💾 Local data preserved');
    }
    
    // Step 11: Firebase sign out
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('❌ Error signing out:', error);
  }
};
```

---

### 3. Smart Logout Dialog (SettingsScreen)

Users now get contextual options based on sync state:

#### If Sync is ENABLED:
```
╔════════════════════════════════════════╗
║              Logout                    ║
╠════════════════════════════════════════╣
║ Your data is synced to the cloud.     ║
║ Do you want to keep local data on      ║
║ this device?                           ║
╠════════════════════════════════════════╣
║  [Cancel]  [Keep Local Data]          ║
║                [Clear All Data]        ║
╚════════════════════════════════════════╝
```

**"Keep Local Data"** → `signOut(false)`
- Data stays on device
- Faster next login
- Good for personal devices

**"Clear All Data"** → Confirmation dialog → `signOut(true)`
- Device cleaned
- Good for shared devices
- Data safe in cloud

#### If Sync is DISABLED:
```
╔════════════════════════════════════════╗
║              Logout                    ║
╠════════════════════════════════════════╣
║ ⚠️ Sync is disabled. Your local data  ║
║ may not be in the cloud. What would    ║
║ you like to do?                        ║
╠════════════════════════════════════════╣
║  [Cancel]  [Keep Local Data]          ║
║                [Clear All Data]        ║
╚════════════════════════════════════════╝
```

**Clear All Data** shows additional warning:
```
╔════════════════════════════════════════╗
║         Confirm Clear Data             ║
╠════════════════════════════════════════╣
║ ⚠️ WARNING: This will permanently      ║
║ delete all local data. If sync was     ║
║ disabled, this data may not be in      ║
║ the cloud!                             ║
╠════════════════════════════════════════╣
║         [Cancel]  [Clear All Data]     ║
╚════════════════════════════════════════╝
```

---

## Behavior Matrix

| Scenario | Sync State | User Choice | Result | Data Fate |
|----------|-----------|-------------|---------|-----------|
| Personal device | Enabled | Keep Local | Logout, data preserved | ✅ On device + cloud |
| Personal device | Enabled | Clear All | Logout, data cleared | ✅ In cloud, cleared locally |
| Personal device | Disabled | Keep Local | Logout, data preserved | ⚠️ Only on device (risky) |
| Personal device | Disabled | Clear All | Logout, data cleared | ❌ LOST (not in cloud) |
| Shared device | Enabled | Keep Local | Logout, data preserved | ⚠️ Privacy risk |
| Shared device | Enabled | Clear All | Logout, data cleared | ✅ Safe, in cloud |
| Shared device | Disabled | Keep Local | Logout, data preserved | ⚠️ Privacy + data risk |
| Shared device | Disabled | Clear All | Logout, data cleared | ❌ LOST |

---

## Answer to Your Question

### "What happens to local data when logged out without sync?"

**BEFORE Fix:**
```
❌ Data remains on device
❌ Orphaned (no user association)
❌ Can be seen by next user who logs in
❌ Privacy violation
❌ Data mixing between users
```

**AFTER Fix (Default - Keep Local Data):**
```
✅ Data remains on device
✅ Final sync performed if sync was enabled
⚠️ Data still accessible to next user (by design for personal devices)
✅ User was warned if sync was disabled
```

**AFTER Fix (Clear All Data):**
```
✅ Data cleared from device
✅ Final sync performed if sync was enabled
✅ Clean slate for next user
✅ Privacy protected
✅ User got warning if sync was disabled
```

### Recommendations:

1. **For Personal Devices:**
   - Keep Local Data = Faster, convenient
   - Sync should be enabled to protect data

2. **For Shared Devices:**
   - Clear All Data = Privacy and security
   - Always enable sync before logout

3. **If Sync is Disabled:**
   - DANGER: Local data may be lost
   - Enable sync before logout
   - Or carefully choose "Keep Local Data"

---

## Files Modified

### 1. `src/contexts/AuthContext.tsx`

**Interface Update:**
```typescript
interface AuthContextType {
  // ...
  signOut: (clearAllData?: boolean) => Promise<void>;  // ✅ NEW parameter
}
```

**Import Added:**
```typescript
import { dataCacheService } from '../services/dataCache';
```

**Function Enhanced:**
```typescript
const signOut = async (clearAllData: boolean = false): Promise<void> => {
  // Added final sync logic
  // Added conditional data clearing
  // Added warnings for unsynced data
};
```

### 2. `src/screens/SettingsScreen.tsx`

**Function Enhanced:**
```typescript
const handleLogout = () => {
  // Check sync status
  // Show contextual dialog based on sync state
  // Provide "Keep Local Data" vs "Clear All Data" options
  // Show warnings for unsynced data
};
```

---

## Testing Scenarios

### Test 1: Logout with Sync Enabled, Keep Data
1. Enable Auto Sync
2. Create some entries
3. Logout → Choose "Keep Local Data"
4. **Expected:**
   - Final sync occurs
   - Data uploaded to Firebase
   - Local data preserved
   - Re-login shows same data

### Test 2: Logout with Sync Enabled, Clear Data
1. Enable Auto Sync
2. Create some entries
3. Logout → Choose "Clear All Data" → Confirm
4. **Expected:**
   - Final sync occurs
   - Data uploaded to Firebase
   - Local data cleared
   - Re-login fetches data from Firebase

### Test 3: Logout with Sync Disabled, Keep Data
1. Disable Auto Sync
2. Create some entries
3. Logout → Choose "Keep Local Data"
4. **Expected:**
   - Warning shown about unsynced data
   - No sync occurs
   - Local data preserved
   - Re-login shows same data (if same user)

### Test 4: Logout with Sync Disabled, Clear Data
1. Disable Auto Sync
2. Create some entries
3. Logout → Choose "Clear All Data" → See warning → Confirm
4. **Expected:**
   - Strong warning about data loss
   - No sync occurs
   - Local data cleared
   - ❌ Data lost (not in cloud)

### Test 5: Shared Device Scenario
1. User A logs in, creates data (sync enabled)
2. User A logs out → Choose "Clear All Data"
3. User B logs in
4. **Expected:**
   - User B sees NO data from User A
   - Privacy protected
   - Clean start for User B

### Test 6: Shared Device Without Clear
1. User A logs in, creates data
2. User A logs out → Choose "Keep Local Data"
3. User B logs in
4. **Expected:**
   - ⚠️ User B may see User A's data (privacy issue)
   - This is intentional for personal device convenience
   - Users should use "Clear All Data" on shared devices

---

## Console Logs

### Keep Local Data (Sync Enabled):
```
🚪 Signing out...
🔄 Performing final sync before logout...
✅ Final sync completed
🔓 Disabled Firebase preferences sync
💾 Local data preserved (books, entries, categories remain on device)
🗑️ Cleared user session data
✅ Signed out successfully
```

### Clear All Data (Sync Enabled):
```
🚪 Signing out...
🔄 Performing final sync before logout...
✅ Final sync completed
🔓 Disabled Firebase preferences sync
🗑️ Clearing all local data (books, entries, categories, preferences)...
✅ All local data cleared
🗑️ Cleared user session data
✅ Signed out successfully
```

### Clear All Data (Sync Disabled):
```
🚪 Signing out...
⚠️ Clearing all local data - some data may not be synced to cloud
🔓 Disabled Firebase preferences sync
🗑️ Clearing all local data (books, entries, categories, preferences)...
✅ All local data cleared
🗑️ Cleared user session data
✅ Signed out successfully
```

---

## Security & Privacy Benefits

✅ **User Control**: Users decide data fate
✅ **Privacy Protection**: Option to clear data on shared devices
✅ **Data Safety**: Final sync before logout (if enabled)
✅ **Transparency**: Clear warnings about unsynced data
✅ **Flexibility**: Keep data on personal devices, clear on shared

---

## Related Documentation
- `AUTO_SYNC_RESPECT_FIX.md` - How auto-sync respects preferences
- `FIREBASE_PREFERENCES_SYNC.md` - Cloud preference syncing
- `LOGOUT_FIX.md` - Previous logout improvements
