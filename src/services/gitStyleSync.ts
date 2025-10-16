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
 * Helper: Deep comparison of values (handles Dates, objects, primitives)
 */
function areValuesEqual(value1: any, value2: any): boolean {
  // Handle null/undefined
  if (value1 === value2) return true;
  if (value1 == null || value2 == null) return false;
  
  // Handle Date objects
  if (value1 instanceof Date && value2 instanceof Date) {
    return value1.getTime() === value2.getTime();
  }
  
  // Handle string dates (ISO format)
  if (typeof value1 === 'string' && typeof value2 === 'string') {
    // Try parsing as dates
    const date1 = new Date(value1);
    const date2 = new Date(value2);
    if (!isNaN(date1.getTime()) && !isNaN(date2.getTime())) {
      return date1.getTime() === date2.getTime();
    }
  }
  
  // Handle arrays
  if (Array.isArray(value1) && Array.isArray(value2)) {
    if (value1.length !== value2.length) return false;
    return value1.every((item, index) => areValuesEqual(item, value2[index]));
  }
  
  // Handle objects
  if (typeof value1 === 'object' && typeof value2 === 'object') {
    const keys1 = Object.keys(value1);
    const keys2 = Object.keys(value2);
    if (keys1.length !== keys2.length) return false;
    return keys1.every(key => areValuesEqual(value1[key], value2[key]));
  }
  
  // Primitive comparison
  return value1 === value2;
}

/**
 * Helper: Format value for logging
 */
