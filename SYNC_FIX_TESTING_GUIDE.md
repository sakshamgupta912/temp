# Git-Style Sync Fix - Testing Guide

## What Was Fixed

### Critical Bugs Fixed:

1. **`lastSyncedVersion` not updated** → Now ALWAYS updated after merge
2. **Version comparison logic broken** → Now uses proper change detection (`version > lastSyncedVersion`)
3. **Version not incremented on deletion** → Now increments on ALL operations
4. **Broken base field comparison** → Removed broken `_base_${field}` logic, simplified to direct value comparison
5. **Version not incremented after clean merge** → Now ALWAYS increments version after ANY merge
6. **Metadata not updated** → Now sets `lastSyncedVersion`, `version`, and `updatedAt` consistently

### How Sync Works Now:

```
Device A creates entry v1 → Syncs → Cloud has v1
Device B syncs → Downloads v1 → lastSyncedVersion = 1

Device A edits → v2 → Syncs → Cloud has v2
Device B edits → v2 → Syncs → Detects conflict!
  Local: v2 (base: 1) ← Changed!
  Cloud: v2 (base: 1) ← Changed!
  Result: v3 with conflict detected
```

## Testing Scenarios

### ✅ Scenario 1: Simple Update (No Conflict)

**Steps:**
1. Device A: Create new entry "Lunch" amount=500
2. Device A: Pull to refresh (syncs to cloud)
3. Device B: Pull to refresh (downloads entry)
4. Device A: Edit amount=600
5. Device A: Pull to refresh (syncs edit)
6. Device B: Pull to refresh (downloads edit)

**Expected:**
- ✅ Device B sees amount=600
- ✅ No conflicts detected
- ✅ Console log: "Only cloud changed - fast-forward to cloud"

**How to Test:**
```
1. Use Device A (emulator)
2. Add entry: Lunch, ₹500
3. Pull down to refresh on Dashboard
4. Wait 2 seconds
5. Use Device B (physical device or browser)
6. Pull down to refresh
7. Verify entry shows Lunch, ₹500
8. On Device A: Edit entry to ₹600
9. Pull to refresh on Device A
10. Wait 2 seconds
11. Pull to refresh on Device B
12. Verify entry shows Lunch, ₹600
```

---

### ⚠️ Scenario 2: Concurrent Edits - Same Field (CONFLICT)

**Steps:**
1. Device A: Create entry "Coffee" amount=100, sync
2. Device B: Sync (downloads entry)
3. **Offline Mode**: Turn off WiFi on both devices
4. Device A: Edit amount=150
5. Device B: Edit amount=200
6. **Online Mode**: Turn WiFi back on
7. Device A: Pull to refresh (uploads v2 with amount=150)
8. Device B: Pull to refresh (detects conflict!)

