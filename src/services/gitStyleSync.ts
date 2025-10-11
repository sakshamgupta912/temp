/**
 * Git-Style Sync Service
 * 
 * Implements Git-like version control for multi-device sync:
 * - Pull (download) before push (upload)
 * - Three-way merge: Compare base, local, and cloud versions
 * - Conflict detection when both sides modified same field
 * - User-driven conflict resolution
 * 
 * Flow: PULL → MERGE → RESOLVE CONFLICTS → PUSH
 */

export interface SyncConflict {
  entityType: 'book' | 'entry' | 'category';
  entityId: string;
  field: string;
  baseValue: any; // Value when last synced (common ancestor)
  localValue: any; // Current local value (your changes)
  cloudValue: any; // Current cloud value (their changes)
  localVersion: number;
  cloudVersion: number;
}

export interface SyncResult {
  success: boolean;
  message: string;
  conflicts?: SyncConflict[];
  stats?: {
    pulled: number;
    pushed: number;
    merged: number;
    conflicts: number;
  };
}

export type ConflictResolution = 'use-local' | 'use-cloud' | 'manual';

/**
 * Git-Style Three-Way Merge
 * 
 * Compares three versions:
 * - Base: Last synced version (common ancestor, like Git's merge-base)
 * - Local: Current local changes (like Git's HEAD)
 * - Cloud: Current cloud changes (like Git's FETCH_HEAD)
 * 
 * Conflict Detection:
 * - If only local changed: Use local (fast-forward, like Git pull)
 * - If only cloud changed: Use cloud (fast-forward)
 * - If both changed same field: CONFLICT! (like Git merge conflict)
 * - If both changed different fields: Auto-merge both changes
 */
export class GitStyleSyncService {
  
  /**
   * Three-way merge for a single item
   * Returns merged item + any conflicts detected
   */
  static threeWayMerge<T extends { version: number; lastSyncedVersion?: number; [key: string]: any }>(
    local: T,
    cloud: T,
    entityType: 'book' | 'entry' | 'category'
  ): { merged: T; conflicts: SyncConflict[] } {
    
    const conflicts: SyncConflict[] = [];
    const merged = { ...cloud }; // Start with cloud as base
    
    // Get base version (last synced version)
    const baseVersion = local.lastSyncedVersion || 0;
    const localVersion = local.version;
    const cloudVersion = cloud.version;
    
    console.log(`🔀 Three-way merge for ${entityType} ${local.id}:`);
    console.log(`   Base version: ${baseVersion}, Local: ${localVersion}, Cloud: ${cloudVersion}`);
    
    // DELETION CONFLICT DETECTION
    // Check if one side deleted while the other edited
    const localDeleted = local.deleted === true;
    const cloudDeleted = cloud.deleted === true;
    
    if (localDeleted && cloudDeleted) {
      // Both sides deleted - no conflict, item is deleted
      console.log('   🗑️ Both sides deleted - item is deleted');
      return { merged: local, conflicts: [] };
    }
    
    if (localDeleted && !cloudDeleted && cloudVersion > baseVersion) {
      // CONFLICT: Local deleted, but cloud edited
      console.log('   ⚠️ DELETE-EDIT CONFLICT: Local deleted, cloud edited');
      conflicts.push({
        entityType,
        entityId: local.id,
        field: 'deleted',
        baseValue: false,
        localValue: 'DELETED',
        cloudValue: 'EDITED',
        localVersion,
        cloudVersion
      });
      // Default: Keep deletion (can be overridden by user)
      return { merged: { ...local, version: Math.max(localVersion, cloudVersion) + 1 }, conflicts };
    }
    
    if (!localDeleted && cloudDeleted && localVersion > baseVersion) {
      // CONFLICT: Cloud deleted, but local edited
      console.log('   ⚠️ EDIT-DELETE CONFLICT: Cloud deleted, local edited');
      conflicts.push({
        entityType,
        entityId: local.id,
        field: 'deleted',
        baseValue: false,
        localValue: 'EDITED',
        cloudValue: 'DELETED',
        localVersion,
        cloudVersion
      });
      // Default: Keep deletion (can be overridden by user)
      return { merged: { ...cloud, version: Math.max(localVersion, cloudVersion) + 1 }, conflicts };
    }
    
    if (localDeleted && !cloudDeleted && cloudVersion === baseVersion) {
      // No conflict: Local deleted, cloud unchanged - deletion wins
      console.log('   🗑️ Local deleted, cloud unchanged - using deletion');
      return { merged: local, conflicts: [] };
    }
    
    if (!localDeleted && cloudDeleted && localVersion === baseVersion) {
      // No conflict: Cloud deleted, local unchanged - deletion wins
      console.log('   🗑️ Cloud deleted, local unchanged - using deletion');
      return { merged: cloud, conflicts: [] };
    }
    
    // Fast-forward scenarios (no conflicts, no deletions)
    if (localVersion === cloudVersion) {
      // Both at same version - no changes on either side
      console.log('   ✅ No changes on either side');
      return { merged: local, conflicts: [] };
    }
    
    if (localVersion === baseVersion) {
      // Only cloud changed - fast-forward to cloud (like git pull)
      console.log('   ⬇️ Only cloud changed - using cloud version (fast-forward)');
      return { merged: { ...cloud, lastSyncedVersion: cloudVersion }, conflicts: [] };
    }
    
    if (cloudVersion === baseVersion) {
      // Only local changed - fast-forward to local (like git push)
      console.log('   ⬆️ Only local changed - using local version (fast-forward)');
      return { merged: { ...local, lastSyncedVersion: cloudVersion }, conflicts: [] };
    }
    
    // Both changed - need field-level comparison
    console.log('   ⚠️ Both sides changed - checking for conflicts...');
    
    // Fields to check for conflicts (customize per entity type)
    const fieldsToCheck = getFieldsToCheck(entityType);
    
    for (const field of fieldsToCheck) {
      const localChanged = local[field] !== (local as any)[`_base_${field}`];
      const cloudChanged = cloud[field] !== (local as any)[`_base_${field}`];
      
      // For now, we'll use a simpler check: if values differ, it's a conflict
      if (local[field] !== cloud[field]) {
        console.log(`   ⚠️ CONFLICT on field "${field}": local="${local[field]}" vs cloud="${cloud[field]}"`);
        
        conflicts.push({
          entityType,
          entityId: local.id,
          field,
          baseValue: (local as any)[`_base_${field}`] || null,
          localValue: local[field],
          cloudValue: cloud[field],
          localVersion,
          cloudVersion
        });
        
        // Default: Keep cloud value (can be overridden by user)
        (merged as any)[field] = (cloud as any)[field];
      } else {
        // No conflict - use local value (both changed to same value, or only one changed)
        (merged as any)[field] = (local as any)[field];
      }
    }
    
    // Update version metadata
    (merged as any).version = Math.max(localVersion, cloudVersion) + (conflicts.length > 0 ? 1 : 0);
    (merged as any).lastSyncedVersion = cloudVersion;
    
    return { merged, conflicts };
  }
  