function formatValueForLog(value: any): string {
  if (value === null || value === undefined) return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

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
    
    // Get versions
    const localVersion = local.version;
    const cloudVersion = cloud.version;
    
    // Base version: Use lastSyncedVersion if available, otherwise version
    // This represents the "common ancestor" in Git terms
    const localBaseVersion = local.lastSyncedVersion || 0;
    const cloudBaseVersion = cloud.lastSyncedVersion || 0;
    const baseVersion = Math.max(localBaseVersion, cloudBaseVersion);
    
    console.log(`🔀 Three-way merge for ${entityType} ${local.id}:`);
    console.log(`   Base: ${baseVersion}, Local: v${localVersion} (base: ${localBaseVersion}), Cloud: v${cloudVersion} (base: ${cloudBaseVersion})`);
    
    // DELETION CONFLICT DETECTION
    const localDeleted = local.deleted === true;
    const cloudDeleted = cloud.deleted === true;
    
    if (localDeleted && cloudDeleted) {
      // Both sides deleted - no conflict
      console.log('   🗑️ Both deleted - using deletion');
      return { 
        merged: { 
          ...local, 
          version: Math.max(localVersion, cloudVersion) + 1,
          lastSyncedVersion: cloudVersion 
        }, 
        conflicts: [] 
      };
    }
    
    if (localDeleted && !cloudDeleted) {
      if (cloudVersion > localBaseVersion) {
        // CONFLICT: Local deleted, but cloud edited since we last synced
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
        // Default: Keep deletion
        return { 
          merged: { 
            ...local, 
            version: Math.max(localVersion, cloudVersion) + 1,
            lastSyncedVersion: cloudVersion 
          }, 
          conflicts 
        };
      } else {
        // No conflict: Local deleted, cloud unchanged
        console.log('   🗑️ Local deleted, cloud unchanged - using deletion');
        return { 
          merged: { 
            ...local, 
            version: Math.max(localVersion, cloudVersion) + 1,
            lastSyncedVersion: cloudVersion 
          }, 
          conflicts: [] 
        };
      }
    }
    
    if (!localDeleted && cloudDeleted) {
      if (localVersion > cloudBaseVersion) {
        // CONFLICT: Cloud deleted, but local edited since cloud last synced
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
        // Default: Keep deletion
        return { 
          merged: { 
            ...cloud, 
            version: Math.max(localVersion, cloudVersion) + 1,
            lastSyncedVersion: cloudVersion 
          }, 
          conflicts 
        };
      } else {
        // No conflict: Cloud deleted, local unchanged
        console.log('   🗑️ Cloud deleted, local unchanged - using deletion');
        return { 
          merged: { 
            ...cloud, 
            version: Math.max(localVersion, cloudVersion) + 1,
            lastSyncedVersion: cloudVersion 
          }, 
          conflicts: [] 
        };
      }
    }
    
    // Determine if changes were made
    const localChanged = localVersion > localBaseVersion;
    const cloudChanged = cloudVersion > cloudBaseVersion;
    
    // Fast-forward scenarios
    if (!localChanged && !cloudChanged) {
      // Neither changed
      console.log('   ✅ No changes on either side');
      return { 
        merged: { 
          ...local, 
          lastSyncedVersion: cloudVersion 
        }, 
        conflicts: [] 
      };
    }
    
    if (!localChanged && cloudChanged) {
      // Only cloud changed - fast-forward to cloud
      console.log('   ⬇️ Only cloud changed - fast-forward to cloud');
      return { 
        merged: { 
          ...cloud, 
          lastSyncedVersion: cloudVersion 
        }, 
        conflicts: [] 
      };
    }
    
    if (localChanged && !cloudChanged) {
      // Only local changed - keep local, will push to cloud
      console.log('   ⬆️ Only local changed - keeping local (will push)');
      return { 
        merged: { 
          ...local, 
          lastSyncedVersion: cloudVersion 
        }, 
        conflicts: [] 
      };
    }
    
    // Both changed - need field-level comparison
    console.log('   ⚠️ Both sides changed - checking fields for conflicts...');
    
    // Fields to check for conflicts
    const fieldsToCheck = getFieldsToCheck(entityType);
    
    // Field-level conflict detection
    for (const field of fieldsToCheck) {
      const localValue = local[field];
      const cloudValue = cloud[field];
      
      // Deep comparison for values (handles Dates, objects, primitives)
      const valuesAreDifferent = !areValuesEqual(localValue, cloudValue);
      
      if (valuesAreDifferent) {
        // Values differ - this is a conflict
        console.log(`   ⚠️ CONFLICT on "${field}": local="${formatValueForLog(localValue)}" (v${localVersion}) vs cloud="${formatValueForLog(cloudValue)}" (v${cloudVersion})`);
        
        conflicts.push({
          entityType,
          entityId: local.id,
          field,
          baseValue: null, // We don't track base values per field currently
          localValue,
          cloudValue,
          localVersion,
          cloudVersion
        });
        
        // CRITICAL FIX: Use the value from the newer version
        // This is like Git's "ours" vs "theirs" - we take the version with more recent changes
        if (localVersion > cloudVersion) {
          console.log(`   ✅ Resolving conflict: Using LOCAL (newer version ${localVersion})`);
          (merged as any)[field] = localValue;
        } else if (cloudVersion > localVersion) {
          console.log(`   ✅ Resolving conflict: Using CLOUD (newer version ${cloudVersion})`);
          (merged as any)[field] = cloudValue;
        } else {
          // Same version but different values - should not happen, but default to local
          console.log(`   ⚠️ Same version but different values - defaulting to LOCAL`);
          (merged as any)[field] = localValue;
        }
      } else {
        // Values match - use either (both same)
        (merged as any)[field] = localValue;
      }
    }
    
    // Update version metadata
    // ALWAYS increment version after merge to indicate merge happened
    const newVersion = Math.max(localVersion, cloudVersion) + 1;
    (merged as any).version = newVersion;
    (merged as any).lastSyncedVersion = cloudVersion;
    (merged as any).updatedAt = new Date();
    
    if (conflicts.length > 0) {
      console.log(`   ⚠️ ${conflicts.length} conflicts detected - using cloud values by default`);
    } else {
      console.log(`   ✅ Auto-merged - no conflicts`);
    }
    
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
    
    // Keep deleted items (tombstones) so they can be synced to cloud
    // Other devices need to know about deletions!
    // Filtering deleted items happens when displaying to users, not during sync
    const deletedCount = merged.filter(item => item.deleted).length;
    
    console.log(`✅ Merge complete: ${merged.length} items (${deletedCount} deleted tombstones), ${allConflicts.length} conflicts`);
    
    return { merged, conflicts: allConflicts };
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
      return ['name', 'description', 'currency', 'lockedExchangeRate', 'deleted', 'archived', 'archivedAt'];
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
