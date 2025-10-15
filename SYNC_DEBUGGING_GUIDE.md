# 🔍 Git-Style Sync Debugging Guide

## Critical Fix Applied

### **MAJOR BUG FIXED**: Local data wasn't including tombstones!

**Location**: `src/contexts/AuthContext.tsx` - Line ~1255

**The Problem**:
```typescript
// ❌ WRONG - These methods filter out deleted items!
const localBooks = await asyncStorageService.getBooks(user.id);
const localEntries = await asyncStorageService.getEntries(book.id);
const localCategories = await asyncStorageService.getCategories(user.id);
```

**Result**: When you deleted something locally, the merge didn't see the tombstone, so it couldn't detect the deletion!

**The Fix**:
```typescript
// ✅ CORRECT - These methods include deleted items (tombstones)
const localBooks = await asyncStorageService.getAllBooks(user.id);
const localEntries = await asyncStorageService.getAllEntries(user.id);
const localCategories = await asyncStorageService.getAllCategories(user.id);
```

---

## How to Test the Fix

### Test 1: Delete Entry, Immediate Refresh

**Steps**:
1. Phone A: Create entry "Test 1", ₹100
2. Phone A: Pull-to-refresh (syncs to cloud)
3. Phone A: Delete the entry
4. Phone A: **Immediately** pull-to-refresh

**Expected Console Logs**:
```
AsyncStorage: Successfully marked entry as deleted (tombstone): entry_xxx
📱 Step 2: Getting local data for merge (INCLUDING DELETED TOMBSTONES)...
📱 Local data: { 
  books: 1, 
  entries: 1,  ← Should be 1, not 0!
  deletedEntries: 1  ← Should show 1 deleted entry
}
🔀 Three-way merge for entry entry_xxx:
   Base: 1, Local: v2 (base: 1), Cloud: v1 (base: 1)
   ⬆️ Only local changed - keeping local (will push)
✅ Merge complete: 1 items (1 deleted tombstones), 0 conflicts
```

**Before Fix (BROKEN)**:
```
📱 Local data: { 
  books: 1, 
  entries: 0,  ← WRONG! Tombstone filtered out
  deletedEntries: 0
}
// Merge doesn't see local deletion, so it re-downloads from cloud
// Entry comes back!
```

---

### Test 2: Delete on Phone A, Sync to Phone B

**Steps**:
1. Both phones: Synced with entry "Test 2"
2. Phone A: Delete entry
3. Phone A: Pull-to-refresh
4. Wait 5 seconds
5. Phone B: Pull-to-refresh

**Expected on Phone A**:
```
AsyncStorage: Successfully marked entry as deleted (tombstone)
📱 Local data: { entries: 1, deletedEntries: 1 }
🔀 Three-way merge: Local v2 (deleted) vs Cloud v1 (not deleted)
   ⬆️ Only local changed - keeping local
✅ Merge complete: 1 items (1 deleted tombstones)
📤 Step 5: PUSH - Uploading merged data to cloud...
```

**Expected on Phone B**:
```
☁️ Cloud data: { entries: 1 }  ← Cloud now has tombstone
📱 Local data: { entries: 1, deletedEntries: 0 }
🔀 Three-way merge: Local v1 (not deleted) vs Cloud v2 (deleted)
   ⬇️ Only cloud changed - fast-forward to cloud
✅ Merge complete: 1 items (1 deleted tombstones)
💾 Saving merged data locally...
// When displaying, getEntries() filters tombstone
```

---

## Complete Sync Flow (After Fix)

### 1. Delete Operation
```typescript
asyncStorage.deleteEntry(entryId)
  → Mark: deleted: true
  → Increment: version: v1 → v2
  → Save tombstone to local storage
```

