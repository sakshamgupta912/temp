# 🧪 Merge Conflict Testing Scenarios

## Scenario 1: Simple Conflict - Both Edit Same Field

### Objective
Test that the system detects conflicts when both devices edit the same field with different values.

### Setup
- 2 devices (or emulator + physical phone)
- Both devices logged in with same account
- Both devices synced with same data

### Steps

#### Part A: Initial Setup
1. **Device A**: Create a new entry
   - Book: "Test Book"
   - Entry: "Lunch", ₹500, Remarks: "Original"
   - Pull-to-refresh to sync

2. **Device B**: Pull-to-refresh
   - Verify entry appears: "Lunch", ₹500, "Original"
   - Both devices now have entry v1

#### Part B: Create Conflict (Same Field)
3. **Turn OFF WiFi on BOTH devices** (Airplane mode or WiFi off)

4. **Device A**: Edit the entry
   - Change amount: ₹500 → **₹750**
   - Don't sync yet (WiFi off)
   - Entry now: v2, amount=750, lastSyncedVersion=1

5. **Device B**: Edit the SAME entry
   - Change amount: ₹500 → **₹600**
   - Don't sync yet (WiFi off)
   - Entry now: v2, amount=600, lastSyncedVersion=1

#### Part C: Trigger Conflict
6. **Turn ON WiFi on Device A first**
   - Pull-to-refresh on Device A
   - Upload happens: Entry v2, amount=750 goes to cloud
   - Cloud now has: Entry v2, amount=750

7. **Turn ON WiFi on Device B**
   - Pull-to-refresh on Device B
   - **CONFLICT SHOULD BE DETECTED!**

### Expected Console Logs on Device B

```
📡 Sync attempt 1/3...
☁️ Cloud data: { entries: 1 }
📱 Local data: { 
  entries: 1, 
  deletedEntries: 0 
}
🔀 Three-way merge for entry entry_xxx:
   Base: 1, Local: v2 (base: 1), Cloud: v2 (base: 1)
   ⚠️ Both sides changed - checking fields for conflicts...
   ⚠️ CONFLICT on "amount": local="600" vs cloud="750"
   ⚠️ 1 conflicts detected - using cloud values by default
✅ Merge complete: 1 items (0 deleted tombstones), 1 conflicts

⚠️ CONFLICTS DETECTED: 1 conflicts found!
  Conflict 1: entry entry_xxx.amount
    Local: 600
    Cloud: 750
⚠️ Using cloud values for conflicts by default

✅ Git-style sync complete - Data merged and synced across devices!
```

