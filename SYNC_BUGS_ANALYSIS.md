# Critical Bugs in Git-Style Sync - Deletions & Updates Getting Overwritten

## Problems Identified

### Bug 1: Missing `lastSyncedVersion` Update After Merge
**Location**: `gitStyleSync.ts` - `threeWayMerge()` function

**Problem**:
```typescript
// WRONG: merged item doesn't update lastSyncedVersion properly
return { merged: local, conflicts: [] };  // Missing lastSyncedVersion update!
```

**Impact**: 
- Next sync thinks local hasn't been synced yet
- Causes re-syncing of same data
- Overwrites cloud changes

**Fix**: Always set `lastSyncedVersion = cloudVersion` after merge

---

### Bug 2: Version Comparison Logic Broken
**Location**: Lines 133-148

**Problem**:
```typescript
if (localVersion === baseVersion) {
  // Only cloud changed - fast-forward to cloud
  return { merged: { ...cloud, lastSyncedVersion: cloudVersion }, conflicts: [] };
}

if (cloudVersion === baseVersion) {
  // Only local changed - fast-forward to local
  return { merged: { ...local, lastSyncedVersion: cloudVersion }, conflicts: [] };
}
```

**Issue**: This logic assumes `baseVersion` is accurate, but:
- `baseVersion = local.lastSyncedVersion || 0` - Often 0 or undefined!
- Doesn't account for items that were never synced
- Causes false positives for "no changes"

**Result**: Updates get ignored because baseVersion is wrong

---

### Bug 3: Deletion Version Not Incremented
**Location**: Lines 120-128

**Problem**:
```typescript
if (localDeleted && !cloudDeleted && cloudVersion === baseVersion) {
  console.log('   🗑️ Local deleted, cloud unchanged - using deletion');
  return { merged: local, conflicts: [] };  // Uses old version!
}
```

**Issue**: When deleting, version isn't incremented
**Result**: Cloud doesn't see deletion as newer change

---

### Bug 4: Both-Changed Scenario Uses Wrong Base
**Location**: Lines 153-178

**Problem**:
```typescript
const localChanged = local[field] !== (local as any)[`_base_${field}`];
const cloudChanged = cloud[field] !== (local as any)[`_base_${field}`];
```

**Issue**: `_base_${field}` doesn't exist! We never store base values.
**Result**: All field comparisons fail, causing false conflicts

---

### Bug 5: Merged Version Calculation Wrong
**Location**: Line 184

**Problem**:
```typescript
(merged as any).version = Math.max(localVersion, cloudVersion) + (conflicts.length > 0 ? 1 : 0);
```

**Issue**: 
- Only increments if conflicts exist
- Clean merges don't increment version
- Result: Same version used, causing sync loops

**Correct**: Always increment version after merge: `Math.max(localVersion, cloudVersion) + 1`

---

### Bug 6: Fast-Forward Sets Wrong lastSyncedVersion
**Location**: Line 148

**Problem**:
```typescript
return { merged: { ...local, lastSyncedVersion: cloudVersion }, conflicts: [] };
```

**Issue**: When local changed (cloud unchanged), we set:
- `lastSyncedVersion = cloudVersion` (old value)
- But local version is higher!
- Result: Next sync thinks it's not synced

**Fix**: `lastSyncedVersion` should be set to what was synced TO cloud, not FROM cloud

---

## Complete Fixed Implementation

### Fix 1: Update `lastSyncedVersion` Properly

**Rule**: After ANY merge, `lastSyncedVersion` should equal the cloud version we just merged with.

```typescript
// ALWAYS return with updated lastSyncedVersion
return { 
  merged: { 
    ...mergedData, 
    lastSyncedVersion: cloudVersion 
  }, 
  conflicts 
};
```

### Fix 2: Use Proper Version Comparison

Instead of relying on `baseVersion` (often wrong), use this logic:

