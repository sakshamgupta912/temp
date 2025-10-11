// Firebase Sync Service for Expo
// Handles bidirectional synchronization between local storage and Firestore

import { firestore } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import asyncStorageService from './asyncStorage';
import preferencesService from './preferences';
import { Book, Entry, User } from '../models/types';

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: Date | null;
  isSyncing: boolean;
  pendingChanges: number;
  error: string | null;
}

export interface SyncResult {
  success: boolean;
  message: string;
  syncedBooks: number;
  syncedEntries: number;
  errors: string[];
}

class FirebaseSyncService {
  private static instance: FirebaseSyncService;
  private syncStatusListeners: Array<(status: SyncStatus) => void> = [];
  private isOnline = true;
  private isSyncing = false;
  private lastSyncTime: Date | null = null;
  private pendingChanges = 0;
  private currentError: string | null = null;
  private autoSyncInterval: NodeJS.Timeout | null = null;

  static getInstance(): FirebaseSyncService {
    if (!FirebaseSyncService.instance) {
      FirebaseSyncService.instance = new FirebaseSyncService();
    }
    return FirebaseSyncService.instance;
  }

  /**
   * Initialize sync service with network monitoring
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing Firebase Sync Service...');
      
      // Monitor network connectivity
      NetInfo.addEventListener((state: any) => {
        const wasOnline = this.isOnline;
        this.isOnline = state.isConnected ?? false;
        
        if (!wasOnline && this.isOnline) {
          console.log('📡 Back online - resuming sync');
          this.processPendingChanges();
        } else if (wasOnline && !this.isOnline) {
          console.log('📵 Gone offline - queuing changes');
        }
        
        this.notifyStatusChange();
      });

      // Start auto-sync if enabled
      await this.startAutoSync();
      
      console.log('✅ Firebase Sync Service initialized');
    } catch (error: any) {
      console.error('❌ Sync service initialization failed:', error);
      this.currentError = error.message;
      this.notifyStatusChange();
    }
  }

  /**
   * Start automatic synchronization
   */
  async startAutoSync(): Promise<void> {
    const prefs = await preferencesService.getPreferences();
    if (!prefs.autoSync) return;

    // Clear existing interval
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }

    // Set up auto-sync every 5 minutes
    this.autoSyncInterval = setInterval(async () => {
      if (this.isOnline && !this.isSyncing) {
        await this.syncAll();
      }
    }, 5 * 60 * 1000); // 5 minutes

