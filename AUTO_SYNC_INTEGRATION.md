# Auto Sync Preference Integration

## Overview
The **Auto Sync** toggle is now fully integrated across the app. The preference setting and the actual cloud sync functionality are tied together and stay synchronized.

## Problem Solved
Previously there were **two separate** sync controls:
1. **PreferencesScreen**: `autoSync` preference (just a boolean)
2. **SettingsScreen**: Actual cloud sync toggle (via `enableSync()`/`disableSync()`)

These were **not connected**, leading to confusion and inconsistent behavior.

## Solution
Both toggles now control the same underlying sync state:
- Toggle in PreferencesScreen → Updates preference AND enables/disables cloud sync
- Toggle in SettingsScreen → Updates preference AND enables/disables cloud sync
- Both stay synchronized automatically

---

## Implementation Details

### 1. **PreferencesScreen Integration**

#### Added Import
```typescript
import { useAuth } from '../contexts/AuthContext';
```

#### Added Auth Hook
```typescript
const { enableSync, disableSync, getSyncStatus } = useAuth();
```

#### Created Special Handler
```typescript
const handleAutoSyncToggle = async (value: boolean) => {
  try {
    // Update the preference first
    await updatePreference('autoSync', value);
    
    // Then enable/disable actual cloud sync
    if (value) {
      await enableSync();
      console.log('✅ Cloud sync enabled via preferences');
    } else {
      disableSync();
      console.log('🛑 Cloud sync disabled via preferences');
    }
  } catch (error) {
    console.error('Error toggling auto sync:', error);
    Alert.alert('Error', 'Failed to toggle auto sync');
  }
};
```

#### Updated Switch Component
```typescript
<Switch
  value={preferences.autoSync}
  onValueChange={handleAutoSyncToggle}  // Now calls the special handler
/>
```

---

### 2. **AuthContext Integration**

#### Updated `enableSync()`
Added preference update at the beginning:
```typescript
const enableSync = async (): Promise<void> => {
  console.log('✅ Auto-sync enabled');
  
  if (!user) {
    console.error('❌ Cannot enable sync - no user');
    return;
  }
  
  // Update the autoSync preference
  await preferencesService.updatePreferences({ autoSync: true });
  console.log('✅ Updated autoSync preference to true');
  
  // ... rest of the enable sync logic
};
```

#### Updated `disableSync()`
Added preference update:
```typescript
const disableSync = (): void => {
  console.log('🛑 Auto-sync disabled');
  
  // Update the autoSync preference (async but we don't await to keep function sync)
  preferencesService.updatePreferences({ autoSync: false })
    .then(() => console.log('✅ Updated autoSync preference to false'))
    .catch((error) => console.error('❌ Error updating autoSync preference:', error));
  
  // ... rest of the disable sync logic
};
```

---

### 3. **Sign-In Flow Integration**

#### Email Sign-In (`signInWithEmail`)
After syncing preferences from Firebase:
```typescript
// Sync preferences from Firebase
await preferencesService.syncWithFirebase(userCredential.user.uid);
console.log('✅ Preferences synced from Firebase');

// Enable/disable sync based on the autoSync preference
const prefs = await preferencesService.getPreferences();
if (prefs.autoSync) {
  console.log('✅ AutoSync enabled in preferences - enabling cloud sync');
  await enableSync();
} else {
  console.log('⏭️ AutoSync disabled in preferences - keeping sync disabled');
}
```

#### Google Sign-In (useEffect handler)
Same logic applied after Firebase credential sign-in:
```typescript
// Sync preferences from Firebase
await preferencesService.syncWithFirebase(userCredential.user.uid);
console.log('✅ Preferences synced from Firebase');

// Enable/disable sync based on the autoSync preference
const prefs = await preferencesService.getPreferences();
if (prefs.autoSync) {
  console.log('✅ AutoSync enabled in preferences - enabling cloud sync');
  await enableSync();
} else {
  console.log('⏭️ AutoSync disabled in preferences - keeping sync disabled');
}
```

#### Auth State Change Listener
Also respects the preference on subsequent auth changes:
```typescript
if (!isInitialLoad) {
  console.log('🔄 User authenticated - checking autoSync preference...');
  
  // Check if autoSync is enabled in preferences
  const prefs = await preferencesService.getPreferences();
  if (prefs.autoSync) {
    console.log('✅ AutoSync enabled in preferences - triggering sync');
    await syncNow();
  } else {
    console.log('⏭️ AutoSync disabled in preferences - skipping sync');
  }
}
```