**Expected:**
- ⚠️ Conflict detected: amount field
- ⚠️ Default: Cloud wins (Device A's 150)
- ⚠️ Console log: "CONFLICT on 'amount': local=200 vs cloud=150"
- ⚠️ Conflict notification shown (if UI implemented)

**How to Test:**
```
1. Both devices online, synced
2. Create entry on Device A: Coffee, ₹100
3. Pull to refresh on Device A (uploads)
4. Pull to refresh on Device B (downloads)
5. Turn OFF WiFi on both devices
6. Device A: Edit amount to ₹150
7. Device B: Edit amount to ₹200
8. Turn ON WiFi on Device A first
9. Pull to refresh on Device A (uploads v2 = 150)
10. Turn ON WiFi on Device B
11. Pull to refresh on Device B
12. Check console logs for conflict detection
13. Verify Device B shows ₹150 (cloud won)
```

---

### ⚠️ Scenario 3: Concurrent Edits - Different Fields (AUTO-MERGE)

**Steps:**
1. Device A: Create entry "Groceries" amount=1000, remarks="", sync
2. Device B: Sync (downloads entry)
3. **Offline**: Turn off WiFi on both
4. Device A: Edit remarks="From Walmart"
5. Device B: Edit amount=1200
6. **Online**: Turn WiFi back on
7. Device A: Sync first (uploads remarks change)
8. Device B: Sync (should auto-merge!)

**Expected:**
- ✅ Both changes merged automatically
- ✅ Final: amount=1200, remarks="From Walmart"
- ✅ No conflicts (different fields)
- ✅ Console log: "Auto-merged - no conflicts"

**How to Test:**
```
1. Create entry: Groceries, ₹1000, remarks=""
2. Sync both devices
3. Turn OFF WiFi on both
4. Device A: Edit remarks to "From Walmart"
5. Device B: Edit amount to ₹1200
6. Turn ON WiFi on Device A
7. Pull to refresh on Device A
8. Turn ON WiFi on Device B
9. Pull to refresh on Device B
10. Verify Device B shows:
    - Amount: ₹1200 ✅
    - Remarks: "From Walmart" ✅
```

---

### 🗑️ Scenario 4: Delete on One, Unchanged on Other (NO CONFLICT)

**Steps:**
1. Device A: Create entry "Test" amount=100, sync
2. Device B: Sync (downloads entry)
3. **Offline**: Turn off WiFi on Device A
4. Device A: Delete entry
5. Device B: Does nothing (entry unchanged)
6. **Online**: Turn WiFi on Device A
7. Device A: Sync (uploads deletion)
8. Device B: Sync (downloads deletion)

**Expected:**
- ✅ Entry deleted on both devices
- ✅ No conflict
- ✅ Console log: "Local deleted, cloud unchanged - using deletion"

**How to Test:**
```
1. Device A: Create entry "Test", ₹100
2. Sync both devices
3. Turn OFF WiFi on Device A
4. Device A: Delete entry
5. Turn ON WiFi on Device A
6. Pull to refresh on Device A
7. Pull to refresh on Device B
8. Verify entry deleted on Device B ✅
```

---

### ⚠️ Scenario 5: Delete on One, Edit on Other (CONFLICT)

**Steps:**
1. Device A: Create entry "Dinner" amount=500, sync
2. Device B: Sync (downloads entry)
3. **Offline**: Turn off WiFi on both
4. Device A: Delete entry
5. Device B: Edit amount=700
6. **Online**: Turn WiFi back on
7. Device A: Sync first (uploads deletion)
8. Device B: Sync (detects DELETE-EDIT conflict!)

**Expected:**
- ⚠️ Conflict detected: DELETE-EDIT
- ⚠️ Default: Deletion wins
- ⚠️ Console log: "DELETE-EDIT CONFLICT: Local deleted, cloud edited"
- ⚠️ Entry remains deleted

**How to Test:**
```
1. Create entry: Dinner, ₹500
2. Sync both devices
3. Turn OFF WiFi on both
4. Device A: Delete entry
5. Device B: Edit amount to ₹700
6. Turn ON WiFi on Device A
7. Pull to refresh on Device A
8. Turn ON WiFi on Device B
9. Pull to refresh on Device B
10. Check console for "DELETE-EDIT CONFLICT"
11. Verify entry is deleted on Device B ⚠️
```

---

### 🗑️ Scenario 6: Delete on Both (NO CONFLICT)

**Steps:**
1. Device A: Create entry "Temp" amount=50, sync
2. Device B: Sync (downloads entry)
3. **Offline**: Turn off WiFi on both
4. Device A: Delete entry
5. Device B: Delete entry
6. **Online**: Turn WiFi back on
7. Device A: Sync
8. Device B: Sync

**Expected:**
- ✅ Entry deleted on both
- ✅ No conflict
- ✅ Console log: "Both deleted - using deletion"

**How to Test:**
```
1. Create entry: Temp, ₹50
2. Sync both devices
3. Turn OFF WiFi on both
4. Device A: Delete entry
5. Device B: Delete entry
6. Turn ON WiFi on both
7. Pull to refresh on both
8. Verify entry deleted, no conflicts ✅
```

---

## Console Log Analysis

### Good Logs (No Issues):

```
🔀 Three-way merge for entry abc123:
   Base: 1, Local: v1 (base: 1), Cloud: v2 (base: 1)
   ⬇️ Only cloud changed - fast-forward to cloud
✅ Merge complete: 5 items, 0 conflicts
```

### Conflict Detected (Expected):

```
🔀 Three-way merge for entry def456:
   Base: 1, Local: v2 (base: 1), Cloud: v2 (base: 1)
   ⚠️ Both sides changed - checking fields for conflicts...
   ⚠️ CONFLICT on "amount": local="200" vs cloud="150"
   ⚠️ 1 conflicts detected - using cloud values by default
✅ Merge complete: 5 items, 1 conflicts
```

### Delete-Edit Conflict:

```
🔀 Three-way merge for entry ghi789:
   Base: 1, Local: v2 (base: 1), Cloud: v2 (base: 1)
   ⚠️ DELETE-EDIT CONFLICT: Local deleted, cloud edited
✅ Merge complete: 4 items, 1 conflicts
```

---

## Version Tracking Check

After each operation, verify version numbers are correct:

### Create:
```
version: 1
lastSyncedVersion: undefined (not synced yet)
```

### After First Sync:
```
version: 1
lastSyncedVersion: 1
```

### After Local Edit (Before Sync):
```
version: 2
lastSyncedVersion: 1 (still pointing to old sync)
```

### After Sync with Edit:
```
version: 2 (or 3 if conflict)
lastSyncedVersion: 2 (updated to new sync point)
```

### After Merge:
```
version: max(local, cloud) + 1
lastSyncedVersion: cloudVersion
```

---

## Known Limitations

1. **Field-Level Base Tracking**: We don't track base values per field, so we can't detect:
   - "Both changed to same value" vs "Only one changed"
   - Current: If values differ → conflict
   - Better: Compare against base to see who actually changed

2. **Conflict UI**: No visual conflict resolution UI yet
   - Current: Cloud wins by default
   - Conflicts logged to console
   - `conflictCount` state updated

3. **Manual Conflict Resolution**: Not implemented yet
   - Users can't choose "use local" or "use cloud"
   - Would need UI screen to show conflicts and let user pick

---

## Debugging Commands

### Check Version Info in Console:
```javascript
// In React Native Debugger or Chrome DevTools
console.log('Books:', books.map(b => ({ 
  id: b.id, 
  name: b.name, 
  version: b.version, 
  lastSyncedVersion: b.lastSyncedVersion 
})));
```

### Check Firestore Directly:
```
1. Open Firebase Console
2. Go to Firestore
3. Navigate to: users/{userId}/books
4. Check version and lastSyncedVersion fields
```

### Force Conflict for Testing:
```
1. Turn OFF WiFi on both devices
2. Edit same field on both to different values
3. Turn ON WiFi on Device A, sync
4. Turn ON WiFi on Device B, sync
5. Conflict should be detected!
```

---

## Success Criteria

✅ Simple updates sync correctly (no overwrites)
✅ Deletions propagate properly (not overwritten by edits)
✅ Concurrent edits on different fields auto-merge
⚠️ Concurrent edits on same field detect conflicts
⚠️ Delete-Edit scenarios detect conflicts
✅ Version numbers increment correctly
✅ lastSyncedVersion updated after every sync
✅ No sync loops (same data re-syncing endlessly)
✅ Console logs show correct merge decisions

---

## If Issues Persist

### Check These:

1. **asyncStorage.ts**: Verify version increments on update:
   ```typescript
   version: currentVersion + 1
   ```

2. **AuthContext.tsx**: Verify sync flow:
   ```typescript
   // 1. Pull cloud data
   // 2. Get local data
   // 3. Merge with GitStyleSyncService
   // 4. Save merged data
   // 5. Push to cloud
   ```

3. **Firebase Timestamp**: Check if `updatedAt` is Date or Timestamp:
   ```typescript
   updatedAt: new Date() // Should be JavaScript Date
   ```

4. **Firestore Rules**: Verify user can read/write their data:
   ```
   match /users/{userId} {
     allow read, write: if request.auth.uid == userId;
   }
   ```

---

## Next Steps After Testing

1. **Implement Conflict UI** (if needed):
   - Create ConflictResolutionScreen.tsx
   - Show conflicts to user with options: "Use Mine" | "Use Theirs" | "Manual Edit"
   - Update AuthContext to use user's resolution

2. **Improve Field-Level Base Tracking**:
   - Store base field values when syncing
   - Use them in conflict detection to distinguish "both changed" from "both same"

3. **Add Sync Status Indicator**:
   - Show "Syncing..." spinner
   - Show "Conflicts detected" badge
   - Show last sync time

4. **Optimize Performance**:
   - Batch writes to Firestore
   - Implement incremental sync (only changed items)
   - Add offline queue for operations

---

## Final Checklist

Before marking as complete:

- [ ] All 6 test scenarios pass
- [ ] Version numbers increment correctly
- [ ] lastSyncedVersion updates after sync
- [ ] Deletions work properly (not overwritten)
- [ ] Concurrent edits on different fields auto-merge
- [ ] Concurrent edits on same field detect conflicts
- [ ] Console logs show correct merge decisions
- [ ] No errors in Firestore security rules
- [ ] No sync loops observed
- [ ] App performance acceptable (sync under 5 seconds)
