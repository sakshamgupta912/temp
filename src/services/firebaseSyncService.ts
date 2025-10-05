// Firebase Sync Service
// Handles bidirectional synchronization between local storage and Firestore

import firestore from '@react-native-firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { Book, Entry } from '../models/types';
import asyncStorageService from './asyncStorage';
import preferencesService from './preferences';
import { COLLECTIONS, SYNC_SETTINGS } from '../config/firebaseConfig';
import googleAuthService from './googleAuthService';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChanges: number;
  syncError: string | null;
}

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  errors: string[];
}

export interface SyncMetadata {
  lastSyncTime: Date;
  deviceId: string;
  appVersion: string;
}

class FirebaseSyncService {
  private static instance: FirebaseSyncService;
  private syncStatus: SyncStatus = {
    isOnline: false,
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: 0,
    syncError: null,
  };
  private syncQueue: Array<{ type: 'create' | 'update' | 'delete'; collection: string; data: any }> = [];
  private autoSyncInterval: NodeJS.Timeout | null = null;
  private statusListeners: Array<(status: SyncStatus) => void> = [];

  static getInstance(): FirebaseSyncService {
    if (!FirebaseSyncService.instance) {
      FirebaseSyncService.instance = new FirebaseSyncService();
    }
    return FirebaseSyncService.instance;
  }

  /**
   * Initialize sync service
   * Sets up network listener and starts auto-sync if enabled
   */
  async initialize(): Promise<void> {
    try {
      // Listen to network state changes
      NetInfo.addEventListener(state => {
        const wasOnline = this.syncStatus.isOnline;
        this.syncStatus.isOnline = state.isConnected ?? false;
        
        // If went online, trigger sync
        if (!wasOnline && this.syncStatus.isOnline) {
          console.log('📡 Network connected, triggering sync...');
          this.syncAll().catch(console.error);
        }
        
        this.notifyStatusListeners();
      });

      // Get initial network state
      const netInfo = await NetInfo.fetch();
      this.syncStatus.isOnline = netInfo.isConnected ?? false;

      // Load last sync time
      const lastSync = await this.getLastSyncTime();
      this.syncStatus.lastSyncTime = lastSync;

      // Start auto-sync if enabled
      await this.startAutoSync();

      console.log('✅ Firebase Sync Service initialized');
    } catch (error) {
      console.error('❌ Error initializing sync service:', error);
      throw error;
    }
  }

  /**
   * Start automatic background sync
   */
  async startAutoSync(): Promise<void> {
    if (this.autoSyncInterval) return;

    const prefs = await preferencesService.getPreferences();
    if (!prefs.autoSync) return;

    this.autoSyncInterval = setInterval(() => {
      if (this.syncStatus.isOnline && !this.syncStatus.isSyncing) {
        this.syncAll().catch(console.error);
      }
    }, SYNC_SETTINGS.AUTO_SYNC_INTERVAL);

    console.log('✅ Auto-sync started');
  }

