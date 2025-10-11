# Cloud-First Sync - Known Issues & Edge Cases

## 🚨 Critical Issues (Require Immediate Attention)

### 1. Concurrent Edits - Last Write Wins ⚠️ HIGH RISK

**Problem:** Two users editing the same item simultaneously will result in one user's changes being completely lost.

**Example:**
```
10:00:00 - User A (Phone 1): Changes book name to "Travel 2024"
10:00:01 - User B (Phone 2): Changes same book name to "Vacation 2025"
10:00:02 - User A's upload completes → Cloud has "Travel 2024"
10:00:03 - User B's upload completes → Cloud has "Vacation 2025"
Result: User A's change is permanently lost, no warning given
```

**Impact:**
- Data loss for users
- Confusing user experience ("I just changed that!")
- No audit trail of what was lost

**Solutions:**

**Option A: Optimistic Locking (Recommended)**
```typescript
// Add version number to each entity
interface Book {
  id: string;
  name: string;
  version: number; // Increment on each edit
  updatedAt: Date;
}

// Before upload, check if version matches cloud
const uploadWithConflictCheck = async () => {
  const cloudData = await downloadFromCloud();
  const localBook = getLocalBook();
  const cloudBook = cloudData.books.find(b => b.id === localBook.id);
  
  if (cloudBook.version !== localBook.version) {
    // Conflict detected!
    showConflictResolutionUI(cloudBook, localBook);
  } else {
    // Safe to upload
    localBook.version++;
    uploadToCloud(localBook);
  }
};
```

**Option B: Field-Level Timestamps**
```typescript
interface Book {
  id: string;
  name: string;
  nameUpdatedAt: Date;
  description: string;
  descriptionUpdatedAt: Date;
}

// Merge at field level instead of entity level
const mergeBooks = (cloud, local) => {
  return {
    name: local.nameUpdatedAt > cloud.nameUpdatedAt ? local.name : cloud.name,
    description: local.descriptionUpdatedAt > cloud.descriptionUpdatedAt 
      ? local.description 
      : cloud.description
  };
};
```

**Option C: Lock While Editing**
```typescript
// Use Firestore transaction to lock item
const lockForEditing = async (bookId: string) => {
  const lockRef = doc(firestore, 'locks', bookId);
  await setDoc(lockRef, {
    userId: currentUser.id,
    lockedAt: serverTimestamp(),
    expiresAt: Date.now() + 300000 // 5 minutes
  });
};

// On edit screen mount
useEffect(() => {
  const checkLock = async () => {
    const lock = await getLock(bookId);
    if (lock && lock.userId !== currentUser.id) {
      Alert.alert(
        'Item Locked',
        `${lock.userName} is currently editing this item. Try again later.`
      );
      navigation.goBack();
    }
  };
  checkLock();
}, []);
```

---

### 2. Offline Changes Can Be Lost ⚠️ CRITICAL

**Problem:** When a device goes offline, makes changes, then comes back online, it can overwrite changes made by other devices while it was offline.

**Example:**
```
10:00 - Both phones have Books [A, B, C]
10:01 - Phone 1 goes offline
10:02 - Phone 2 creates Book D, uploads → Cloud has [A, B, C, D]
10:05 - Phone 1 (still offline) deletes Book B locally → Has [A, C]
10:10 - Phone 1 comes back online
10:11 - Phone 1 uploads [A, C] → Cloud now has [A, C]
Result: Book D is lost! Book B is deleted but other phone never knew about it.
```

**Impact:**
- SEVERE data loss
- Unpredictable behavior
- User complaints about missing data

**Current Code Issue:**
```typescript
// In triggerAutoSync() - uploads immediately without downloading first
await syncLocalDataToFirestore(user.id);

// Problem: Doesn't check what changed in cloud while offline
```

**Solution: Download-First Sync Strategy**

```typescript
// Add to AuthContext.tsx
const syncWithOfflineProtection = async (userId: string) => {
  console.log('🔄 Starting safe sync with offline protection...');
  
  // STEP 1: Download latest from cloud first
  console.log('📥 Step 1: Download latest cloud data...');
  const cloudData = await downloadFirestoreData(userId);
  
  // STEP 2: Get local data (with pending changes)
  console.log('📱 Step 2: Get local data...');
  const localBooks = await asyncStorageService.getBooks(userId);
  const localEntries = await getAllLocalEntries(userId);
  const localCategories = await asyncStorageService.getCategories(userId);
  
  // STEP 3: Intelligent merge (preserve both cloud AND local changes)
  console.log('🔀 Step 3: Merge cloud + local changes...');
  const merged = mergeCloudAndLocalChanges(
    cloudData,
    { books: localBooks, entries: localEntries, categories: localCategories }
  );
  
  // STEP 4: Save merged data locally
  console.log('💾 Step 4: Save merged data...');
  await saveDownloadedDataToLocal(userId, merged.books, merged.entries, merged.categories);
  
  // STEP 5: Upload merged data back to cloud
  console.log('📤 Step 5: Upload merged data to cloud...');
  await syncLocalDataToFirestore(userId);
  
  console.log('✅ Safe sync complete');
};

// Replace triggerAutoSync with this safer version
const triggerAutoSync = () => {
  if (!user) return;
  
  if (syncTimeoutRef.current) {
    clearTimeout(syncTimeoutRef.current);
  }
  
  syncTimeoutRef.current = setTimeout(async () => {
    if (user && !isSyncingRef.current) {
      console.log('⏰ Auto-sync triggered - Using safe sync with offline protection');
      
      if (!auth.currentUser) {
        console.error('❌ Auto-sync aborted - No authenticated user');
        return;
      }
      
      try {
        // Use safe sync instead of direct upload
        await syncWithOfflineProtection(user.id);
        console.log('✅ Auto-sync complete');
        setLastSyncTime(new Date());
      } catch (error: any) {
        console.error('❌ Auto-sync failed:', error);
        // ... error handling ...
      }
    }
  }, 2000);
};
```