### Expected Behavior
- ✅ Conflict detected
- ✅ Default: Cloud wins (Device A's value: ₹750)
- ✅ Device B now shows: Entry ₹750
- ✅ Conflict count: 1
- ⚠️ User should be notified (when UI implemented)

### Verification Checklist
- [ ] Console shows "CONFLICT on amount"
- [ ] Console shows both values (local=600, cloud=750)
- [ ] Device B shows ₹750 (cloud value)
- [ ] No errors in console
- [ ] Conflict count updates in UI (if implemented)

---

## Scenario 2: Auto-Merge - Different Fields

### Objective
Test that the system auto-merges when devices edit different fields (no conflict).

### Steps

#### Part A: Setup
1. **Device A**: Create entry
   - Entry: "Dinner", ₹1000, Remarks: ""
   - Pull-to-refresh to sync

2. **Device B**: Pull-to-refresh
   - Verify entry appears

#### Part B: Edit Different Fields
3. **Turn OFF WiFi on BOTH devices**

4. **Device A**: Edit remarks only
   - Remarks: "" → **"At restaurant"**
   - Amount stays: ₹1000
   - Entry: v2, amount=1000, remarks="At restaurant"

5. **Device B**: Edit amount only
   - Amount: ₹1000 → **₹1200**
   - Remarks stays: ""
   - Entry: v2, amount=1200, remarks=""

#### Part C: Trigger Auto-Merge
6. **Turn ON WiFi on Device A**
   - Pull-to-refresh
   - Uploads: v2, amount=1000, remarks="At restaurant"

7. **Turn ON WiFi on Device B**
   - Pull-to-refresh
   - **AUTO-MERGE SHOULD HAPPEN**

### Expected Console Logs on Device B

```
🔀 Three-way merge for entry entry_xxx:
   Base: 1, Local: v2 (base: 1), Cloud: v2 (base: 1)
   ⚠️ Both sides changed - checking fields for conflicts...
   ⚠️ CONFLICT on "amount": local="1200" vs cloud="1000"
   ⚠️ CONFLICT on "remarks": local="" vs cloud="At restaurant"
   ⚠️ 2 conflicts detected - using cloud values by default
✅ Merge complete: 1 items (0 deleted tombstones), 2 conflicts
```

### Current Limitation
**Note**: The current implementation will detect this as conflicts because it compares field values directly without tracking which fields actually changed from the base. 

**Ideal behavior** (future improvement):
- Base: amount=1000, remarks=""
- Local changed: amount → 1200 (remarks unchanged)
- Cloud changed: remarks → "At restaurant" (amount unchanged)
- Auto-merge: amount=1200, remarks="At restaurant"

**Current behavior**:
- Both fields differ → Both marked as conflicts
- Cloud wins by default
- Result: amount=1000, remarks="At restaurant"

---

## Scenario 3: Delete-Edit Conflict

### Objective
Test DELETE-EDIT conflict detection.

### Steps

#### Part A: Setup
1. **Both devices synced** with entry "Snacks", ₹200

#### Part B: Create DELETE-EDIT Conflict
2. **Turn OFF WiFi on BOTH devices**

3. **Device A**: Delete the entry
   - Entry marked: deleted=true, version=2

4. **Device B**: Edit the entry
   - Change amount: ₹200 → ₹300
   - Entry: deleted=false, version=2, amount=300

#### Part C: Trigger Conflict
5. **Turn ON WiFi on Device A**
   - Pull-to-refresh
   - Uploads deletion

6. **Turn ON WiFi on Device B**
   - Pull-to-refresh
   - **DELETE-EDIT CONFLICT DETECTED**

### Expected Console Logs

```
🔀 Three-way merge for entry entry_xxx:
   Base: 1, Local: v2 (base: 1), Cloud: v2 (base: 1)
   ⚠️ EDIT-DELETE CONFLICT: Cloud deleted, local edited
  Conflict 1: entry entry_xxx.deleted
    Local: EDITED
    Cloud: DELETED
```

### Expected Behavior
- ✅ Conflict detected
- ✅ Default: Deletion wins
- ✅ Entry deleted on Device B
- ⚠️ User should be asked (when UI implemented)

---

## Scenario 4: No Conflict - Simple Update

### Objective
Test that simple updates (one device only) work without conflicts.

### Steps

1. **Both devices synced** with entry "Coffee", ₹100

2. **Device A**: Edit entry
   - Change amount: ₹100 → ₹150
   - Pull-to-refresh

3. **Device B**: Pull-to-refresh (don't edit)

### Expected Console Logs on Device B

```
🔀 Three-way merge for entry entry_xxx:
   Base: 1, Local: v1 (base: 1), Cloud: v2 (base: 1)
   ⬇️ Only cloud changed - fast-forward to cloud
✅ Merge complete: 1 items (0 deleted tombstones), 0 conflicts
```

### Expected Behavior
- ✅ No conflict
- ✅ Device B updates to ₹150
- ✅ Fast-forward merge

---

## Scenario 5: Stress Test - Multiple Conflicts

### Objective
Test multiple entries with various conflicts.

### Steps

1. **Create 3 entries** on Device A, sync to Device B:
   - Entry 1: "Food", ₹500
   - Entry 2: "Transport", ₹200
   - Entry 3: "Shopping", ₹1000

2. **Turn OFF WiFi on BOTH devices**

3. **Device A edits**:
   - Entry 1: ₹500 → ₹600 (edit amount)
   - Entry 2: Delete
   - Entry 3: ₹1000 → ₹1100 (edit amount)

4. **Device B edits**:
   - Entry 1: ₹500 → ₹550 (edit amount - CONFLICT!)
   - Entry 2: ₹200 → ₹250 (edit amount - DELETE-EDIT CONFLICT!)
   - Entry 3: No change

5. **Turn ON WiFi, sync both**

### Expected Results
- Entry 1: Conflict detected (600 vs 550) → Cloud wins (600)
- Entry 2: DELETE-EDIT conflict → Deletion wins
- Entry 3: No conflict → Fast-forward to 1100

---

## Testing Checklist

### ✅ Before Testing
- [ ] All 4 sync fixes applied
- [ ] App running on both devices
- [ ] Both devices logged in with same account
- [ ] Both devices can sync (WiFi working)
- [ ] Console logs visible (React Native Debugger or Logcat)

### ✅ During Testing
- [ ] Take screenshots of console logs
- [ ] Note timestamps of operations
- [ ] Document unexpected behavior
- [ ] Check Firebase Console for data

### ✅ After Testing
- [ ] Conflicts detected correctly
- [ ] No data loss
- [ ] Both devices end up with same data
- [ ] No errors in console
- [ ] Version numbers increment properly

---

## Console Log Debugging

### Look for these logs to verify:

**1. Local data loading**:
```
📱 Local data: { 
  entries: X, 
  deletedEntries: Y 
}
```
- If deletedEntries = 0 but you deleted something → Fix 4 not applied

**2. Three-way merge decision**:
```
⬆️ Only local changed - keeping local
⬇️ Only cloud changed - fast-forward to cloud
⚠️ Both sides changed - checking fields for conflicts
```

**3. Conflict detection**:
```
⚠️ CONFLICT on "amount": local="X" vs cloud="Y"
⚠️ CONFLICTS DETECTED: N conflicts found!
```

**4. Merge result**:
```
✅ Merge complete: X items (Y deleted tombstones), Z conflicts
```

---

## Expected Outcomes Summary

| Scenario | Device A Action | Device B Action | Expected Result |
|----------|----------------|-----------------|-----------------|
| 1 | Edit amount→750 | Edit amount→600 | Conflict, cloud wins (750) |
| 2 | Edit remarks | Edit amount | Both conflicts detected* |
| 3 | Delete entry | Edit entry | DELETE-EDIT conflict, deletion wins |
| 4 | Edit amount→150 | No change | Fast-forward, no conflict |
| 5 | Multiple edits/deletes | Multiple edits | Multiple conflicts detected |

*Note: Current implementation treats different field values as conflicts. Future improvement: track base values to enable true auto-merge.

---

## Quick Test Script

### 1-Minute Quick Test:
```
1. Create entry "Test", ₹100
2. Sync both devices
3. WiFi OFF on both
4. Device A: Edit to ₹200
5. Device B: Edit to ₹300
6. WiFi ON, sync Device A first
7. WiFi ON, sync Device B
8. Check console: Should see CONFLICT!
```

### Expected Output:
```
⚠️ CONFLICT on "amount": local="300" vs cloud="200"
```

---

## Tips

1. **Use React Native Debugger** for clear console logs
2. **Turn WiFi off** in device settings (not airplane mode alone)
3. **Sync Device A first** to establish cloud state
4. **Wait 2-3 seconds** between syncs
5. **Check Firebase Console** to see what's in cloud
6. **Clear app data** if things get confused
7. **Take screenshots** of conflicts for documentation

---

## Success Criteria

- ✅ Same-field conflicts detected
- ✅ Different-field changes marked as conflicts (current behavior)
- ✅ DELETE-EDIT conflicts detected
- ✅ Cloud wins by default
- ✅ No data corruption
- ✅ Both devices eventually consistent
- ✅ Console shows clear conflict messages

---

## If Conflicts Not Detected

Check:
1. Both devices actually edited (check version numbers)
2. Fix 4 applied (uses `getAllEntries()`)
3. Merge logic correct (check `gitStyleSync.ts`)
4. Console shows "Both sides changed"
5. Firebase has latest data

---

**Ready to test? Start with Scenario 1 - it's the easiest to verify!** 🧪