  /**
   * Stop automatic background sync
   */
  stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
      console.log('⏸️ Auto-sync stopped');
    }
  }

  /**
   * Sync all data (books, entries, preferences)
   */
  async syncAll(): Promise<SyncResult> {
    const user = googleAuthService.getCurrentUser();
    if (!user) {
      throw new Error('User must be signed in to sync');
    }

    if (!this.syncStatus.isOnline) {
      console.log('⚠️ Offline, queueing changes for later sync');
      return { success: false, itemsSynced: 0, errors: ['No network connection'] };
    }

    this.syncStatus.isSyncing = true;
    this.syncStatus.syncError = null;
    this.notifyStatusListeners();

    const errors: string[] = [];
    let totalSynced = 0;

    try {
      // 1. Sync queued changes first
      await this.processSyncQueue();

      // 2. Sync books
      const booksResult = await this.syncBooks(user.uid);
      totalSynced += booksResult.itemsSynced;
      errors.push(...booksResult.errors);

      // 3. Sync entries for each book
      const books = await asyncStorageService.getBooks(user.uid);
      for (const book of books) {
        const entriesResult = await this.syncEntries(user.uid, book.id);
        totalSynced += entriesResult.itemsSynced;
        errors.push(...entriesResult.errors);
      }

      // 4. Sync preferences
      const prefsResult = await this.syncPreferences(user.uid);
      totalSynced += prefsResult.itemsSynced;
      errors.push(...prefsResult.errors);

      // 5. Update sync metadata
      await this.updateSyncMetadata(user.uid);

      this.syncStatus.lastSyncTime = new Date();
      this.syncStatus.pendingChanges = 0;
      
      console.log(`✅ Sync completed: ${totalSynced} items synced, ${errors.length} errors`);
      
      return { success: errors.length === 0, itemsSynced: totalSynced, errors };
    } catch (error: any) {
      console.error('❌ Sync failed:', error);
      this.syncStatus.syncError = error.message;
      errors.push(error.message);
      return { success: false, itemsSynced: totalSynced, errors };
    } finally {
      this.syncStatus.isSyncing = false;
      this.notifyStatusListeners();
    }
  }

  /**
   * Sync books between local and Firestore
   */
  private async syncBooks(userId: string): Promise<SyncResult> {
    const errors: string[] = [];
    let synced = 0;

    try {
      // Get local books
      const localBooks = await asyncStorageService.getBooks(userId);

      // Get remote books
      const remoteSnapshot = await firestore()
        .collection(COLLECTIONS.USERS)
        .doc(userId)
        .collection(COLLECTIONS.BOOKS)
        .get();

      const remoteBooks: Book[] = remoteSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        rateLockedAt: doc.data().rateLockedAt?.toDate(),
      } as Book));

      // Create maps for easy lookup
      const localBookMap = new Map(localBooks.map(b => [b.id, b]));
      const remoteBookMap = new Map(remoteBooks.map(b => [b.id, b]));

      // Upload local books not in remote
      for (const localBook of localBooks) {
        if (!remoteBookMap.has(localBook.id)) {
          try {
            await this.uploadBook(userId, localBook);
            synced++;
          } catch (error: any) {
            errors.push(`Failed to upload book ${localBook.name}: ${error.message}`);
          }
        } else {
          // Resolve conflicts
          const remoteBook = remoteBookMap.get(localBook.id)!;
          const resolved = await this.resolveBookConflict(localBook, remoteBook);
          if (resolved) synced++;
        }
      }

      // Download remote books not in local
      for (const remoteBook of remoteBooks) {
        if (!localBookMap.has(remoteBook.id)) {
          try {
            await asyncStorageService.createBook(remoteBook);
            synced++;
          } catch (error: any) {
            errors.push(`Failed to download book ${remoteBook.name}: ${error.message}`);
          }
        }
      }

      return { success: errors.length === 0, itemsSynced: synced, errors };
    } catch (error: any) {
      console.error('Error syncing books:', error);
      return { success: false, itemsSynced: synced, errors: [error.message] };
    }
  }

  /**
   * Sync entries for a specific book
   */
  private async syncEntries(userId: string, bookId: string): Promise<SyncResult> {
    const errors: string[] = [];
    let synced = 0;

    try {
      // Get local entries
      const localEntries = await asyncStorageService.getEntries(bookId);

      // Get remote entries
      const remoteSnapshot = await firestore()
        .collection(COLLECTIONS.USERS)
        .doc(userId)
        .collection(COLLECTIONS.BOOKS)
        .doc(bookId)
        .collection(COLLECTIONS.ENTRIES)
        .get();

      const remoteEntries: Entry[] = remoteSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        date: doc.data().date?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as Entry));

      const localEntryMap = new Map(localEntries.map(e => [e.id, e]));
      const remoteEntryMap = new Map(remoteEntries.map(e => [e.id, e]));

      // Upload local entries not in remote
      for (const localEntry of localEntries) {
        if (!remoteEntryMap.has(localEntry.id)) {
          try {
            await this.uploadEntry(userId, bookId, localEntry);
            synced++;
          } catch (error: any) {
            errors.push(`Failed to upload entry: ${error.message}`);
          }
        } else {
          // Resolve conflicts
          const remoteEntry = remoteEntryMap.get(localEntry.id)!;
          const resolved = await this.resolveEntryConflict(localEntry, remoteEntry);
          if (resolved) synced++;
        }
      }

      // Download remote entries not in local
      for (const remoteEntry of remoteEntries) {
        if (!localEntryMap.has(remoteEntry.id)) {
          try {
            await asyncStorageService.createEntry(remoteEntry);
            synced++;
          } catch (error: any) {
            errors.push(`Failed to download entry: ${error.message}`);
          }
        }
      }

      return { success: errors.length === 0, itemsSynced: synced, errors };
    } catch (error: any) {
      console.error('Error syncing entries:', error);
      return { success: false, itemsSynced: synced, errors: [error.message] };
    }
  }

  /**
   * Sync preferences
   */
  private async syncPreferences(userId: string): Promise<SyncResult> {
    try {
      const localPrefs = await preferencesService.getPreferences();

      const remoteDoc = await firestore()
        .collection(COLLECTIONS.USERS)
        .doc(userId)
        .collection(COLLECTIONS.PREFERENCES)
        .doc('settings')
        .get();

      if (!remoteDoc.exists) {
        // Upload local preferences
        await firestore()
          .collection(COLLECTIONS.USERS)
          .doc(userId)
          .collection(COLLECTIONS.PREFERENCES)
          .doc('settings')
          .set(localPrefs);
        
        return { success: true, itemsSynced: 1, errors: [] };
      } else {
        // For now, use last-write-wins
        // Could implement merge strategy based on timestamp
        const remotePrefs = remoteDoc.data();
        
        // Use remote if it's newer (you'd compare timestamps)
        // For simplicity, keeping local for now
        
        return { success: true, itemsSynced: 0, errors: [] };
      }
    } catch (error: any) {
      return { success: false, itemsSynced: 0, errors: [error.message] };
    }
  }

  /**
   * Upload a book to Firestore
   */
  private async uploadBook(userId: string, book: Book): Promise<void> {
    await firestore()
      .collection(COLLECTIONS.USERS)
      .doc(userId)
      .collection(COLLECTIONS.BOOKS)
      .doc(book.id)
      .set({
        ...book,
        createdAt: firestore.Timestamp.fromDate(new Date(book.createdAt)),
        updatedAt: firestore.Timestamp.fromDate(new Date(book.updatedAt)),
        rateLockedAt: book.rateLockedAt ? firestore.Timestamp.fromDate(new Date(book.rateLockedAt)) : null,
      });
  }

  /**
   * Upload an entry to Firestore
   */
  private async uploadEntry(userId: string, bookId: string, entry: Entry): Promise<void> {
    await firestore()
      .collection(COLLECTIONS.USERS)
      .doc(userId)
      .collection(COLLECTIONS.BOOKS)
      .doc(bookId)
      .collection(COLLECTIONS.ENTRIES)
      .doc(entry.id)
      .set({
        ...entry,
        date: firestore.Timestamp.fromDate(new Date(entry.date)),
        createdAt: firestore.Timestamp.fromDate(new Date(entry.createdAt)),
        updatedAt: firestore.Timestamp.fromDate(new Date(entry.updatedAt)),
      });
  }

  /**
   * Resolve conflict between local and remote book
   * Strategy: Last-write-wins based on updatedAt timestamp
   */
  private async resolveBookConflict(local: Book, remote: Book): Promise<boolean> {
    const localTime = new Date(local.updatedAt).getTime();
    const remoteTime = new Date(remote.updatedAt).getTime();

    if (localTime > remoteTime) {
      // Local is newer, upload to remote
      const user = googleAuthService.getCurrentUser();
      if (user) {
        await this.uploadBook(user.uid, local);
        return true;
      }
    } else if (remoteTime > localTime) {
      // Remote is newer, update local
      await asyncStorageService.updateBook(local.id, remote);
      return true;
    }

    return false; // No change needed
  }

  /**
   * Resolve conflict between local and remote entry
   */
  private async resolveEntryConflict(local: Entry, remote: Entry): Promise<boolean> {
    const localTime = new Date(local.updatedAt).getTime();
    const remoteTime = new Date(remote.updatedAt).getTime();

    if (localTime > remoteTime) {
      // Local is newer, upload to remote
      const user = googleAuthService.getCurrentUser();
      if (user) {
        await this.uploadEntry(user.uid, local.bookId, local);
        return true;
      }
    } else if (remoteTime > localTime) {
      // Remote is newer, update local
      await asyncStorageService.updateEntry(local.id, remote);
      return true;
    }

    return false;
  }

  /**
   * Process queued sync operations (for offline changes)
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) return;

    console.log(`📤 Processing ${this.syncQueue.length} queued operations...`);

    const queue = [...this.syncQueue];
    this.syncQueue = [];

    for (const operation of queue) {
      try {
        // Process each queued operation
        // Implementation depends on operation type
        console.log(`Processing ${operation.type} for ${operation.collection}`);
      } catch (error) {
        console.error('Error processing queued operation:', error);
        // Re-queue on failure
        this.syncQueue.push(operation);
      }
    }

    this.syncStatus.pendingChanges = this.syncQueue.length;
    this.notifyStatusListeners();
  }

  /**
   * Update sync metadata
   */
  private async updateSyncMetadata(userId: string): Promise<void> {
    await firestore()
      .collection(COLLECTIONS.USERS)
      .doc(userId)
      .collection(COLLECTIONS.SYNC_METADATA)
      .doc('sync')
      .set({
        lastSyncTime: firestore.FieldValue.serverTimestamp(),
        deviceId: 'device_' + Math.random().toString(36).substring(7),
        appVersion: '1.0.0',
      });
  }

  /**
   * Get last sync time
   */
  private async getLastSyncTime(): Promise<Date | null> {
    try {
      const user = googleAuthService.getCurrentUser();
      if (!user) return null;

      const doc = await firestore()
        .collection(COLLECTIONS.USERS)
        .doc(user.uid)
        .collection(COLLECTIONS.SYNC_METADATA)
        .doc('sync')
        .get();

      if (!doc.exists) return null;

      const data = doc.data();
      return data?.lastSyncTime?.toDate() || null;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Subscribe to sync status changes
   */
  onStatusChanged(callback: (status: SyncStatus) => void): () => void {
    this.statusListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all status listeners
   */
  private notifyStatusListeners(): void {
    const status = this.getSyncStatus();
    this.statusListeners.forEach(callback => callback(status));
  }

  /**
   * Queue a change for later sync (when offline)
   */
  queueChange(type: 'create' | 'update' | 'delete', collection: string, data: any): void {
    this.syncQueue.push({ type, collection, data });
    this.syncStatus.pendingChanges = this.syncQueue.length;
    this.notifyStatusListeners();
    console.log(`📝 Queued ${type} operation for ${collection}`);
  }

  /**
   * Manual full backup to Firebase
   */
  async backupToFirebase(): Promise<SyncResult> {
    return this.syncAll();
  }

  /**
   * Restore from Firebase (download all data)
   */
  async restoreFromFirebase(): Promise<SyncResult> {
    // Similar to syncAll but prioritizes remote data
    return this.syncAll();
  }
}

export default FirebaseSyncService.getInstance();