**Alternative: Offline Change Queue**
```typescript
// Track changes made while offline
interface OfflineChange {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: 'book' | 'entry' | 'category';
  entityId: string;
  data: any;
  timestamp: Date;
}

// Store changes in AsyncStorage
const offlineChanges: OfflineChange[] = [];

// When coming back online, apply changes in order
const applyOfflineChanges = async () => {
  const cloudData = await downloadFromCloud();
  
  for (const change of offlineChanges) {
    if (change.type === 'create') {
      cloudData.books.push(change.data);
    } else if (change.type === 'update') {
      const index = cloudData.books.findIndex(b => b.id === change.entityId);
      cloudData.books[index] = { ...cloudData.books[index], ...change.data };
    } else if (change.type === 'delete') {
      cloudData.books = cloudData.books.filter(b => b.id !== change.entityId);
    }
  }
  
  await uploadToCloud(cloudData);
  offlineChanges.length = 0; // Clear queue
};
```

---

### 3. Race Condition - Changes During Upload ⚠️ HIGH RISK

**Problem:** If user makes changes while a sync is in progress, those changes get overwritten when the listener downloads and replaces local data.

**Example:**
```
00:00 - User creates Book A, B, C locally
00:02 - Auto-sync triggers (2s debounce)
00:03 - Upload starts with [A, B, C]
00:04 - User creates Book D locally (during upload!)
00:05 - Upload completes → Cloud has [A, B, C]
00:06 - Listener triggers (justUploadedRef = true, so skipped)
00:08 - User creates Book E locally
00:10 - Auto-sync triggers again
00:11 - Downloads from cloud → Gets [A, B, C]
00:12 - Replaces local → Book D is gone!
```

**Impact:**
- User's changes disappear silently
- Confusing UX ("Where did my data go?")
- Data loss

**Solution: Lock UI During Sync**

```typescript
// Add sync state to AuthContext
const [isSyncing, setIsSyncing] = useState(false);

// Update all create/update/delete functions
const createBook = async (bookData) => {
  if (isSyncing) {
    Alert.alert(
      'Sync in Progress',
      'Please wait for sync to complete before making changes.',
      [{ text: 'OK' }]
    );
    return { success: false, error: 'Sync in progress' };
  }
  
  // ... normal create logic
};

// Show sync indicator in UI
const SyncStatusBanner = () => {
  const { isSyncing } = useAuth();
  
  if (!isSyncing) return null;
  
  return (
    <View style={styles.syncBanner}>
      <ActivityIndicator size="small" color="#fff" />
      <Text style={styles.syncText}>Syncing... Please wait</Text>
    </View>
  );
};

// Disable buttons during sync
<Button
  title="Create Book"
  disabled={isSyncing}
  onPress={handleCreateBook}
/>
```

**Alternative: Change Buffering**
```typescript
// Buffer changes made during sync
const pendingChanges = useRef<Change[]>([]);

const createBook = async (bookData) => {
  if (isSyncing) {
    // Buffer the change instead of blocking
    pendingChanges.current.push({
      type: 'create',
      entity: 'book',
      data: bookData
    });
    
    // Show toast
    Toast.show('Change will be synced after current sync completes');
    return { success: true, buffered: true };
  }
  
  // Normal create logic
};

// After sync completes, apply buffered changes
const onSyncComplete = async () => {
  setIsSyncing(false);
  
  if (pendingChanges.current.length > 0) {
    console.log(`Applying ${pendingChanges.current.length} buffered changes...`);
    
    for (const change of pendingChanges.current) {
      await applyChange(change);
    }
    
    pendingChanges.current = [];
    
    // Trigger another sync to upload buffered changes
    triggerAutoSync();
  }
};
```

---

## ⚠️ Medium Priority Issues

### 4. Deletion While Viewing ⚠️ MEDIUM RISK

**Problem:** User views a book detail screen on Phone 1. Phone 2 deletes that book. Phone 1's listener triggers and deletes the book locally. Phone 1 crashes or shows "Book not found".

**Solution:**