### 2. Pull-to-Refresh Triggered
```typescript
syncNow()
  ↓
  STEP 1: Download cloud data
    → Cloud entries (including tombstones from other devices)
  
  STEP 2: Get local data INCLUDING TOMBSTONES
    → getAllBooks(), getAllEntries(), getAllCategories()
    → ✅ Includes items with deleted: true
  
  STEP 3: Merge
    → GitStyleSyncService.mergeArrays(localEntries, cloudEntries)
    → Three-way merge detects:
      • Local deletion (v2, deleted: true)
      • Cloud unchanged (v1, deleted: false)
      • Decision: Local changed → Keep local
    → Returns merged array WITH tombstone
  
  STEP 4: Save merged data locally
    → saveDownloadedDataToLocal()
    → Saves tombstones to local storage
  
  STEP 5: Push to cloud
    → syncLocalDataToFirestore()
    → getAllX() methods include tombstones
    → Uploads tombstones to Firestore
```

### 3. Display to User
```typescript
getEntries(bookId)
  → Reads all entries from storage
  → Filters: entry.deleted !== true
  → Returns only non-deleted entries
  → User doesn't see deleted items
```

---

## Debugging Console Logs

### Check if Tombstones Are Being Loaded

After deleting an entry, pull-to-refresh and look for:

```
📱 Local data: { 
  books: 1, 
  entries: 5,  ← Total including deleted
  categories: 5,
  deletedBooks: 0,
  deletedEntries: 1,  ← SHOULD BE > 0 if you deleted something!
  deletedCategories: 0
}
```

If `deletedEntries: 0` even though you deleted something → **Bug in getAllEntries()**

---

### Check if Merge Sees Deletion

Look for three-way merge logs:

```
🔀 Three-way merge for entry entry_abc123:
   Base: 1, Local: v2 (base: 1), Cloud: v1 (base: 1)
   ⬆️ Only local changed - keeping local (will push)
```

If you don't see this for a deleted entry → **Tombstone not in local data**

---

### Check if Tombstone Uploaded

After sync, check Firebase Console → Firestore:

```
users/{userId}/entries/entry_abc123:
{
  "id": "entry_abc123",
  "deleted": true,
  "deletedAt": "2025-10-15T...",
  "version": 2,
  ...
}
```

If `deleted: false` or entry missing → **Upload didn't include tombstone**

---

### Check if Other Device Downloads Tombstone

On Phone B, pull-to-refresh:

```
☁️ Cloud data: { entries: 5 }  ← Should include tombstone from cloud
🔀 Merging entries: 5 local, 5 cloud, 5 unique
📥 New from cloud: entry_abc123  ← Downloading tombstone
✅ Merge complete: 5 items (1 deleted tombstones)
```

---

## Common Issues & Solutions

### Issue 1: "Entry comes back after deleting"

**Symptom**: Delete entry, refresh, it reappears

**Debug**:
1. Check console log: `deletedEntries: ?`
   - If 0 → **Fix not applied, still using getEntries() instead of getAllEntries()**
2. Check three-way merge log
   - If merge doesn't show deleted entry → **Tombstone not loaded**

**Solution**: Verify `AuthContext.tsx` line ~1255 uses `getAllEntries()`

---

### Issue 2: "Deletion doesn't sync to other device"

**Symptom**: Delete on Phone A, Phone B still has entry

**Debug**:
1. Phone A: Check upload log
   ```
   📤 Step 5: PUSH - Uploading merged data to cloud...
   📝 Raw data before sanitization: { entriesCount: ? }
   ```
   - Should include tombstone count

2. Firebase Console: Check if tombstone exists in Firestore

3. Phone B: Check download log
   ```
   ☁️ Cloud data: { entries: ? }
   ```
   - Should include tombstone

**Solution**: 
- Verify `syncLocalDataToFirestore()` uses `getAllEntries()`
- Verify `mergeArrays()` doesn't filter tombstones

---

### Issue 3: "Version not incrementing on delete"

**Symptom**: Console shows same version before/after delete

**Debug**:
```
🔀 Three-way merge for entry entry_xxx:
   Base: 1, Local: v1 (base: 1), Cloud: v1 (base: 1)  ← Local should be v2!
   ✅ No changes on either side  ← WRONG!
```

