# Firebase Preferences Sync Implementation

## Overview
User preferences now sync with Firebase Firestore, allowing settings to persist across devices and sign-ins.

## Implementation Details

### 1. **Firestore Structure**
Preferences are stored at:
```
users/{userId}/preferences/settings
```

Each user has a single document containing all their preferences (currency, date format, payment mode, etc.).

### 2. **Sync Strategy**
- **On Sign-In**: Load preferences from Firebase and merge with local preferences (Firebase takes priority)
- **On Update**: Automatically save preferences to Firebase if user is signed in
- **On Sign-Out**: Disable Firebase sync (keep local preferences)

### 3. **Merge Behavior**
When syncing from Firebase on sign-in:
1. If Firebase preferences exist → Use Firebase preferences (merge with local defaults for any missing fields)
2. If no Firebase preferences exist → Push current local preferences to Firebase

### 4. **Files Modified**

#### `src/services/preferences.ts`
**Added:**
- Firebase imports: `firestore`, `doc`, `getDoc`, `setDoc`, `auth`
- `firebaseSyncEnabled` flag to track sync state
- `getCurrentUserId()` - Get current Firebase auth user ID
- `syncWithFirebase(userId)` - Load and merge preferences from Firebase on sign-in
- `saveToFirebase(userId, preferences)` - Save preferences to Firebase
- `enableFirebaseSync()` - Enable automatic sync
- `disableFirebaseSync()` - Disable automatic sync

**Modified:**
- `updatePreferences()` - Now automatically calls `saveToFirebase()` if sync is enabled

#### `src/contexts/AuthContext.tsx`
**Added:**
- Import: `preferencesService`
- Preferences sync calls in sign-in flows

**Modified:**
- `signInWithEmail()` - Added preferences sync after successful sign-in
- Google sign-in useEffect - Added preferences sync after Firebase credential sign-in
- `signOut()` - Added `disableFirebaseSync()` call at the start

## Usage

### For Developers
The sync happens automatically! No additional code needed in screens.

```typescript
// Just update preferences as normal
await preferencesService.updatePreferences({
  currency: 'EUR',
  dateFormat: 'DD/MM/YYYY'
});
// ✅ Automatically saved to Firebase if user is signed in
```

### For Users
1. **Sign In** → Preferences load from cloud
2. **Change Settings** → Automatically sync to cloud
3. **Switch Devices** → Same preferences available
4. **Sign Out** → Local preferences remain (no cloud sync)

## Error Handling
- If Firebase sync fails, preferences still save locally
- Users can continue using the app with local preferences
- Errors are logged to console but don't block the app

## Benefits
✅ Settings persist across devices
✅ No data loss on app reinstall
✅ Seamless experience across sign-ins
✅ Graceful fallback to local storage
✅ No breaking changes to existing code

## Testing Checklist
- [ ] Sign in → Verify preferences load from Firebase
- [ ] Update preference → Verify saves to Firebase (check Firestore)
- [ ] Sign out and sign in again → Verify preferences persist
- [ ] Install app on second device → Verify same preferences
- [ ] Change preference on device A → Verify appears on device B after sign-in
- [ ] Network offline → Verify preferences still save locally

## Firebase Security Rules
Ensure Firestore rules allow users to read/write their own preferences:

```javascript
match /users/{userId}/preferences/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

## Firestore Document Example
```json
{
  "currency": "USD",
  "currencySymbol": "$",
  "dateFormat": "MM/DD/YYYY",
  "showDecimalPlaces": true,
  "defaultPaymentMode": "upi",
  "defaultEntryType": "expense",
  "autoSync": true
}
```

## Future Enhancements
- Real-time sync across devices (using Firestore listeners)
- Conflict resolution for simultaneous updates
- Preference history/versioning
- Export/import preferences