```typescript
// Add to BookDetailScreen.tsx
useEffect(() => {
  const checkBookExists = async () => {
    const books = await asyncStorageService.getBooks(user.id);
    const bookExists = books.some(b => b.id === bookId);
    
    if (!bookExists) {
      Alert.alert(
        'Book Deleted',
        'This book was deleted from another device.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    }
  };
  
  // Check every 5 seconds while screen is active
  const interval = setInterval(checkBookExists, 5000);
  
  return () => clearInterval(interval);
}, [bookId, user, navigation]);

// Or listen to AuthContext sync events
const { lastSyncTime } = useAuth();

useEffect(() => {
  // Re-validate book exists after each sync
  if (lastSyncTime) {
    checkBookExists();
  }
}, [lastSyncTime]);
```

---

### 5. Firebase Quota & Cost Explosion 💰 MEDIUM RISK

**Problem:** Current implementation downloads entire dataset on every change, causing high Firebase costs.

**Current Usage:**
```
1 user making 50 changes/day:
  - 50 writes (uploads)
  - 50 reads (listener downloads)
  = 100 operations/day

100 users:
  - 5,000 writes/day
  - 5,000 reads/day
  = 10,000 operations/day

Firebase Free Tier: 50,000 reads/day, 20,000 writes/day
You'll hit limits at: ~250 users
```

**Solutions:**

**Option A: Increase Debounce Delay**
```typescript
// Change from 2 seconds to 5 or 10 seconds
syncTimeoutRef.current = setTimeout(async () => {
  // ... sync logic
}, 10000); // 10 seconds instead of 2
```

**Option B: Manual Sync Only**
```typescript
// Remove auto-sync, add manual sync button
<Button
  title="Sync Now"
  onPress={async () => {
    const result = await syncNow();
    Toast.show(result.message);
  }}
/>
```

**Option C: Delta Sync (Recommended for Scale)**
```typescript
// Only download changes since last sync
const deltaSync = async () => {
  const lastSyncTimestamp = await getLastSyncTimestamp();
  
  // Firestore query for changes after lastSync
  const query = firestore()
    .collection('users')
    .doc(userId)
    .collection('books')
    .where('updatedAt', '>', lastSyncTimestamp);
    
  const snapshot = await query.get();
  const changedBooks = snapshot.docs.map(doc => doc.data());
  
  // Merge only changed books, not entire dataset
  const localBooks = await getLocalBooks();
  const merged = mergeChangedBooks(localBooks, changedBooks);
  
  await saveBooks(merged);
};
```

---

### 6. Large Dataset Performance 🐌 MEDIUM RISK

**Problem:** Downloading 2MB+ on every sync is slow and expensive on mobile data.

**Solutions:**

**Option A: Pagination**
```typescript
// Only sync recent data
const syncRecent = async (days = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const query = firestore()
    .collection('entries')
    .where('date', '>', cutoffDate)
    .orderBy('date', 'desc')
    .limit(100);
    
  // Sync only last 30 days, max 100 entries
};
```

**Option B: On-Demand Loading**
```typescript
// Load old data only when user scrolls
const loadMoreEntries = async () => {
  if (hasMore && !loading) {
    const nextPage = await loadEntriesPage(currentPage + 1);
    setEntries([...entries, ...nextPage]);
  }
};
```

**Option C: Wi-Fi Only Sync**
```typescript
// Add setting to sync only on Wi-Fi
const shouldSync = async () => {
  const netInfo = await NetInfo.fetch();
  const wifiOnlySetting = await getWiFiOnlySetting();
  
  if (wifiOnlySetting && netInfo.type !== 'wifi') {
    console.log('Skipping sync - not on Wi-Fi');
    return false;
  }
  
  return true;
};
```

---

## 📋 Testing Checklist

### Critical Tests:
- [ ] Two phones edit same book simultaneously → Verify no data loss
- [ ] Phone goes offline, makes changes, comes online → Verify changes preserved
- [ ] Create book, sync in progress, create another → Verify both books saved
- [ ] View book detail, delete on other phone → Verify graceful handling
- [ ] Make 100 changes rapidly → Verify Firebase quota not exceeded

### Edge Case Tests:
- [ ] Network drops mid-upload → Verify data integrity
- [ ] Token expires during sync → Verify auto-recovery
- [ ] Create/delete/create same item rapidly → Verify final state correct
- [ ] 1000+ entries → Verify acceptable performance
- [ ] Sync on slow 2G connection → Verify timeout handling

---

## 🎯 Recommended Implementation Order

1. **Immediate (This Week):**
   - Add download-before-upload in triggerAutoSync()
   - Add UI lock during sync (disable buttons)
   - Add "Book deleted" detection in detail screens

2. **Short Term (This Month):**
   - Implement version numbers for conflict detection
   - Add offline change queue
   - Increase debounce delay to 5-10 seconds

3. **Medium Term (Next Quarter):**
   - Implement delta sync for large datasets
   - Add pagination for entries
   - Add Wi-Fi only sync option

4. **Long Term (Future):**
   - Field-level timestamps for granular merging
   - Implement Firestore subcollections for better scaling
   - Add change history / audit log

---

**Last Updated:** October 12, 2025  
**Priority:** Critical - Address items 1-3 before production launch  
**Impact:** Data loss prevention + User experience + Cost optimization