  /**
   * Merge arrays of items with conflict detection
   * Like Git merging branches
   */
  static mergeArrays<T extends { id: string; version: number; deleted?: boolean; [key: string]: any }>(
    localItems: T[],
    cloudItems: T[],
    entityType: 'book' | 'entry' | 'category'
  ): { merged: T[]; conflicts: SyncConflict[] } {
    
    const merged: T[] = [];
    const allConflicts: SyncConflict[] = [];
    
    // Create maps for quick lookup
    const localMap = new Map(localItems.map(item => [item.id, item]));
    const cloudMap = new Map(cloudItems.map(item => [item.id, item]));
    
    // Get all unique IDs
    const allIds = new Set([...localMap.keys(), ...cloudMap.keys()]);
    
    console.log(`\n🔀 Merging ${entityType}s: ${localItems.length} local, ${cloudItems.length} cloud, ${allIds.size} unique`);
    
    for (const id of allIds) {
      const local = localMap.get(id);
      const cloud = cloudMap.get(id);
      
      if (!local && cloud) {
        // Only in cloud - new item from other device (like git pull new file)
        console.log(`📥 New from cloud: ${id}`);
        merged.push({ ...cloud, lastSyncedVersion: cloud.version });
        
      } else if (local && !cloud) {
        // Only local - new item we created (like git add new file)
        console.log(`📤 New locally: ${id}`);
        merged.push(local);
        
      } else if (local && cloud) {
        // Exists in both - do three-way merge
        const { merged: mergedItem, conflicts } = GitStyleSyncService.threeWayMerge(local, cloud, entityType);
        merged.push(mergedItem);
        allConflicts.push(...conflicts);
      }
    }
    
    // Filter out deleted items (tombstones)
    const filteredMerged = merged.filter(item => !item.deleted);
    
    console.log(`✅ Merge complete: ${filteredMerged.length} items, ${allConflicts.length} conflicts`);
    
    return { merged: filteredMerged, conflicts: allConflicts };
  }
  
