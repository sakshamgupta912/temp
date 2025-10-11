// Backup and Restore Service
// Handles manual backup/restore operations with Firebase

import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLLECTIONS } from '../config/firebaseConfig';
import asyncStorageService from './asyncStorage';
import preferencesService from './preferences';
import googleAuthService from './googleAuthService';
import { Book, Entry } from '../models/types';

export interface BackupMetadata {
  timestamp: Date;
  deviceId: string;
  appVersion: string;
  dataVersion: string;
  totalBooks: number;
  totalEntries: number;
}

export interface BackupResult {
  success: boolean;
  message: string;
  metadata?: BackupMetadata;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  restoredBooks: number;
  restoredEntries: number;
  error?: string;
}

class BackupRestoreService {
  private static instance: BackupRestoreService;

  static getInstance(): BackupRestoreService {
    if (!BackupRestoreService.instance) {
      BackupRestoreService.instance = new BackupRestoreService();
    }
    return BackupRestoreService.instance;
  }

  /**
   * Create a complete backup to Firebase
   */
  async createBackup(): Promise<BackupResult> {
    const user = googleAuthService.getCurrentUser();
    if (!user) {
      return { success: false, message: 'User must be signed in to create backup', error: 'Not authenticated' };
    }

    try {
      console.log('📦 Starting backup process...');

      // Get all local data
      const books = await asyncStorageService.getBooks(user.uid);
      const preferences = await preferencesService.getPreferences();
      
      let totalEntries = 0;
      const allEntries: { [bookId: string]: Entry[] } = {};
      
      // Get entries for each book
      for (const book of books) {
        const entries = await asyncStorageService.getEntries(book.id);
        allEntries[book.id] = entries;
        totalEntries += entries.length;
      }

      // Create backup metadata
      const metadata: BackupMetadata = {
        timestamp: new Date(),
        deviceId: 'device_' + Math.random().toString(36).substring(7),
        appVersion: '1.0.0',
        dataVersion: '1.0',
        totalBooks: books.length,
        totalEntries: totalEntries,
      };

      const batch = firestore().batch();

      // Backup books
      for (const book of books) {
        const bookRef = firestore()
          .collection(COLLECTIONS.USERS)
          .doc(user.uid)
          .collection('backup_books')
          .doc(book.id);
        
        batch.set(bookRef, {
          ...book,
          createdAt: firestore.Timestamp.fromDate(new Date(book.createdAt)),
          updatedAt: firestore.Timestamp.fromDate(new Date(book.updatedAt)),
          rateLockedAt: book.rateLockedAt ? firestore.Timestamp.fromDate(new Date(book.rateLockedAt)) : null,
        });

        // Backup entries for this book
        for (const entry of allEntries[book.id]) {
          const entryRef = firestore()
            .collection(COLLECTIONS.USERS)
            .doc(user.uid)
            .collection('backup_books')
            .doc(book.id)
            .collection('backup_entries')
            .doc(entry.id);
          
          batch.set(entryRef, {
            ...entry,
            date: firestore.Timestamp.fromDate(new Date(entry.date)),
            createdAt: firestore.Timestamp.fromDate(new Date(entry.createdAt)),
            updatedAt: firestore.Timestamp.fromDate(new Date(entry.updatedAt)),
          });
        }
      }

      // Backup preferences
      const prefsRef = firestore()
        .collection(COLLECTIONS.USERS)
        .doc(user.uid)
        .collection('backup_preferences')
        .doc('settings');
      
      batch.set(prefsRef, preferences);

      // Backup metadata
      const metadataRef = firestore()
        .collection(COLLECTIONS.USERS)
        .doc(user.uid)
        .collection('backup_metadata')
        .doc('latest');
      
      batch.set(metadataRef, {
        ...metadata,
        timestamp: firestore.Timestamp.fromDate(metadata.timestamp),
      });

      // Commit batch
      await batch.commit();

      console.log(`✅ Backup completed: ${books.length} books, ${totalEntries} entries`);
      
      return {
        success: true,
        message: `Backup completed successfully!\n\n${books.length} books and ${totalEntries} entries backed up.`,
        metadata,
      };

    } catch (error: any) {
      console.error('❌ Backup failed:', error);
      return {
        success: false,
        message: 'Backup failed. Please try again.',
        error: error.message,
      };
    }
  }

