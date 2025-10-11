# 🔄 Cloud Sync - Complete Test Checklist

## 📋 Pre-Flight Checks

Before testing sync, verify these prerequisites:

### ✅ Firebase Setup
- [ ] Firestore Database is enabled in Firebase Console
- [ ] Security rules are published (see [`FIREBASE_RULES_SETUP.md`](FIREBASE_RULES_SETUP.md))
- [ ] Rules timestamp is recent (within last hour)
- [ ] Project ID matches: `cocona-472b7`

### ✅ Authentication
- [ ] You can sign in with email/password
- [ ] Console shows: `✅ Email sign-in successful: [your email]`
- [ ] Settings screen shows your email address
- [ ] Logout works and returns you to login screen

### ✅ Internet Connection
- [ ] Device/emulator has internet access
- [ ] Can open websites in device browser
- [ ] No airplane mode or data saver enabled

---

## 🧪 Test Suite

### Test 1: Manual Sync (First Time)
**Purpose:** Verify basic sync functionality

#### Steps:
1. Sign in to the app
2. Go to **Settings** screen
3. Scroll to "Cloud Sync" section
4. Tap **"Sync Now"** button

#### Expected Results:
```
Console logs:
🔄 Starting manual sync...
👤 User ID: [your user ID]
🔐 Auth state: Authenticated
🔑 Auth user ID: [your user ID]
🔑 Auth user email: [your email]
🧪 Testing Firestore connection...
✅ Firestore connection test passed
📄 Checking user document...
📱 Getting local data from AsyncStorage...
📚 Books retrieved: [number]
📂 Categories retrieved: [number]
📝 Entries for book "[book name]": [number]
📊 Local data summary:
  Books: [number] items
  Entries: [number] items
  Categories: [number] items
📤 Uploading to Firestore document: userData/[your-user-id]
✅ Local data synced to Firestore
⏰ Updating last sync time...
✅ Sync completed successfully
```

- [ ] No error messages in console
- [ ] Settings shows "Last synced: Just now"
- [ ] Green success message appears
- [ ] No app crash or freeze

#### Firebase Console Verification:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project `cocona-472b7`
3. Go to **Firestore Database**
4. You should see:
   - Collection: `userData`
   - Document: `[your-user-id]`
   - Fields: `books`, `entries`, `categories`, `lastLocalUpdate`
5. Click on the document
6. Verify your data is there (books array should have your books)

- [ ] `userData` collection exists
- [ ] Document with your user ID exists
- [ ] `books` array contains your books
- [ ] `entries` array contains your entries
- [ ] `categories` array contains your categories
- [ ] `lastLocalUpdate` has a recent timestamp

---

### Test 2: Auto-Sync on Create
**Purpose:** Verify sync triggers automatically when creating data

#### Steps:
1. Stay signed in
2. Make sure sync is enabled (check Settings)
3. Create a new entry:
   - Go to **Dashboard** or **Books**
   - Select a book
   - Tap **"+"** to add entry
   - Fill in amount, category, etc.
   - Tap **"Save"**
4. **Wait 2-3 seconds**
5. Check console logs

#### Expected Results:
```
Console logs (after 2 seconds):
🔄 Auto-sync triggered by data change
🔄 Starting manual sync...
[... rest of sync logs ...]
✅ Sync completed successfully
```

- [ ] Sync triggers automatically within 2-3 seconds
- [ ] No manual "Sync Now" tap needed
- [ ] Entry appears in Firebase Console
- [ ] No errors in console

---

### Test 3: Auto-Sync on Update
**Purpose:** Verify sync triggers when editing data

#### Steps:
1. Edit an existing entry:
   - Go to **Book Detail** screen
   - Tap an entry
   - Change the amount or category
   - Tap **"Save"**
2. **Wait 2-3 seconds**
3. Check console logs

#### Expected Results:
```
Console logs:
AsyncStorage: Entry updated successfully
🔄 Auto-sync triggered by data change
[... sync logs ...]
✅ Sync completed successfully
```

- [ ] Auto-sync triggers after edit
- [ ] Changes appear in Firebase Console
- [ ] No errors

---

### Test 4: Auto-Sync on Delete
**Purpose:** Verify sync triggers when deleting data

