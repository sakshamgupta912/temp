# Sync Issues - Debugging & Troubleshooting Guide

## Common Sync Problems & Solutions

### Problem 1: "Sync Not Working" - No Data Appearing on Other Device

**Symptoms:**
- Create data on Phone 1 → Doesn't appear on Phone 2
- Changes made on one device don't sync to another
- Manual sync button does nothing

**Root Causes & Solutions:**

#### Cause A: Cloud Sync Not Enabled
**Check:**
1. Go to Settings → Preferences
2. Check if "Enable Cloud Backup & Sync" is ON

**Solution:**
```
Phone 1: Settings → Preferences → Enable Cloud Backup & Sync
Phone 2: Settings → Preferences → Enable Cloud Backup & Sync
```

#### Cause B: Not Signed In or Different Accounts
**Check:**
1. Settings → Check email displayed at top
2. Verify both devices show SAME email

**Solution:**
```
If different accounts:
1. Sign out from both devices
2. Sign in with SAME email on both
3. Enable sync on both
```

#### Cause C: Firebase Authentication Expired
**Check Console Logs:**
```
Look for: ❌ Auth not ready after 3 seconds
OR: ⚠️ Firebase auth not ready
```

**Solution:**
```
1. Sign out completely
2. Close app
3. Reopen app
4. Sign in again
5. Enable sync
```

#### Cause D: Network Issues
**Check:**
- Is device connected to internet?
- Is WiFi/Mobile data working?

**Solution:**
```
1. Check internet connection
2. Try opening browser/other apps
3. Toggle airplane mode OFF
4. Retry sync
```

---

### Problem 2: Data Syncs But Then Disappears

**Symptoms:**
- Data appears briefly then vanishes
- Changes get overwritten by old data
- Same entry appears multiple times

**Root Cause:** Conflict resolution choosing wrong version

**Check Console:**
```
Look for:
🔄 Conflict: Local version newer for [id], keeping local
☁️ Conflict: Cloud version newer for [id], keeping cloud
```

**Solution:**
1. Ensure devices have correct system time
2. Check timestamps: Settings → Date & Time → Set automatically
3. If time is wrong, conflicts will be resolved incorrectly

---

### Problem 3: "Sync Already in Progress" Message

**Symptoms:**
- Tap sync button → Nothing happens
- Console shows: ⏭️ Sync already in progress, skipping...
- Sync seems stuck

**Root Cause:** Previous sync didn't complete or crashed

**Solution A - Wait:**
```
Wait 30 seconds, previous sync may still be finishing
```

**Solution B - Force Reset:**
```
1. Disable sync: Settings → Preferences → Toggle OFF
2. Wait 5 seconds
3. Enable sync again
4. Try manual sync
```

**Solution C - Restart App:**
```
1. Close app completely (swipe from recents)
2. Reopen
3. Sign in
4. Enable sync
```

---

### Problem 4: Permission Denied Errors

**Symptoms:**
- Console: ❌ Firestore listener error: [FirebaseError: Missing or insufficient permissions]
- Sync fails immediately
- Real-time updates don't work

**Root Cause:** Firebase Firestore rules not configured correctly

**Check Firestore Rules:**
Go to Firebase Console → Firestore Database → Rules

**Required Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**Solution:**
1. Copy the rules above
2. Paste into Firebase Console → Firestore → Rules
3. Click "Publish"
4. Wait 1 minute for rules to propagate
5. Restart app and try sync

---

### Problem 5: Sync is Slow

**Symptoms:**
- Takes 10+ seconds to sync
- App feels laggy during sync
- "Syncing..." shows for long time

**Causes & Solutions:**

#### Cause A: Large Amount of Data
**Check Console:**
```
📊 Cloud data: {"books": 100, "entries": 5000, "categories": 20}
```

**Solution:**
- This is expected with lots of data
- Sync time increases with data size
- Consider archiving old books

#### Cause B: Slow Network
**Test:**
```
Run speed test on phone
If < 1 Mbps download → Network too slow
```

**Solution:**
- Switch to faster WiFi
- Use mobile data if WiFi slow
- Wait for better connection

#### Cause C: Firebase Server Issues
**Check:**
```
Console shows: ⏳ Retrying in 500ms...
Multiple retry attempts
```

**Solution:**
- Wait a few minutes
- Firebase may be experiencing high load
- Try again later

---

### Problem 6: Duplicate Entries After Sync

**Symptoms:**
- Same entry shows up 2-3 times
- Books duplicated
- Data looks corrupted

**Root Cause:** ID generation conflict or merge logic issue

**Check:**
```
Look for entries with same name but different IDs:
"Coffee - $5" with ID: entry_123
"Coffee - $5" with ID: entry_456
```

**Solution:**
```
1. This shouldn't happen (IDs are unique)
2. If it does, manually delete duplicates
3. Sign out and sign in again
4. Sync should fix itself
```

**Prevention:**
- Don't create entries offline on multiple devices simultaneously
- Let one device sync before using another

---

## Debugging Steps

### Step 1: Check Sync Status

**In App:**
1. Go to Settings
2. Look at "Cloud Sync Status" section
3. Check "Last Sync Time"

**Expected:**
- Status: "Synced" or "Syncing..."
- Last Sync: Recent timestamp (within last few minutes)

**Problem Indicators:**
- Status: "Error" or "Failed"
- Last Sync: Old timestamp or "Never"

### Step 2: Enable Console Logs

**How to View:**
1. Connect phone to computer via USB
2. Open Chrome → `chrome://inspect`
3. Find your device → Click "Inspect"
4. Go to Console tab
5. Trigger sync
6. Watch logs in real-time