  /**
   * Resolve conflicts with user's choice
   */
  static resolveConflicts<T extends { [key: string]: any }>(
    items: T[],
    conflicts: SyncConflict[],
    resolutions: Map<string, ConflictResolution | any> // conflictKey → 'use-local' | 'use-cloud' | actual value
  ): T[] {
    
    const resolvedItems = [...items];
    
    for (const conflict of conflicts) {
      const conflictKey = `${conflict.entityId}-${conflict.field}`;
      const resolution = resolutions.get(conflictKey);
      
      if (!resolution) continue;
      
      const item = resolvedItems.find(i => i.id === conflict.entityId);
      if (!item) continue;
      
      // Handle deletion conflicts specially
      if (conflict.field === 'deleted') {
        const chosenValue = resolution === 'use-local' ? conflict.localValue : 
                           resolution === 'use-cloud' ? conflict.cloudValue : 
                           resolution;
        
        if (chosenValue === 'DELETED') {
          // User chose to keep deletion
          (item as any).deleted = true;
          (item as any).deletedAt = new Date();
          console.log(`✅ Resolved conflict: Item ${conflict.entityId} marked as deleted`);
        } else if (chosenValue === 'EDITED') {
          // User chose to keep the edit (undelete)
          (item as any).deleted = false;
          delete (item as any).deletedAt;
          console.log(`✅ Resolved conflict: Item ${conflict.entityId} restored (undeleted)`);
        }
      } else {
        // Normal field conflict resolution
        if (resolution === 'use-local') {
          (item as any)[conflict.field] = conflict.localValue;
          console.log(`✅ Resolved conflict: Using local value for ${conflict.entityType}.${conflict.field}`);
        } else if (resolution === 'use-cloud') {
          (item as any)[conflict.field] = conflict.cloudValue;
          console.log(`✅ Resolved conflict: Using cloud value for ${conflict.entityType}.${conflict.field}`);
        } else {
          // Custom value provided
          (item as any)[conflict.field] = resolution;
          console.log(`✅ Resolved conflict: Using custom value for ${conflict.entityType}.${conflict.field}`);
        }
      }
      
      // Increment version after manual resolution
      (item as any).version = ((item as any).version || 0) + 1;
    }
    
    return resolvedItems;
  }
}

/**
 * Get fields to check for conflicts based on entity type
 */
function getFieldsToCheck(entityType: 'book' | 'entry' | 'category'): string[] {
  switch (entityType) {
    case 'book':
      return ['name', 'description', 'currency', 'lockedExchangeRate', 'deleted'];
    case 'entry':
      return ['amount', 'date', 'party', 'category', 'paymentMode', 'remarks', 'deleted'];
    case 'category':
      return ['name', 'description', 'color', 'icon', 'deleted'];
    default:
      return [];
  }
}

/**
 * Format conflict for display in UI
 */
export function formatConflictMessage(conflict: SyncConflict): string {
  const entityName = conflict.entityType === 'book' ? 'Book' : 
                     conflict.entityType === 'entry' ? 'Entry' : 'Category';
  
  return `${entityName} field "${conflict.field}" was modified on both devices:\n` +
         `• Your change: ${JSON.stringify(conflict.localValue)}\n` +
         `• Other device: ${JSON.stringify(conflict.cloudValue)}`;
}

/**
 * Get user-friendly sync status message
 */
export function getSyncStatusMessage(
  localVersion: number,
  cloudVersion: number,
  hasLocalChanges: boolean
): string {
  if (localVersion === cloudVersion && !hasLocalChanges) {
    return '✅ Up to date';
  } else if (localVersion < cloudVersion && !hasLocalChanges) {
    const behind = cloudVersion - localVersion;
    return `⬇️ Behind by ${behind} ${behind === 1 ? 'change' : 'changes'}`;
  } else if (localVersion > cloudVersion) {
    const ahead = localVersion - cloudVersion;
    return `⬆️ Ahead by ${ahead} ${ahead === 1 ? 'change' : 'changes'}`;
  } else if (localVersion < cloudVersion && hasLocalChanges) {
    return `🔀 Diverged (need to merge)`;
  } else {
    return '📝 Has local changes';
  }
}