    console.log('⏰ Auto-sync enabled (5 minute intervals)');
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
      console.log('⏹️ Auto-sync disabled');
    }
  }

  /**
   * Perform complete bidirectional sync
   */
  async syncAll(userId?: string): Promise<SyncResult> {
    if (!userId) {
      const user = await asyncStorageService.getCurrentUser();
      if (!user) {
        return { 
          success: false, 
          message: 'No user logged in', 
          syncedBooks: 0, 
          syncedEntries: 0, 
          errors: ['User not authenticated'] 
        };
      }
      userId = user.id;
    }

    if (!this.isOnline) {
      return { 
        success: false, 
        message: 'Device is offline', 
        syncedBooks: 0, 
        syncedEntries: 0, 
        errors: ['No internet connection'] 
      };
    }

    const startTime = Date.now();
    this.isSyncing = true;
    this.currentError = null;
    this.notifyStatusChange();

    try {
      console.log('🔄 Starting full sync for user:', userId);

      const bookResult = await this.syncBooks(userId);
      const entryResult = await this.syncEntries(userId);

      const totalBooks = bookResult.syncedBooks;
      const totalEntries = entryResult.syncedEntries;
      const allErrors = [...bookResult.errors, ...entryResult.errors];

      this.lastSyncTime = new Date();
      this.pendingChanges = 0;

      const duration = Date.now() - startTime;
      console.log(`✅ Sync completed in ${duration}ms - Books: ${totalBooks}, Entries: ${totalEntries}`);

      return {
        success: allErrors.length === 0,
        message: allErrors.length === 0 
          ? `Synced ${totalBooks} books and ${totalEntries} entries` 
          : `Synced with ${allErrors.length} errors`,
        syncedBooks: totalBooks,
        syncedEntries: totalEntries,
        errors: allErrors
      };

    } catch (error: any) {
      console.error('❌ Sync failed:', error);
      this.currentError = error.message;
      
      return { 
        success: false, 
        message: 'Sync failed', 
        syncedBooks: 0, 
        syncedEntries: 0, 
        errors: [error.message] 
      };
    } finally {
      this.isSyncing = false;
      this.notifyStatusChange();
    }
  }

  /**
   * Sync books between local and remote
   */
  private async syncBooks(userId: string): Promise<{ syncedBooks: number; errors: string[] }> {
    const errors: string[] = [];
    let syncedBooks = 0;

    try {
      // Get local books
      const localBooks = await asyncStorageService.getBooks();
      
      // Get remote books
      const booksRef = collection(firestore, 'books');
      const booksQuery = query(booksRef, where('userId', '==', userId));
      const remoteSnapshot = await getDocs(booksQuery);
      
      const remoteBooks: Book[] = remoteSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      }));

      // Create maps for easier comparison
      const localBookMap = new Map(localBooks.map(book => [book.id, book]));
      const remoteBookMap = new Map(remoteBooks.map(book => [book.id, book]));

      // Sync local -> remote (upload new/updated local books)
      for (const localBook of localBooks) {
        try {
          const remoteBook = remoteBookMap.get(localBook.id);
          
          if (!remoteBook || localBook.updatedAt > remoteBook.updatedAt) {
            // Upload to Firestore
            const bookRef = doc(firestore, 'books', localBook.id);
            await setDoc(bookRef, {
              ...localBook,
              userId,
              createdAt: Timestamp.fromDate(localBook.createdAt),
              updatedAt: serverTimestamp(),
            });
            syncedBooks++;
            console.log(`📤 Uploaded book: ${localBook.name}`);
          }
        } catch (error: any) {
          errors.push(`Failed to upload book ${localBook.name}: ${error.message}`);
        }
      }

      // Sync remote -> local (download new/updated remote books)
      for (const remoteBook of remoteBooks) {
        try {
          const localBook = localBookMap.get(remoteBook.id);
          
          if (!localBook || remoteBook.updatedAt > localBook.updatedAt) {
            // Save to local storage
            await asyncStorageService.saveBook(remoteBook);
            syncedBooks++;
            console.log(`📥 Downloaded book: ${remoteBook.name}`);
          }
        } catch (error: any) {
          errors.push(`Failed to download book ${remoteBook.name}: ${error.message}`);
        }
      }

      // Handle deletions (books in remote but deleted locally)
      // This is a simplified approach - in production you might want to track deletions explicitly
      
    } catch (error: any) {
      errors.push(`Book sync failed: ${error.message}`);
    }

    return { syncedBooks, errors };
  }

  /**
   * Sync entries between local and remote
   */
  private async syncEntries(userId: string): Promise<{ syncedEntries: number; errors: string[] }> {
    const errors: string[] = [];
    let syncedEntries = 0;

    try {
      // Get all local entries
      const localBooks = await asyncStorageService.getBooks();
      const allLocalEntries: Entry[] = [];
      
      for (const book of localBooks) {
        const entries = await asyncStorageService.getEntries(book.id);
        allLocalEntries.push(...entries);
      }

      // Get remote entries
      const entriesRef = collection(firestore, 'entries');
      const entriesQuery = query(entriesRef, where('userId', '==', userId));
      const remoteSnapshot = await getDocs(entriesQuery);
      
      const remoteEntries: Entry[] = remoteSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      }));

      // Create maps for easier comparison
      const localEntryMap = new Map(allLocalEntries.map(entry => [entry.id, entry]));
      const remoteEntryMap = new Map(remoteEntries.map(entry => [entry.id, entry]));

      // Sync local -> remote (upload new/updated local entries)
      for (const localEntry of allLocalEntries) {
        try {
          const remoteEntry = remoteEntryMap.get(localEntry.id);
          
          if (!remoteEntry || localEntry.updatedAt > remoteEntry.updatedAt) {
            // Upload to Firestore
            const entryRef = doc(firestore, 'entries', localEntry.id);
            await setDoc(entryRef, {
              ...localEntry,
              userId,
              date: Timestamp.fromDate(localEntry.date),
              createdAt: Timestamp.fromDate(localEntry.createdAt),
              updatedAt: serverTimestamp(),
            });
            syncedEntries++;
          }
        } catch (error: any) {
          errors.push(`Failed to upload entry ${localEntry.id}: ${error.message}`);
        }
      }

      // Sync remote -> local (download new/updated remote entries)
      for (const remoteEntry of remoteEntries) {
        try {
          const localEntry = localEntryMap.get(remoteEntry.id);
          
          if (!localEntry || remoteEntry.updatedAt > localEntry.updatedAt) {
            // Save to local storage
            await asyncStorageService.saveEntry(remoteEntry);
            syncedEntries++;
          }
        } catch (error: any) {
          errors.push(`Failed to download entry ${remoteEntry.id}: ${error.message}`);
        }
      }

    } catch (error: any) {
      errors.push(`Entry sync failed: ${error.message}`);
    }

    return { syncedEntries, errors };
  }

  /**
   * Process any pending changes when coming back online
   */
  private async processPendingChanges(): Promise<void> {
    if (this.pendingChanges > 0) {
      console.log(`🔄 Processing ${this.pendingChanges} pending changes...`);
      await this.syncAll();
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      lastSyncTime: this.lastSyncTime,
      isSyncing: this.isSyncing,
      pendingChanges: this.pendingChanges,
      error: this.currentError,
    };
  }

  /**
   * Listen to sync status changes
   */
  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.syncStatusListeners.push(callback);
    
    // Call immediately with current status
    callback(this.getSyncStatus());
    
    // Return unsubscribe function
    return () => {
      const index = this.syncStatusListeners.indexOf(callback);
      if (index > -1) {
        this.syncStatusListeners.splice(index, 1);
      }
    };
  }

  /**
   * Force a manual sync
   */
  async forcSync(): Promise<SyncResult> {
    return await this.syncAll();
  }

  /**
   * Clear sync status
   */
  clearSyncStatus(): void {
    this.lastSyncTime = null;
    this.currentError = null;
    this.pendingChanges = 0;
    this.notifyStatusChange();
  }

  // Private helper methods

  private notifyStatusChange(): void {
    const status = this.getSyncStatus();
    this.syncStatusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in sync status listener:', error);
      }
    });
  }
}

export default FirebaseSyncService.getInstance();