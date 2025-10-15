# 🧪 Bug Fix Testing Checklist

**Date:** October 12, 2025  
**Purpose:** Verify all bug fixes are working correctly  
**Status:** Ready for Testing

---

## ⚡ Quick Test Summary

All bugs were already fixed in previous sessions. This checklist helps verify they're working correctly.

---

## 🔴 Critical Priority (Test First)

### Test 1: Date Serialization (Bugs #1-3)

**Time:** 5 minutes  
**Devices:** 1 device + Firebase Console

#### Steps:
1. ✅ Open app → Create new entry with today's date
2. ✅ Open Firebase Console (https://console.firebase.google.com)
3. ✅ Navigate to: Firestore → users → [your-user-id] → Document
4. ✅ Look at `entries` array
5. ✅ Find your new entry

#### Expected Results:
```javascript
// In Firebase Console:
entries: [
  {
    id: "entry_123...",
    date: "2025-10-12T15:30:00.000Z",  // ← STRING, not object
    createdAt: "2025-10-12T15:30:00.000Z",  // ← STRING
    amount: 1000,
    // ...
  }
]
```

#### Expected Console Logs:
```bash
📝 Raw data before sanitization:
  date: Sat Oct 12 2025 15:30:00
  dateType: "object"
  dateInstanceOf: true

🧹 Sanitized data ready for upload:
  date: "2025-10-12T15:30:00.000Z"
  dateType: "string"
```

#### ❌ If you see this (BAD):
```javascript
date: {
  seconds: 1697126400,
  nanoseconds: 0
}
// This is a Firestore Timestamp - WRONG!
```

---

### Test 2: Multi-Device Sync

**Time:** 10 minutes  
**Devices:** 2 devices OR 1 device + web

#### Steps:
1. ✅ Device 1: Create entry "Test Entry"
2. ✅ Wait 2-3 seconds for auto-sync
3. ✅ Device 2: Pull to refresh or navigate away and back
4. ✅ Device 2: Should see "Test Entry"
5. ✅ Device 2: Edit entry → Change amount
6. ✅ Wait 2-3 seconds
7. ✅ Device 1: Pull to refresh
8. ✅ Device 1: Should see updated amount

#### Expected Console Logs (Both Devices):
```bash
# Device 1:
⏰ Auto-sync triggered (2s debounce)
🔀 Starting Git-style sync: PULL → MERGE → PUSH
📥 PULL: Downloading latest from cloud...
✅ Sync complete

# Device 2:
📥 PULL: Downloading latest from cloud...
🔀 MERGE: Three-way merge...
📤 PUSH: Uploading merged data...
✅ Sync complete
```

---

## 🟠 High Priority (Test Second)

### Test 3: Token Refresh After Idle

**Time:** 12 minutes  
**Devices:** 1 device

#### Steps:
1. ✅ Open app and sign in
2. ✅ Leave app open (don't close)
3. ✅ Wait 10-12 minutes (browse other apps, but don't force-quit)
4. ✅ Return to app
5. ✅ Create or edit an entry
6. ✅ Watch console logs

#### Expected Console Logs:
```bash
🔑 Refreshing auth token...
✅ Auth token refreshed successfully
📡 Sync attempt 1/3...
🔄 Starting cloud-first sync...
✅ Sync complete
```

#### ❌ If you see this (BAD):
```bash
❌ Auth session expired or not initialized
🔐 Session expired. Please sign in again.
```

---

### Test 4: Database Migration

**Time:** 3 minutes  
**Devices:** 1 device

#### Steps:
1. ✅ **First App Start:** Install app fresh OR clear app data
2. ✅ Launch app
3. ✅ Check console logs
4. ✅ **Second Start:** Close and reopen app
5. ✅ Check console logs again

#### Expected Console Logs:

**First Start:**
```bash
🔄 Checking if migration is needed...
🚀 Running multi-currency migration...
✓ Added currency column to books
✓ Added lockedExchangeRate column to books
✅ Migration complete
```

**Second Start (and all subsequent starts):**
```bash
🔄 Checking if migration is needed...
✅ Migration already completed, skipping
```

#### ❌ If you see this (BAD):
```bash
🚀 Running multi-currency migration...  // ← On every start
Error: duplicate column name: currency
```

---

## 🟡 Medium Priority (Test Third)

### Test 5: Error Boundary

**Time:** 2 minutes  
**Devices:** 1 device

#### Option A: Simulate Crash (Development Mode)
1. ✅ Open `DashboardScreen.tsx` or any screen
2. ✅ Add this line at the top of component:
   ```typescript
   if (true) throw new Error('Test crash for error boundary');
   ```
3. ✅ Save file
4. ✅ Navigate to that screen

#### Expected Result:
- ❌ Screen shows error message (not blank screen)
- ✅ "Something went wrong" card appears
- ✅ "Try Again" button visible
- ✅ Error details shown (dev mode only)
- ✅ Click "Try Again" → Removes error

#### Option B: Natural Error (Any Mode)
1. ✅ Turn off WiFi completely
2. ✅ Try to sign in
3. ✅ App should show error message (not crash)

---

### Test 6: Currency Symbol Display

**Time:** 5 minutes  
**Devices:** 1 device

#### Steps:
1. ✅ Dashboard → Check currency symbols
2. ✅ Settings → Preferences → Change Currency (INR → USD)
3. ✅ Go back to Dashboard
4. ✅ All amounts should show $ symbol
5. ✅ Add Book → Select EUR as book currency
6. ✅ Create book
7. ✅ Dashboard → New book should show € symbol
8. ✅ User default still shows $

#### Expected Results:
| Currency | Symbol | Example |
|----------|--------|---------|
| INR | ₹ | ₹1,234.56 |
| USD | $ | $1,234.56 |
| EUR | € | €1,234.56 |
| GBP | £ | £1,234.56 |
| JPY | ¥ | ¥1,234 |

#### ❌ If you see this (BAD):
```
USD 1234.56  // ← Code instead of symbol
1234.56      // ← No symbol at all
₹1,234.56    // ← Wrong symbol (INR when currency is USD)
```

---

## 🟢 Low Priority (Test Last)

### Test 7: Error Messages

**Time:** 8 minutes  
**Devices:** 1 device

#### Scenario A: Network Error
1. ✅ Turn off WiFi
2. ✅ Try to sync (create entry)
3. ✅ Should see: "📡 Network error. Please check your internet connection"

#### Scenario B: Session Expired
1. ✅ Sign in
2. ✅ Leave app for 15+ minutes
3. ✅ Return and try to sync
4. ✅ Should see: "🔐 Session expired. Please sign in again"

#### Scenario C: Validation Error
1. ✅ Add Book → Don't enter name
2. ✅ Click Create
3. ✅ Should see: "Book name is required"
4. ✅ Enter name, don't select currency
5. ✅ Click Create
6. ✅ Should see: "Please select a currency for this book"

#### Expected: NO Generic Errors
❌ "An error occurred"  
❌ "Something went wrong"  
❌ "Error: undefined"  
✅ Specific, actionable messages

---

### Test 8: Rapid Sync (Race Condition)

**Time:** 3 minutes  
**Devices:** 1 device

#### Steps:
1. ✅ Create entry quickly
2. ✅ Immediately edit it
3. ✅ Immediately create another entry
4. ✅ Watch console logs

#### Expected Console Logs:
```bash
⏰ Auto-sync triggered (2s debounce)
🔄 Starting cloud-first sync...
⏭️ Sync already in progress, skipping...  // ← Second sync skipped
⏭️ Sync already in progress, skipping...  // ← Third sync skipped
✅ Sync complete
⏰ Auto-sync triggered (2s debounce)  // ← Triggers after first completes
```

#### ❌ If you see this (BAD):
```bash
🔑 Refreshing auth token...
🔑 Refreshing auth token...  // ← Duplicate refresh
🔑 Refreshing auth token...  // ← Should not happen
```

---

## 📊 Test Results Template

### Test Completion Checklist

#### Critical Tests:
- [ ] Test 1: Date Serialization → Firebase shows strings ✅ or ❌
- [ ] Test 2: Multi-Device Sync → Both devices sync ✅ or ❌

#### High Priority Tests:
- [ ] Test 3: Token Refresh → Works after 10 min idle ✅ or ❌
- [ ] Test 4: Database Migration → Runs once only ✅ or ❌

#### Medium Priority Tests:
- [ ] Test 5: Error Boundary → Shows retry button ✅ or ❌
- [ ] Test 6: Currency Symbols → Correct symbols shown ✅ or ❌

#### Low Priority Tests:
- [ ] Test 7: Error Messages → Helpful messages ✅ or ❌
- [ ] Test 8: Rapid Sync → No race conditions ✅ or ❌

---

## 🐛 If Tests Fail

### Date Serialization Fails
**Issue:** Firebase shows Date objects, not strings

**Fix:**
1. Check console logs for `sanitizeDataForFirestore` logs
2. Restart app (Metro bundler caches old code)
3. Clear app data and reinstall

### Token Refresh Fails
**Issue:** "Session expired" after idle period

**Check:**
1. Console logs show `getIdToken(true)` call
2. Firebase auth token isn't actually expired (check Firebase Console)
3. Network connectivity is stable

### Migration Runs Twice
**Issue:** "duplicate column" error on restart

**Check:**
1. `migration_log` table exists in database
2. Console shows "checking if migration is needed"
3. SQLite database isn't corrupted

### Error Boundary Not Showing
**Issue:** Blank screen instead of error UI

**Check:**
1. `ErrorBoundary` wraps entire app in `App.tsx`
2. Error is thrown inside React component (not async/outside render)
3. Error boundary `componentDidCatch` is called

---

## 📝 Notes

### Console Log Filtering

To see only relevant logs, filter by:
- `🔑` - Auth/token logs
- `📡` - Sync logs
- `🔄` - Migration logs
- `❌` - Error logs
- `✅` - Success logs

### Firebase Console Access

1. Go to: https://console.firebase.google.com
2. Select your project
3. Firestore Database → Data tab
4. Navigate: users → [your-user-id]
5. Check `entries`, `books`, `categories` arrays

### Best Testing Time

- **Mornings:** Network errors (lower traffic)
- **Evenings:** Token refresh (after 8+ hours)
- **Weekends:** Multi-device sync (have time to wait)

---

## ✅ Success Criteria

### All Tests Pass When:
1. ✅ Dates in Firebase are strings (ISO format)
2. ✅ Multi-device sync works bidirectionally
3. ✅ Token refreshes automatically after idle
4. ✅ Migration runs once per install
5. ✅ Error boundary shows retry button
6. ✅ Currency symbols match selected currency
7. ✅ Error messages are helpful and specific
8. ✅ No race conditions in rapid sync

---

**Testing Started:** _____________  
**Testing Completed:** _____________  
**Passed:** ____ / 8 tests  
**Failed:** ____ / 8 tests  
**Notes:** ___________________________________

---

## 🚀 Quick Start

**Don't have time for full test?**  
Run these 3 critical tests (15 minutes total):

1. ✅ Test 1: Date Serialization (5 min)
2. ✅ Test 3: Token Refresh (10 min - mostly waiting)
3. ✅ Test 6: Currency Symbols (5 min)

These cover 80% of critical functionality!