**Solution**: Verify `asyncStorage.deleteEntry()` increments version:
```typescript
version: (entry.version || 0) + 1
```

---

### Issue 4: "Conflicts not detected"

**Symptom**: Edit same field on both devices, no conflict shown

**Debug**:
```
🔀 Merge complete: { conflicts: 0 }  ← Should be > 0
```

**Solution**: Check `threeWayMerge()` in `gitStyleSync.ts`:
- Verify both sides detected as changed
- Verify field-level comparison works

---

### Issue 5: "Sync loop - keeps re-syncing"

**Symptom**: Pull-to-refresh triggers another sync immediately

**Debug**:
```
✅ Git-style sync complete
📡 Data changed, triggering auto-sync...  ← Loop!
📡 Starting sync now...
```

**Solution**: Check `justUploadedRef.current` flag
- Should be set to `true` before upload
- Listener should check this flag

---

## Files to Check

### 1. `src/contexts/AuthContext.tsx`
**Lines ~1255-1260**: ✅ **FIXED** - Now uses `getAllX()` methods
```typescript
const localBooks = await asyncStorageService.getAllBooks(user.id);
const localCategories = await asyncStorageService.getAllCategories(user.id);
const localEntries = await asyncStorageService.getAllEntries(user.id);
```

### 2. `src/services/asyncStorage.ts`
**deleteBook/Entry/Category**: ✅ **FIXED** - Increments version
```typescript
version: (item.version || 0) + 1
```

### 3. `src/services/gitStyleSync.ts`
**mergeArrays()**: ✅ **FIXED** - Keeps tombstones
```typescript
return { merged, conflicts: allConflicts };  // No filtering
```

---

## Quick Verification Checklist

After deleting an entry:

- [ ] Console shows: `deletedEntries: 1` (not 0)
- [ ] Console shows: `Only local changed - keeping local`
- [ ] Console shows: `Merge complete: X items (1 deleted tombstones)`
- [ ] Entry not visible in list (filtered on display)
- [ ] Firebase has entry with `deleted: true`
- [ ] Other device syncs and entry deleted there too

If all checked ✅ → **Git-style sync working correctly!**

---

## Advanced Debugging

### Enable Verbose Logging

Add this to see merge details:

```typescript
console.log('🔍 DEBUG - Local entries:', localEntries.map(e => ({
  id: e.id.substring(0, 8),
  amount: e.amount,
  deleted: e.deleted,
  version: e.version,
  lastSyncedVersion: e.lastSyncedVersion
})));

console.log('🔍 DEBUG - Cloud entries:', cloudEntries.map(e => ({
  id: e.id.substring(0, 8),
  amount: e.amount,
  deleted: e.deleted,
  version: e.version,
  lastSyncedVersion: e.lastSyncedVersion
})));
```

### Verify Tombstone Lifecycle

1. **Create**: Entry v1, deleted: false
2. **Delete**: Entry v2, deleted: true (tombstone created)
3. **Merge**: Tombstone kept in merged array
4. **Save**: Tombstone saved to local storage
5. **Upload**: Tombstone uploaded to cloud
6. **Download**: Tombstone downloaded by other device
7. **Display**: Tombstone filtered out (user doesn't see it)

If any step fails, check that specific component.

---

## Expected Behavior Summary

### ✅ Correct Behavior:
- Delete entry → Tombstone created (deleted: true, version++)
- Merge includes tombstone (not filtered)
- Tombstone saved locally and uploaded to cloud
- Other devices download tombstone
- Display filters tombstone (users don't see deleted items)
- All devices show same data (eventually consistent)

### ❌ Incorrect Behavior:
- Entry comes back after deleting
- Deletion doesn't sync to other devices
- Console shows `deletedEntries: 0` after deleting
- Merge says "No changes" when entry deleted
- Version doesn't increment on delete
- Sync loops infinitely

---

## Status: ✅ CRITICAL FIX APPLIED

The major issue (using `getX()` instead of `getAllX()` for local data) has been fixed. This should resolve most deletion sync issues.

**Test now and check console logs to verify the fix is working!**