  /**
   * Restore data from Firebase backup
   */
  async restoreFromBackup(): Promise<RestoreResult> {
    const user = googleAuthService.getCurrentUser();
    if (!user) {
      return { 
        success: false, 
        message: 'User must be signed in to restore backup', 
        restoredBooks: 0, 
        restoredEntries: 0,
        error: 'Not authenticated' 
      };
    }

    try {
      console.log('📥 Starting restore process...');

      // Check if backup exists
      const metadataDoc = await firestore()
        .collection(COLLECTIONS.USERS)
        .doc(user.uid)
        .collection('backup_metadata')
        .doc('latest')
        .get();

      if (!metadataDoc.exists) {
        return {
          success: false,
          message: 'No backup found for this account.',
          restoredBooks: 0,
          restoredEntries: 0,
          error: 'No backup exists',
        };
      }

      const metadata = metadataDoc.data();
      console.log('📋 Found backup from:', metadata?.timestamp?.toDate());

      // Show confirmation dialog
      const confirmRestore = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Restore Backup',
          `This will replace all local data with your cloud backup from ${metadata?.timestamp?.toDate().toLocaleDateString()}.\n\n` +
          `Backup contains:\n• ${metadata?.totalBooks || 0} books\n• ${metadata?.totalEntries || 0} entries\n\n` +
          'Are you sure you want to continue?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Restore', style: 'destructive', onPress: () => resolve(true) },
          ]
        );
      });

      if (!confirmRestore) {
        return {
          success: false,
          message: 'Restore cancelled by user',
          restoredBooks: 0,
          restoredEntries: 0,
        };
      }

      // Clear existing local data
      console.log('🗑️ Clearing local data...');
      const existingBooks = await asyncStorageService.getBooks(user.uid);
      for (const book of existingBooks) {
        await asyncStorageService.deleteBook(book.id);
      }

      // Restore books
      const booksSnapshot = await firestore()
        .collection(COLLECTIONS.USERS)
        .doc(user.uid)
        .collection('backup_books')
        .get();

      let restoredBooks = 0;
      let restoredEntries = 0;

      for (const bookDoc of booksSnapshot.docs) {
        const bookData = bookDoc.data();
        const book: Book = {
          ...bookData,
          id: bookDoc.id,
          createdAt: bookData.createdAt?.toDate() || new Date(),
          updatedAt: bookData.updatedAt?.toDate() || new Date(),
          rateLockedAt: bookData.rateLockedAt?.toDate() || null,
        };

        // Create book
        await asyncStorageService.createBook(book);
        restoredBooks++;
        console.log(`📚 Restored book: ${book.name}`);

        // Restore entries for this book
        const entriesSnapshot = await firestore()
          .collection(COLLECTIONS.USERS)
          .doc(user.uid)
          .collection('backup_books')
          .doc(book.id)
          .collection('backup_entries')
          .get();

        for (const entryDoc of entriesSnapshot.docs) {
          const entryData = entryDoc.data();
          const entry: Entry = {
            ...entryData,
            id: entryDoc.id,
            date: entryData.date?.toDate() || new Date(),
            createdAt: entryData.createdAt?.toDate() || new Date(),
            updatedAt: entryData.updatedAt?.toDate() || new Date(),
          };

          await asyncStorageService.createEntry(entry);
          restoredEntries++;
        }
      }

      // Restore preferences
      const prefsDoc = await firestore()
        .collection(COLLECTIONS.USERS)
        .doc(user.uid)
        .collection('backup_preferences')
        .doc('settings')
        .get();

      if (prefsDoc.exists) {
        const prefsData = prefsDoc.data();
        await preferencesService.savePreferences(prefsData);
        console.log('⚙️ Restored preferences');
      }

      console.log(`✅ Restore completed: ${restoredBooks} books, ${restoredEntries} entries`);

      return {
        success: true,
        message: `Restore completed successfully!\n\n${restoredBooks} books and ${restoredEntries} entries restored.`,
        restoredBooks,
        restoredEntries,
      };

    } catch (error: any) {
      console.error('❌ Restore failed:', error);
      return {
        success: false,
        message: 'Restore failed. Please try again.',
        restoredBooks: 0,
        restoredEntries: 0,
        error: error.message,
      };
    }
  }

  /**
   * Get backup metadata (when was last backup created)
   */
  async getBackupMetadata(): Promise<BackupMetadata | null> {
    const user = googleAuthService.getCurrentUser();
    if (!user) return null;

    try {
      const metadataDoc = await firestore()
        .collection(COLLECTIONS.USERS)
        .doc(user.uid)
        .collection('backup_metadata')
        .doc('latest')
        .get();

      if (!metadataDoc.exists) return null;

      const data = metadataDoc.data();
      return {
        ...data,
        timestamp: data?.timestamp?.toDate() || new Date(),
      } as BackupMetadata;

    } catch (error) {
      console.error('Error getting backup metadata:', error);
      return null;
    }
  }

  /**
   * Delete backup from Firebase
   */
  async deleteBackup(): Promise<BackupResult> {
    const user = googleAuthService.getCurrentUser();
    if (!user) {
      return { success: false, message: 'User must be signed in', error: 'Not authenticated' };
    }

    try {
      const batch = firestore().batch();

      // Delete backup books and their entries
      const booksSnapshot = await firestore()
        .collection(COLLECTIONS.USERS)
        .doc(user.uid)
        .collection('backup_books')
        .get();

      for (const bookDoc of booksSnapshot.docs) {
        // Delete entries first
        const entriesSnapshot = await firestore()
          .collection(COLLECTIONS.USERS)
          .doc(user.uid)
          .collection('backup_books')
          .doc(bookDoc.id)
          .collection('backup_entries')
          .get();

        for (const entryDoc of entriesSnapshot.docs) {
          batch.delete(entryDoc.ref);
        }

        // Delete book
        batch.delete(bookDoc.ref);
      }

      // Delete preferences backup
      const prefsRef = firestore()
        .collection(COLLECTIONS.USERS)
        .doc(user.uid)
        .collection('backup_preferences')
        .doc('settings');
      batch.delete(prefsRef);

      // Delete metadata
      const metadataRef = firestore()
        .collection(COLLECTIONS.USERS)
        .doc(user.uid)
        .collection('backup_metadata')
        .doc('latest');
      batch.delete(metadataRef);

      await batch.commit();

      return {
        success: true,
        message: 'Backup deleted successfully',
      };

    } catch (error: any) {
      console.error('Error deleting backup:', error);
      return {
        success: false,
        message: 'Failed to delete backup',
        error: error.message,
      };
    }
  }

  /**
   * Export data as JSON file (local export)
   */
  async exportToJSON(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const user = googleAuthService.getCurrentUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const books = await asyncStorageService.getBooks(user.uid);
      const preferences = await preferencesService.getPreferences();
      
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          appVersion: '1.0.0',
          totalBooks: books.length,
        },
        user: {
          id: user.uid,
          email: user.email,
          displayName: user.displayName,
        },
        preferences,
        books: [] as Array<Book & { entries: Entry[] }>,
      };

      // Export books with their entries
      for (const book of books) {
        const entries = await asyncStorageService.getEntries(book.id);
        exportData.books.push({
          ...book,
          entries,
        });
      }

      return { success: true, data: exportData };

    } catch (error: any) {
      console.error('Export failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Import data from JSON (local import)
   */
  async importFromJSON(data: any): Promise<RestoreResult> {
    try {
      const user = googleAuthService.getCurrentUser();
      if (!user) {
        return {
          success: false,
          message: 'User must be signed in',
          restoredBooks: 0,
          restoredEntries: 0,
          error: 'Not authenticated',
        };
      }

      // Validate data structure
      if (!data.books || !Array.isArray(data.books)) {
        return {
          success: false,
          message: 'Invalid import data format',
          restoredBooks: 0,
          restoredEntries: 0,
          error: 'Invalid format',
        };
      }

      let restoredBooks = 0;
      let restoredEntries = 0;

      // Import books and entries
      for (const bookData of data.books) {
        const { entries, ...book } = bookData;
        
        // Create book
        await asyncStorageService.createBook({
          ...book,
          userId: user.uid,
          createdAt: new Date(book.createdAt),
          updatedAt: new Date(book.updatedAt),
          rateLockedAt: book.rateLockedAt ? new Date(book.rateLockedAt) : null,
        });
        restoredBooks++;

        // Create entries
        if (entries && Array.isArray(entries)) {
          for (const entry of entries) {
            await asyncStorageService.createEntry({
              ...entry,
              userId: user.uid,
              date: new Date(entry.date),
              createdAt: new Date(entry.createdAt),
              updatedAt: new Date(entry.updatedAt),
            });
            restoredEntries++;
          }
        }
      }

      // Import preferences if available
      if (data.preferences) {
        await preferencesService.savePreferences(data.preferences);
      }

      return {
        success: true,
        message: `Import completed!\n\n${restoredBooks} books and ${restoredEntries} entries imported.`,
        restoredBooks,
        restoredEntries,
      };

    } catch (error: any) {
      console.error('Import failed:', error);
      return {
        success: false,
        message: 'Import failed. Please check the file format.',
        restoredBooks: 0,
        restoredEntries: 0,
        error: error.message,
      };
    }
  }
}

export default BackupRestoreService.getInstance();