---

## Behavior Flow

### Scenario 1: User Enables Sync in PreferencesScreen
1. User toggles "Auto Sync" ON in PreferencesScreen
2. `handleAutoSyncToggle(true)` is called
3. Preference `autoSync` is set to `true` in Firebase
4. `enableSync()` is called
5. Cloud sync is activated
6. Real-time listeners are set up
7. Git-style sync is performed to preserve local changes

### Scenario 2: User Disables Sync in SettingsScreen
1. User toggles sync OFF in SettingsScreen
2. `disableSync()` is called
3. Preference `autoSync` is set to `false` in Firebase
4. Real-time listeners are cleaned up
5. Sync callbacks are removed
6. PreferencesScreen toggle automatically reflects the change

### Scenario 3: User Signs In
1. User signs in with email or Google
2. Preferences are synced from Firebase
3. `autoSync` preference is checked
4. If `autoSync = true` → `enableSync()` is called automatically
5. If `autoSync = false` → Sync remains disabled
6. User's preference is respected across devices

### Scenario 4: Cross-Device Sync
1. User enables sync on Device A
2. Preference `autoSync = true` is saved to Firebase
3. User signs in on Device B
4. Preferences load from Firebase (including `autoSync = true`)
5. Sync is automatically enabled on Device B
6. Both devices stay in sync

---

## Benefits

✅ **Single Source of Truth**: The `autoSync` preference controls everything
✅ **Synchronized UI**: Both toggle switches stay in sync automatically
✅ **Persists Across Devices**: Preference syncs via Firebase
✅ **Respects User Choice**: Sign-in automatically applies saved preference
✅ **No Confusion**: One setting, consistent behavior everywhere
✅ **Clean Architecture**: Preference layer abstracts sync control

---

## Testing Checklist

### Basic Functionality
- [ ] Toggle Auto Sync ON in PreferencesScreen → SettingsScreen shows sync enabled
- [ ] Toggle sync OFF in SettingsScreen → PreferencesScreen shows Auto Sync disabled
- [ ] Both toggles stay synchronized when changed

### Persistence
- [ ] Enable Auto Sync → Sign out → Sign in → Auto Sync still enabled
- [ ] Disable Auto Sync → Sign out → Sign in → Auto Sync still disabled

### Cross-Device Sync
- [ ] Enable Auto Sync on Device A
- [ ] Sign in on Device B → Auto Sync automatically enabled
- [ ] Disable Auto Sync on Device B
- [ ] Sign in on Device A → Auto Sync automatically disabled

### Edge Cases
- [ ] Sign in with sync disabled → No automatic sync occurs
- [ ] Sign in with sync enabled → Automatic sync occurs
- [ ] Toggle sync while offline → Preference saves locally
- [ ] Come back online → Preference syncs to Firebase

---

## Files Modified

1. **src/screens/PreferencesScreen.tsx**
   - Added `useAuth` import
   - Created `handleAutoSyncToggle()` function
   - Updated Switch to use the new handler

2. **src/contexts/AuthContext.tsx**
   - Updated `enableSync()` to set `autoSync = true`
   - Updated `disableSync()` to set `autoSync = false`
   - Updated `signInWithEmail()` to respect `autoSync` preference
   - Updated Google sign-in handler to respect `autoSync` preference
   - Updated auth state listener to check `autoSync` preference

3. **src/services/preferences.ts**
   - (No changes needed - already has `autoSync` field and Firebase sync)

---

## Technical Notes

### Why `disableSync()` is Synchronous
The `disableSync()` function needs to remain synchronous for immediate UI responsiveness. We update the preference asynchronously in the background:

```typescript
preferencesService.updatePreferences({ autoSync: false })
  .then(() => console.log('✅ Updated autoSync preference to false'))
  .catch((error) => console.error('❌ Error updating autoSync preference:', error));
```

This ensures:
- Instant UI feedback
- No blocking operations
- Graceful error handling
- Background preference sync

### Preference Priority
When conflicts occur (rare), the preference order is:
1. **User's explicit action** (toggle switch)
2. **Firebase synced preference** (on sign-in)
3. **Local cached preference** (fallback)
4. **Default value** (`true` by default)

---

## Future Enhancements

- [ ] Add sync status indicator in PreferencesScreen
- [ ] Show last sync time in both screens
- [ ] Add "Sync Now" button in PreferencesScreen
- [ ] Visual feedback when syncing occurs
- [ ] Toast notification when sync preference changes