```typescript
// Determine who changed
const localChanged = localVersion > (local.lastSyncedVersion || 0);
const cloudChanged = cloudVersion > (cloud.lastSyncedVersion || 0);

if (!localChanged && cloudChanged) {
  // Only cloud changed → Use cloud (fast-forward)
  return { merged: { ...cloud, lastSyncedVersion: cloudVersion }, conflicts: [] };
}

if (localChanged && !cloudChanged) {
  // Only local changed → Use local (will push to cloud)
  return { merged: { ...local, lastSyncedVersion: cloudVersion }, conflicts: [] };
}

if (localChanged && cloudChanged) {
  // BOTH changed → Need conflict detection
  // ... field-level comparison ...
}
```

### Fix 3: Increment Version on Deletion

```typescript
if (localDeleted && !cloudDeleted && cloudVersion === baseVersion) {
  // Local deleted, cloud unchanged
  return { 
    merged: { 
      ...local, 
      version: Math.max(localVersion, cloudVersion) + 1,  // ← Increment!
      lastSyncedVersion: cloudVersion 
    }, 
    conflicts: [] 
  };
}
```

### Fix 4: Remove Base Field Comparison (Broken)

Remove this broken logic:
```typescript
// ❌ BROKEN - Remove this:
const localChanged = local[field] !== (local as any)[`_base_${field}`];
const cloudChanged = cloud[field] !== (local as any)[`_base_${field}`];
```

Use simpler approach:
```typescript
// ✅ FIXED - Use this:
// If field values differ AND both versions changed, it's a conflict
if (local[field] !== cloud[field]) {
  conflicts.push({ ... });
  merged[field] = cloud[field];  // Default: cloud wins
}
```

### Fix 5: Always Increment Merged Version

```typescript
// ✅ ALWAYS increment version after merge
const newVersion = Math.max(localVersion, cloudVersion) + 1;

return { 
  merged: { 
    ...mergedData, 
    version: newVersion,
    lastSyncedVersion: cloudVersion 
  }, 
  conflicts 
};
```

### Fix 6: Track What Gets Uploaded

After merge, need to track:
- `version`: New version for this change (incremented)
- `lastSyncedVersion`: Version from cloud we merged with
- `updatedAt`: Current timestamp

This ensures next sync knows:
- What version we're at (`version`)
- What we last synced with cloud (`lastSyncedVersion`)
- When it happened (`updatedAt`)

---

## Root Cause Summary

Your sync is failing because:

1. **`lastSyncedVersion` not properly maintained**
   - Causes: Sync loops, overwrites, lost changes
   
2. **Version comparison logic flawed**
   - Causes: Wrong detection of who changed what
   
3. **Version not incremented after operations**
   - Causes: Changes not recognized by other devices
   
4. **Base field comparison using non-existent data**
   - Causes: False conflict detection

---

## Testing After Fix

### Test 1: Simple Update (Should Work)
```
Device A: Edit entry amount → v2
Device A: Sync → Upload v2
Device B: Sync → Download v2 ✅
```

### Test 2: Concurrent Updates - Different Fields (Should Auto-Merge)
```
Device A: Edit amount → v2, sync
Device B: Edit remarks → v2, sync
Result: v3 with both changes ✅
```

### Test 3: Concurrent Updates - Same Field (Should Detect Conflict)
```
Device A: Edit amount → 500, v2, sync
Device B: Edit amount → 600, v2, sync
Result: Conflict detected, cloud wins (500) ⚠️
```

### Test 4: Delete on One, Edit on Other (Should Detect Conflict)
```
Device A: Delete entry → v2, sync
Device B: Edit entry → v2, sync
Result: Delete-Edit conflict detected ⚠️
```

### Test 5: Delete on Both (Should Auto-Merge)
```
Device A: Delete entry → v2, sync
Device B: Delete entry → v2, sync
Result: Entry deleted, no conflict ✅
```

---

## Next Steps

I'll now implement all these fixes in `gitStyleSync.ts`.