#### Steps:
1. Delete an entry:
   - Go to **Book Detail** screen
   - Tap entry's three-dot menu
   - Tap **"Delete"**
   - Confirm deletion
2. **Wait 2-3 seconds**
3. Check console and Firebase Console

#### Expected Results:
- [ ] Auto-sync triggers after deletion
- [ ] Entry is removed from Firebase
- [ ] Entry count in Firebase decreases
- [ ] No errors

---

### Test 5: Rapid Changes (Debounce Test)
**Purpose:** Verify debouncing works (multiple rapid changes = single sync)

#### Steps:
1. Quickly create 3 entries back-to-back:
   - Add entry 1 → Save (don't wait)
   - Add entry 2 → Save (don't wait)
   - Add entry 3 → Save
2. **Wait 3 seconds**
3. Count sync operations in console

#### Expected Results:
- [ ] Only ONE sync operation happens (not 3)
- [ ] Sync happens 2 seconds after last change
- [ ] All 3 entries appear in Firebase
- [ ] Console shows: `🔄 Auto-sync triggered by data change` only once

---

### Test 6: Sync Already In Progress
**Purpose:** Verify concurrent sync prevention

#### Steps:
1. Trigger a manual sync:
   - Go to **Settings**
   - Tap **"Sync Now"**
2. Immediately (before it completes) tap **"Sync Now"** again
3. Check console logs

#### Expected Results:
```
Console logs:
🔄 Starting manual sync...
[... first sync running ...]
⏭️ Sync already in progress, skipping...
[... first sync completes ...]
✅ Sync completed successfully
```

- [ ] Second sync is skipped
- [ ] App doesn't crash
- [ ] Only one sync operation runs
- [ ] Message: "Sync already in progress"

---

### Test 7: Offline → Online Sync
**Purpose:** Verify sync works after regaining connection

#### Steps:
1. Turn on **Airplane Mode** on device
2. Create a new entry
3. Try to sync manually (should fail gracefully)
4. Turn off **Airplane Mode**
5. Wait for connection to restore
6. Tap **"Sync Now"**

#### Expected Results:
- [ ] Offline sync shows appropriate error
- [ ] Entry is saved locally (even offline)
- [ ] After going online, sync succeeds
- [ ] Entry appears in Firebase
- [ ] No data loss

---

### Test 8: Sign Out → Sign In
**Purpose:** Verify data persists across sessions

#### Steps:
1. Note how many books/entries you have
2. Ensure last sync was successful
3. Go to **Settings** → **Sign Out**
4. Sign in again with same account
5. Check if data is still there

#### Expected Results:
- [ ] All books are still visible
- [ ] All entries are still visible
- [ ] Auto-sync re-enables after sign-in
- [ ] Last sync time is preserved

---

### Test 9: Multiple Data Types
**Purpose:** Verify all data types sync correctly

#### Steps:
1. Create a new **book**
2. Wait 2 seconds → Check Firebase (book should appear)
3. Add an **entry** to that book
4. Wait 2 seconds → Check Firebase (entry should appear)
5. Create a new **category** (Settings → Category Management)
6. Wait 2 seconds → Check Firebase (category should appear)

#### Expected Results:
- [ ] Books sync correctly
- [ ] Entries sync correctly
- [ ] Categories sync correctly
- [ ] All have proper timestamps
- [ ] All data structures are valid JSON

---

### Test 10: Sync Toggle
**Purpose:** Verify sync enable/disable works

#### Steps:
1. Go to **Settings**
2. Toggle **"Cloud Sync"** OFF
3. Create a new entry
4. Wait 5 seconds
5. Check console (should see: `⏭️ Auto-sync skipped`)
6. Toggle **"Cloud Sync"** ON
7. Create another entry
8. Wait 2 seconds

#### Expected Results:
- [ ] With sync OFF: No auto-sync happens
- [ ] Entry is saved locally but not synced
- [ ] Console shows: "Auto-sync skipped: sync disabled"
- [ ] With sync ON: Auto-sync works again
- [ ] Toggle state persists after app restart

---

## 🐛 Common Issues & Solutions

### Issue 1: Permission Denied
**Error:** `Missing or insufficient permissions`

**Solution:**
1. Check Firebase Console → Firestore Database → Rules
2. Ensure rules are published
3. Wait 60 seconds
4. Restart app
5. See [`FIREBASE_RULES_SETUP.md`](FIREBASE_RULES_SETUP.md)

### Issue 2: Auto-Sync Not Triggering
**Symptoms:** Manual sync works, but auto-sync doesn't

**Debug Steps:**
1. Check console for: `⏭️ Auto-sync skipped: sync disabled`
2. Verify sync toggle is ON in Settings
3. Check that you're signed in
4. Create entry and wait full 3 seconds
5. Check console for: `🔄 Auto-sync triggered by data change`

### Issue 3: Sync Stuck/Hanging
**Symptoms:** Sync starts but never completes

**Debug Steps:**
1. Check internet connection
2. Force close app
3. Clear app cache
4. Check Firebase Console for service status
5. Try manual sync first

### Issue 4: Data Not Appearing in Firebase
**Symptoms:** Sync succeeds but data not in Firebase Console

**Debug Steps:**
1. Refresh Firebase Console page
2. Check correct project: `cocona-472b7`
3. Look in `userData` collection
4. Check document ID matches your user ID
5. Console logs should show: `📤 Uploading to Firestore document: userData/[ID]`

### Issue 5: Old Data Showing Up
**Symptoms:** Deleted items reappear

**Possible Causes:**
- Sync ran with old cached data
- Multiple devices syncing different data
- Need to implement conflict resolution

**Temporary Fix:**
1. Sign out
2. Clear app data
3. Sign in
4. Let sync download from cloud

---

## 📊 Success Metrics

Your sync implementation is working correctly if:

✅ **Manual Sync**
- Works on first try
- Completes in under 5 seconds
- Updates Firebase Console
- Shows success message

✅ **Auto-Sync**
- Triggers within 2-3 seconds of data change
- Debounces multiple rapid changes
- Doesn't block UI
- Runs in background silently

✅ **Reliability**
- No crashes
- No data loss
- Works consistently
- Handles errors gracefully

✅ **User Experience**
- Seamless (user doesn't notice it)
- Fast (no waiting)
- Reliable (always works)
- Transparent (can see last sync time)

---

## 🎯 Final Verification

After completing all tests, verify:

### Firebase Console Check
- [ ] Navigate to Firestore Database
- [ ] Collection `userData` exists
- [ ] Document with your user ID exists
- [ ] All books are there
- [ ] All entries are there
- [ ] All categories are there
- [ ] Timestamps are correct

### App State Check
- [ ] Settings shows "Last synced: [recent time]"
- [ ] Sync toggle works
- [ ] Manual sync button works
- [ ] All data visible in app
- [ ] No error badges/warnings

### Performance Check
- [ ] App remains responsive during sync
- [ ] No lag when creating entries
- [ ] Dashboard loads quickly
- [ ] No memory leaks (app doesn't slow down over time)

---

## 📞 If You Need Help

If any test fails:

1. **Note which test failed**
2. **Copy console logs** from the failure
3. **Screenshot error messages**
4. **Note steps to reproduce**
5. **Check if it's consistent** (happens every time?)

Then share:
- Test number that failed
- Console logs
- Screenshots
- Device/emulator info

---

## ✅ Quick Pass/Fail Summary

Mark each test:
- [ ] Test 1: Manual Sync (First Time) - ✅ PASS / ❌ FAIL
- [ ] Test 2: Auto-Sync on Create - ✅ PASS / ❌ FAIL
- [ ] Test 3: Auto-Sync on Update - ✅ PASS / ❌ FAIL
- [ ] Test 4: Auto-Sync on Delete - ✅ PASS / ❌ FAIL
- [ ] Test 5: Rapid Changes - ✅ PASS / ❌ FAIL
- [ ] Test 6: Concurrent Sync Prevention - ✅ PASS / ❌ FAIL
- [ ] Test 7: Offline → Online - ✅ PASS / ❌ FAIL
- [ ] Test 8: Sign Out → Sign In - ✅ PASS / ❌ FAIL
- [ ] Test 9: Multiple Data Types - ✅ PASS / ❌ FAIL
- [ ] Test 10: Sync Toggle - ✅ PASS / ❌ FAIL

**Overall Status:** 🎯 ___ / 10 tests passing

---

**Once all tests pass, your cloud sync is production-ready!** 🚀