**Good Logs (Working):**
```
🔄 Starting cloud-first sync...
🔑 Refreshing auth token...
📡 Sync attempt 1/3...
📥 Step 1: Downloading master data from Firebase...
📱 Step 2: Getting local data...
📊 Cloud data: {"books": 2, "entries": 5, "categories": 1}
📊 Local data: {"books": 2, "entries": 5, "categories": 1}
🔀 Step 3: Merging...
📊 Merged data: {"books": 2, "entries": 5, "categories": 1}
💾 Step 4: Saving merged data locally...
📤 Step 5: Uploading merged data to master...
✅ Cloud-first sync complete
```

**Bad Logs (Error):**
```
🔄 Starting cloud-first sync...
❌ Auth not ready after 3 seconds
```
OR
```
❌ Firestore listener error: [FirebaseError: ...]
```
OR
```
❌ Sync attempt 1 failed: [error message]
❌ Sync attempt 2 failed: [error message]
❌ Sync attempt 3 failed: [error message]
❌ All sync attempts failed
```

### Step 3: Manual Sync Test

**Test Procedure:**
1. **Phone 1**: Create a book called "TEST SYNC 123"
2. Wait 2 seconds
3. **Phone 1**: Go to Settings → Tap "Sync Now"
4. Watch console for: ✅ Cloud-first sync complete
5. **Phone 2**: Pull down to refresh on Books screen
6. **Expected**: See "TEST SYNC 123" appear

**If it doesn't appear:**
1. Check Phone 2 console logs
2. Look for real-time listener messages:
   ```
   👤 User document changed, syncing...
   ✅ Real-time sync complete
   ```
3. If no messages → Listener not working
4. Try: Settings → Toggle sync OFF then ON

### Step 4: Network Test

**Test Upload:**
```
Phone 1: Create entry → Check if it uploads to Firebase
Go to Firebase Console → Firestore → users collection
Find your userId document
Check if 'books', 'entries' arrays updated
```

**Test Download:**
```
Phone 2: Manually edit data in Firebase Console
Add a book directly in Firestore
Wait 5 seconds
Phone 2 should show new book (real-time listener)
```

### Step 5: Clean Slate Test

**Complete Reset:**
```
1. Phone 1 & Phone 2: Sign out
2. Firebase Console: Delete your user document
3. Phone 1: Sign in
4. Phone 1: Create test book "FRESH START"
5. Phone 1: Enable sync
6. Wait for sync complete
7. Phone 2: Sign in (same account)
8. Phone 2: Enable sync
9. Phone 2: Should see "FRESH START" book
```

---

## Common Error Messages & Fixes

### Error: "Authentication required"
**Message:** `❌ Auth not ready after 3 seconds`

**Fix:**
1. Sign out completely
2. Clear app cache (Android: Settings → Apps → Your App → Clear Cache)
3. Reopen app
4. Sign in again

### Error: "Missing or insufficient permissions"
**Message:** `❌ Firestore listener error: [FirebaseError: Missing or insufficient permissions]`

**Fix:**
1. Check Firestore rules (see Problem 4 above)
2. Verify you're signed in with correct account
3. Try signing out and in again

### Error: "Sync already in progress"
**Message:** `⏭️ Sync already in progress, skipping...`

**Fix:**
1. Wait 30 seconds
2. If still stuck, restart app
3. Re-enable sync

### Error: "All sync attempts failed"
**Message:** `❌ All sync attempts failed`

**Fix:**
1. Check internet connection
2. Check Firebase status: https://status.firebase.google.com/
3. Try again in a few minutes
4. If persists, check Firestore rules

---

## Performance Optimization

### Reduce Sync Frequency
Current: Every time data changes (can be frequent)

**Adjust:**
Look for `triggerAutoSync` in code - increase debounce delay from 5s to 10s or 15s

### Disable Real-Time Sync
If real-time not needed, use manual sync only:
```
Settings → Disable "Enable Cloud Backup & Sync"
Manually tap "Sync Now" when needed
```

### Archive Old Data
Too much data slows sync:
```
1. Export old books to CSV (Settings → Data Export)
2. Delete old books from app
3. Sync will be faster
```

---

## Advanced Debugging

### Check Firestore Directly
```
1. Firebase Console → Firestore Database
2. Find your user document: users/{yourUserId}
3. Check fields:
   - books: [] (array of books)
   - entries: [] (array of entries)
   - categories: [] (array of categories)
   - lastUpdated: (timestamp)
4. Verify data looks correct
```

### Force Download from Cloud
```
1. Backup: Export data first (Settings → Data Export)
2. Clear app data: Android → Settings → Apps → Your App → Clear Data
3. Reopen app
4. Sign in
5. Enable sync
6. Should download everything from Firebase
```

### Force Upload to Cloud
```
1. Firebase Console → Delete your user document
2. App: Disable sync
3. App: Enable sync (triggers first-time sync)
4. Uploads all local data to Firebase
```

---

## Contact Information for Issues

If none of these solutions work:

1. **Collect Logs:**
   - Full console output from phone
   - Screenshots of error messages
   - Steps to reproduce

2. **Check:**
   - App version
   - Phone model & Android version
   - Firebase project ID
   - Account email (for verification)

3. **Provide Details:**
   - What were you doing when it broke?
   - Does it happen on both devices or just one?
   - Can you reproduce it consistently?

---

## Quick Reference

**Most Common Fixes (Try These First):**
1. ✅ Sign out → Sign in again
2. ✅ Toggle sync OFF → ON
3. ✅ Check internet connection
4. ✅ Restart app
5. ✅ Check Firestore rules
6. ✅ Verify same account on both devices
7. ✅ Enable sync on BOTH devices
8. ✅ Wait 30 seconds after changes

**Last Resort:**
- Clear app data
- Reinstall app
- Sign in fresh
- Enable sync
- Should work like new
