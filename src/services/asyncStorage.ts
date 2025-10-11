// Simple AsyncStorage-based storage service as fallback for SQLite issues
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Book, Entry, Category } from '../models/types';
import { dataCacheService } from './dataCache';

const STORAGE_KEYS = {
  BOOKS: 'budget_app_books',
  ENTRIES: 'budget_app_entries', 
  CATEGORIES: 'budget_app_categories'
};

class AsyncStorageService {
  // Callback for triggering sync after data changes
  private onDataChangedCallback: (() => void) | null = null;

  // Set the callback for data changes (called from AuthContext)
  setOnDataChanged(callback: (() => void) | null) {
    this.onDataChangedCallback = callback;
  }

  // Trigger the callback if it exists
  private notifyDataChanged() {
    if (this.onDataChangedCallback) {
      this.onDataChangedCallback();
    }
  }

  // Utility function for better error handling
  private handleError(operation: string, error: any): never {
    console.error(`AsyncStorage Error - ${operation}:`, error);
    
    let userMessage = 'An error occurred while accessing your data.';
    
    if (error.message?.includes('disk space') || error.message?.includes('storage')) {
      userMessage = 'Not enough storage space. Please free up some space and try again.';
    } else if (error.message?.includes('network') || error.message?.includes('connection')) {
      userMessage = 'Connection error. Please check your internet connection and try again.';
    } else if (error.message?.includes('permission')) {
      userMessage = 'Permission error. Please restart the app and try again.';
    }
    
    throw new Error(userMessage);
  }

  async initializeDatabase(): Promise<void> {
    try {
      console.log('AsyncStorage: Initializing storage...');
      await this.seedDefaultCategories();
      console.log('AsyncStorage: Storage initialized successfully');
    } catch (error) {
      this.handleError('initializeDatabase', error);
    }
  }

  private async seedDefaultCategories(): Promise<void> {
    try {
      const existing = await this.getCategories('default');
      if (existing.length > 0) {
        console.log('AsyncStorage: Categories already exist');
        return;
      }

      const defaultCategories = [
        'Food & Dining',
        'Shopping',
        'Transportation', 
        'Bills & Utilities',
        'Entertainment',
        'Healthcare',
        'Travel',
        'Education',
        'Business',
        'Income',
        'Other'
      ];

      const categories: Category[] = defaultCategories.map((name, index) => ({
        id: `default_${name.toLowerCase().replace(/\s+/g, '_')}`,
        name,
        userId: 'default',
        version: 1,
        lastModifiedBy: 'default',
        createdAt: new Date()
      }));

      await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
      console.log('AsyncStorage: Default categories seeded');
    } catch (error) {
      console.error('Error seeding categories:', error);
    }
  }

  // Book operations
  async createBook(book: Omit<Book, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<Book> {
    try {
      console.log('AsyncStorage: Creating book:', book.name);
      
      // Validate required fields
      if (!book.name || !book.userId) {
        throw new Error('Book name and userId are required');
      }

      // NEW: Validate currency is provided
      if (!book.currency) {
        throw new Error('Book currency is required');
      }

      const books = await this.getBooks(book.userId);
      const newBook: Book = {
        id: `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...book,
        currencyHistory: book.currencyHistory || [], // Initialize currency history
        version: 1, // Git-style: New items start at version 1
        lastModifiedBy: book.userId, // Track who created it
        lastSyncedVersion: undefined, // Not yet synced to cloud
        createdAt: new Date(),
        updatedAt: new Date()
      };

      books.push(newBook);
      
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books));
        console.log('AsyncStorage: Book saved to storage successfully');
      } catch (storageError) {
        console.error('AsyncStorage: Failed to save book to storage:', storageError);
        throw new Error('Failed to save book to local storage');
      }
      
      // Invalidate books cache for this user
      try {
        await dataCacheService.invalidatePattern(`books:userId:${book.userId}`);
        console.log('AsyncStorage: Cache invalidated for user books');
      } catch (cacheError) {
        console.warn('AsyncStorage: Failed to invalidate cache:', cacheError);
        // Don't throw here, cache invalidation is not critical
      }
      
      console.log('AsyncStorage: Book created successfully:', newBook.name);
      
      // Trigger auto-sync
      this.notifyDataChanged();
      
      return newBook;
    } catch (error) {
      console.error('AsyncStorage: Error creating book:', error);
      this.handleError('createBook', error);
    }
  }

  async getBookById(bookId: string): Promise<Book | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.BOOKS);
      if (!stored) return null;

      const allBooks: Book[] = JSON.parse(stored).map((book: any) => ({
        ...book,
        createdAt: new Date(book.createdAt),
        updatedAt: new Date(book.updatedAt)
      }));

      return allBooks.find(book => book.id === bookId) || null;
    } catch (error) {
      console.error('AsyncStorage: Error getting book by ID:', error);
      return null;
    }
  }

  async getBooks(userId: string): Promise<Book[]> {
    try {
      if (!userId) {
        console.error('AsyncStorage: No userId provided for getBooks');
        return [];
      }

      return await dataCacheService.get(
        'books',
        { userId },
        async () => {
          console.log('AsyncStorage: Fetching books for user:', userId);
          
          let stored: string | null;
          try {
            stored = await AsyncStorage.getItem(STORAGE_KEYS.BOOKS);
          } catch (storageError) {
            console.error('AsyncStorage: Failed to read books from storage:', storageError);
            return [];
          }
          
          if (!stored) {
            console.log('AsyncStorage: No books found, returning empty array');
            return [];
          }

          let allBooks: Book[];
          try {
            const parsed = JSON.parse(stored);
            allBooks = parsed.map((book: any) => ({
              ...book,
              createdAt: new Date(book.createdAt),
              updatedAt: new Date(book.updatedAt)
            }));
          } catch (parseError) {
            console.error('AsyncStorage: Failed to parse books data:', parseError);
            return [];
          }

          // Filter out deleted books (tombstone markers) and get user's books
          const userBooks = allBooks.filter(book => book.userId === userId && !book.deleted);
          console.log('AsyncStorage: Retrieved books for user:', userBooks.length);
          return userBooks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        },
        2 * 60 * 1000 // Cache for 2 minutes
      );
    } catch (error) {
      console.error('AsyncStorage: Error getting books:', error);
      return [];
    }
  }

  /**
   * Get ALL books for a user, including deleted ones (tombstones)
   * Used for syncing deletions to Firebase
   */
  async getAllBooks(userId: string): Promise<Book[]> {
    try {
      if (!userId) {
        console.error('AsyncStorage: No userId provided for getAllBooks');
        return [];
      }

      console.log('AsyncStorage: Fetching ALL books (including deleted) for user:', userId);
      
      let stored: string | null;
      try {
        stored = await AsyncStorage.getItem(STORAGE_KEYS.BOOKS);
      } catch (storageError) {
        console.error('AsyncStorage: Failed to read books from storage:', storageError);
        return [];
      }
      
      if (!stored) {
        console.log('AsyncStorage: No books found, returning empty array');
        return [];
      }

      let allBooks: Book[];
      try {
        const parsed = JSON.parse(stored);
        allBooks = parsed.map((book: any) => ({
          ...book,
          createdAt: new Date(book.createdAt),
          updatedAt: new Date(book.updatedAt),
          deletedAt: book.deletedAt ? new Date(book.deletedAt) : undefined
        }));
      } catch (parseError) {
        console.error('AsyncStorage: Failed to parse books data:', parseError);
        return [];
      }

      // Return all books for this user, including deleted ones (tombstones)
      const userBooks = allBooks.filter(book => book.userId === userId);
      console.log('AsyncStorage: Retrieved ALL books for user (including deleted):', userBooks.length, 
                  `(${userBooks.filter(b => b.deleted).length} deleted)`);
      return userBooks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('AsyncStorage: Error getting all books:', error);
      return [];
    }
  }

  async updateBook(bookId: string, updates: Partial<Omit<Book, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.BOOKS);
      if (!stored) return;

      const books: Book[] = JSON.parse(stored);
      const bookIndex = books.findIndex(book => book.id === bookId);
      
      if (bookIndex >= 0) {
        const userId = books[bookIndex].userId;
        const currentVersion = books[bookIndex].version || 1;
        books[bookIndex] = {
          ...books[bookIndex],
          ...updates,
          version: currentVersion + 1, // Git-style: Increment version on update
          lastModifiedBy: userId, // Track who modified it
          updatedAt: new Date()
        };
        await AsyncStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books));
        
        // Invalidate books cache for this user
        console.log(`Invalidating cache for updated book with userId: ${userId}`);
        await dataCacheService.invalidatePattern(`books:userId:${userId}`);
        await dataCacheService.invalidatePattern(`books`);
        
        // Also invalidate entries cache since locked rate affects calculations
        if (updates.lockedExchangeRate !== undefined) {
          console.log(`Locked rate changed, invalidating entries cache for bookId: ${bookId}`);
          await dataCacheService.invalidatePattern(`entries:bookId:${bookId}`);
        }
        
        // Trigger auto-sync
        this.notifyDataChanged();
      }
    } catch (error) {
      console.error('Error updating book:', error);
      throw error;
    }
  }

  async deleteBook(bookId: string): Promise<void> {
    try {
      console.log('AsyncStorage: Starting deletion of book:', bookId);
      
      if (!bookId || typeof bookId !== 'string') {
        throw new Error('Invalid book ID provided');
      }
      
      // Delete all entries for this book first
      await this.deleteEntriesForBook(bookId);
      
      // Then delete the book
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.BOOKS);
      if (!stored) {
        console.log('AsyncStorage: No books found in storage');
        return;
      }

      let books: Book[];
      try {
        const parsed = JSON.parse(stored);
        books = parsed.map((book: any) => ({
          ...book,
          createdAt: new Date(book.createdAt),
          updatedAt: new Date(book.updatedAt)
        }));
      } catch (parseError) {
        console.error('AsyncStorage: Failed to parse books data:', parseError);
        throw new Error('Corrupted books data. Please contact support.');
      }

      const bookToDelete = books.find(book => book.id === bookId);
      
      if (!bookToDelete) {
        console.log('AsyncStorage: Book not found:', bookId);
        console.log('AsyncStorage: Available book IDs:', books.map(b => b.id));
        throw new Error('Book not found');
      }
      
      const userId = bookToDelete.userId;
      
      // Mark book as deleted (tombstone marker) instead of removing it
      // This allows other devices to know it was deleted
      const updatedBooks = books.map(book => 
        book.id === bookId 
          ? { 
              ...book, 
              deleted: true, 
              deletedAt: new Date(),
              updatedAt: new Date() 
            } 
          : book
      );
      
      // Save updated books back to storage
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(updatedBooks));
        console.log(`AsyncStorage: Successfully marked book as deleted (tombstone): ${bookId}`);
      } catch (saveError) {
        console.error('AsyncStorage: Failed to save updated books:', saveError);
        throw new Error('Failed to save updated books to storage');
      }
      
      // Invalidate all related caches
      console.log('AsyncStorage: Starting cache invalidation for book deletion');
      try {
        await dataCacheService.invalidatePattern(`books:userId:${userId}`);
        await dataCacheService.invalidatePattern(`books`);
        await dataCacheService.invalidatePattern(`entries:bookId:${bookId}`);
        await dataCacheService.invalidatePattern(`entries`);
        console.log('AsyncStorage: Cache invalidation completed');
      } catch (cacheError) {
        console.warn('AsyncStorage: Cache invalidation failed (non-critical):', cacheError);
        // Don't throw here - deletion succeeded even if cache invalidation failed
      }
      
      console.log('AsyncStorage: Book deleted successfully:', bookId);
      
      // Trigger auto-sync
      this.notifyDataChanged();
    } catch (error) {
      console.error('AsyncStorage: Error deleting book:', error);
      throw new Error(`Failed to delete book: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Entry operations
  async createEntry(entry: Omit<Entry, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<Entry> {
    try {
      console.log('AsyncStorage: Creating entry for bookId:', entry.bookId);
      
      // Validate required fields
      if (!entry.bookId || !entry.userId || typeof entry.amount !== 'number') {
        throw new Error('Entry bookId, userId, and amount are required');
      }

      if (!entry.category || !entry.date) {
        throw new Error('Entry category and date are required');
      }

      // NEW: Validate currency is provided
      if (!entry.currency) {
        throw new Error('Entry currency is required (must match book currency)');
      }

      // Get existing entries to append to
      const allEntriesStored = await AsyncStorage.getItem(STORAGE_KEYS.ENTRIES);
      const allEntries: Entry[] = allEntriesStored ? JSON.parse(allEntriesStored) : [];
      
      const newEntry: Entry = {
        id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...entry,
        historicalRates: entry.historicalRates, // Preserve historical rates if provided
        conversionHistory: entry.conversionHistory || [], // Initialize conversion history
        version: 1, // Git-style: New items start at version 1
        lastModifiedBy: entry.userId, // Track who created it
        lastSyncedVersion: undefined, // Not yet synced to cloud
        createdAt: new Date(),
        updatedAt: new Date()
      };

      allEntries.push(newEntry);
      
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(allEntries));
        console.log('AsyncStorage: Entry saved to storage successfully');
      } catch (storageError) {
        console.error('AsyncStorage: Failed to save entry to storage:', storageError);
        throw new Error('Failed to save entry to local storage');
      }
      
      // Invalidate entries cache for this book
      try {
        console.log(`AsyncStorage: Invalidating cache for entries with bookId: ${entry.bookId}`);
        await dataCacheService.invalidatePattern(`entries:bookId:${entry.bookId}`);
        console.log('AsyncStorage: Cache invalidated for book entries');
      } catch (cacheError) {
        console.warn('AsyncStorage: Failed to invalidate cache:', cacheError);
        // Don't throw here, cache invalidation is not critical
      }
      
      console.log('AsyncStorage: Entry created successfully with id:', newEntry.id);
      
      // Trigger auto-sync
      this.notifyDataChanged();
      
      return newEntry;
    } catch (error) {
      console.error('AsyncStorage: Error creating entry:', error);
      this.handleError('createEntry', error);
    }
  }

  async getEntries(bookId: string, limit?: number): Promise<Entry[]> {
    try {
      if (!bookId) {
        console.error('AsyncStorage: No bookId provided for getEntries');
        return [];
      }

      return await dataCacheService.get(
        'entries',
        { bookId, limit },
        async () => {
          console.log('AsyncStorage: Fetching entries for book:', bookId);
          
          let stored: string | null;
          try {
            stored = await AsyncStorage.getItem(STORAGE_KEYS.ENTRIES);
          } catch (storageError) {
            console.error('AsyncStorage: Failed to read entries from storage:', storageError);
            return [];
          }
          
          if (!stored) {
            console.log('AsyncStorage: No entries found, returning empty array');
            return [];
          }

          let allEntries: Entry[];
          try {
            const parsed = JSON.parse(stored);
            allEntries = parsed.map((entry: any) => ({
              ...entry,
              date: new Date(entry.date),
              createdAt: new Date(entry.createdAt),
              updatedAt: new Date(entry.updatedAt)
            }));
          } catch (parseError) {
            console.error('AsyncStorage: Failed to parse entries data:', parseError);
            return [];
          }

          // Filter out deleted entries (tombstone markers) and get book's entries
          let bookEntries = allEntries.filter(entry => entry.bookId === bookId && !entry.deleted);
          bookEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
          
          if (limit && limit > 0) {
            bookEntries = bookEntries.slice(0, limit);
          }

          console.log('AsyncStorage: Retrieved entries for book:', bookEntries.length);
          return bookEntries;
        },
        120000 // 2 minutes for entries
      );
    } catch (error) {
      console.error('AsyncStorage: Error getting entries:', error);
      return [];
    }
  }

  /**
   * Get ALL entries for a user (across all books), including deleted ones (tombstones)
   * Used for syncing deletions to Firebase
   */
  async getAllEntries(userId: string): Promise<Entry[]> {
    try {
      if (!userId) {
        console.error('AsyncStorage: No userId provided for getAllEntries');
        return [];
      }

      console.log('AsyncStorage: Fetching ALL entries (including deleted) for user:', userId);
      
      let stored: string | null;
      try {
        stored = await AsyncStorage.getItem(STORAGE_KEYS.ENTRIES);
      } catch (storageError) {
        console.error('AsyncStorage: Failed to read entries from storage:', storageError);
        return [];
      }
      
      if (!stored) {
        console.log('AsyncStorage: No entries found, returning empty array');
        return [];
      }

      let allEntries: Entry[];
      try {
        const parsed = JSON.parse(stored);
        allEntries = parsed.map((entry: any) => ({
          ...entry,
          date: new Date(entry.date),
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
          deletedAt: entry.deletedAt ? new Date(entry.deletedAt) : undefined
        }));
      } catch (parseError) {
        console.error('AsyncStorage: Failed to parse entries data:', parseError);
        return [];
      }

      // Return all entries for this user, including deleted ones (tombstones)
      const userEntries = allEntries.filter(entry => entry.userId === userId);
      console.log('AsyncStorage: Retrieved ALL entries for user (including deleted):', userEntries.length,
                  `(${userEntries.filter(e => e.deleted).length} deleted)`);
      return userEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      console.error('AsyncStorage: Error getting all entries:', error);
      return [];
    }
  }

  async updateEntry(entryId: string, updates: Partial<Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ENTRIES);
      if (!stored) return;

      const entries: Entry[] = JSON.parse(stored);
      const entryIndex = entries.findIndex(entry => entry.id === entryId);
      
      if (entryIndex >= 0) {
        const bookId = entries[entryIndex].bookId;
        const userId = entries[entryIndex].userId;
        const currentVersion = entries[entryIndex].version || 1;
        entries[entryIndex] = {
          ...entries[entryIndex],
          ...updates,
          version: currentVersion + 1, // Git-style: Increment version on update
          lastModifiedBy: userId, // Track who modified it
          updatedAt: new Date()
        };
        await AsyncStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
        
        // Invalidate entries cache for this book
        console.log(`Invalidating cache for updated entry with bookId: ${bookId}`);
        await dataCacheService.invalidatePattern(`entries:bookId:${bookId}`);
        
        // Trigger auto-sync
        this.notifyDataChanged();
      }
    } catch (error) {
      console.error('Error updating entry:', error);
      throw error;
    }
  }

  async getEntry(entryId: string): Promise<Entry | null> {
    try {
      console.log('AsyncStorage: Fetching entry with ID:', entryId);
      
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ENTRIES);
      if (!stored) {
        console.log('AsyncStorage: No entries found in storage');
        return null;
      }

      let allEntries: Entry[];
      try {
        const parsed = JSON.parse(stored);
        allEntries = parsed.map((entry: any) => ({
          ...entry,
          date: new Date(entry.date),
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt)
        }));
        console.log('AsyncStorage: Total entries in storage:', allEntries.length);
        console.log('AsyncStorage: Available entry IDs:', allEntries.map(e => e.id));
      } catch (parseError) {
        console.error('AsyncStorage: Failed to parse entries data:', parseError);
        return null;
      }

      const entry = allEntries.find(e => e.id === entryId);
      if (entry) {
        console.log('AsyncStorage: Found entry:', { id: entry.id, userId: entry.userId, bookId: entry.bookId });
        return entry;
      } else {
        console.log('AsyncStorage: Entry not found with ID:', entryId);
        console.log('AsyncStorage: Searched in entries:', allEntries.map(e => ({ id: e.id, userId: e.userId })));
        return null;
      }
    } catch (error) {
      console.error('AsyncStorage: Error getting entry:', error);
      return null;
    }
  }

  async deleteEntry(entryId: string): Promise<void> {
    try {
      console.log('AsyncStorage: Starting deletion of entry:', entryId);
      
      if (!entryId || typeof entryId !== 'string') {
        throw new Error('Invalid entry ID provided');
      }
      
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ENTRIES);
      if (!stored) {
        console.log('AsyncStorage: No entries found in storage');
        return;
      }

      let entries: Entry[];
      try {
        const parsed = JSON.parse(stored);
        entries = parsed.map((entry: any) => ({
          ...entry,
          date: new Date(entry.date),
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt)
        }));
      } catch (parseError) {
        console.error('AsyncStorage: Failed to parse entries data:', parseError);
        throw new Error('Corrupted entries data. Please contact support.');
      }

      const entryToDelete = entries.find(entry => entry.id === entryId);
      
      if (!entryToDelete) {
        console.log('AsyncStorage: Entry not found:', entryId);
        console.log('AsyncStorage: Available entry IDs:', entries.map(e => e.id));
        throw new Error('Entry not found');
      }
      
      const bookId = entryToDelete.bookId;
      
      // Mark entry as deleted (tombstone marker) instead of removing it
      const updatedEntries = entries.map(entry => 
        entry.id === entryId 
          ? { 
              ...entry, 
              deleted: true, 
              deletedAt: new Date(),
              updatedAt: new Date() 
            } 
          : entry
      );
      
      // Save updated entries back to storage
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(updatedEntries));
        console.log(`AsyncStorage: Successfully marked entry as deleted (tombstone): ${entryId}`);
      } catch (saveError) {
        console.error('AsyncStorage: Failed to save updated entries:', saveError);
        throw new Error('Failed to save updated entries to storage');
      }
      
      // Invalidate entries cache for this book
      console.log(`AsyncStorage: Invalidating cache for deleted entry with bookId: ${bookId}`);
      try {
        await dataCacheService.invalidatePattern(`entries:bookId:${bookId}`);
        // Also invalidate general entries cache
        await dataCacheService.invalidatePattern(`entries`);
        console.log('AsyncStorage: Cache invalidation completed');
      } catch (cacheError) {
        console.warn('AsyncStorage: Cache invalidation failed (non-critical):', cacheError);
        // Don't throw here - deletion succeeded even if cache invalidation failed
      }
      
      console.log('AsyncStorage: Entry deleted successfully:', entryId);
      
      // Trigger auto-sync
      this.notifyDataChanged();
    } catch (error) {
      console.error('AsyncStorage: Error deleting entry:', error);
      throw new Error(`Failed to delete entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async deleteEntriesForBook(bookId: string): Promise<void> {
    try {
      console.log('AsyncStorage: Deleting all entries for book:', bookId);
      
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ENTRIES);
      if (!stored) {
        console.log('AsyncStorage: No entries found in storage');
        return;
      }

      let entries: Entry[];
      try {
        const parsed = JSON.parse(stored);
        entries = parsed.map((entry: any) => ({
          ...entry,
          date: new Date(entry.date),
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt)
        }));
      } catch (parseError) {
        console.error('AsyncStorage: Failed to parse entries data:', parseError);
        throw new Error('Corrupted entries data during book deletion');
      }

      const entriesToDelete = entries.filter(entry => entry.bookId === bookId);
      
      // Mark all entries for this book as deleted (tombstone markers)
      const updatedEntries = entries.map(entry => 
        entry.bookId === bookId 
          ? { 
              ...entry, 
              deleted: true, 
              deletedAt: new Date(),
              updatedAt: new Date() 
            } 
          : entry
      );
      
      // Save updated entries back to storage
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(updatedEntries));
        console.log(`AsyncStorage: Successfully marked ${entriesToDelete.length} entries as deleted (tombstones) for book: ${bookId}`);
      } catch (saveError) {
        console.error('AsyncStorage: Failed to save entries after book deletion:', saveError);
        throw new Error('Failed to save entries after book deletion');
      }
      
      // Invalidate entries cache for this book
      try {
        await dataCacheService.invalidatePattern(`entries:bookId:${bookId}`);
        console.log('AsyncStorage: Cache invalidated for book entries');
      } catch (cacheError) {
        console.warn('AsyncStorage: Cache invalidation failed for book entries:', cacheError);
        // Don't throw here - entries were deleted successfully
      }
      
      console.log(`AsyncStorage: Deleted ${entriesToDelete.length} entries for book ${bookId}`);
    } catch (error) {
      console.error('AsyncStorage: Error deleting entries for book:', error);
      throw error;
    }
  }

  // Category operations
  async getCategories(userId: string): Promise<Category[]> {
    try {
      return await dataCacheService.get(
        'categories',
        { userId },
        async () => {
          console.log('AsyncStorage: Fetching categories for user:', userId);
          const stored = await AsyncStorage.getItem(STORAGE_KEYS.CATEGORIES);
          
          let allCategories: Category[] = [];
          
          if (stored) {
            allCategories = JSON.parse(stored).map((category: any) => ({
              ...category,
              createdAt: new Date(category.createdAt)
            }));
          }

          // Ensure "Others" default category always exists
          const othersExists = allCategories.some(cat => 
            cat.name.toLowerCase() === 'others' && cat.userId === 'default'
          );

          if (!othersExists) {
            console.log('AsyncStorage: Creating "Others" default category');
            const othersCategory: Category = {
              id: `category_default_others`,
              name: 'Others',
              description: 'Miscellaneous expenses',
              color: '#9E9E9E',
              icon: 'category',
              userId: 'default',
              version: 1,
              lastModifiedBy: 'default',
              createdAt: new Date()
            };
            allCategories.push(othersCategory);
            await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(allCategories));
          }

          // Filter out deleted categories (tombstone markers) and get user's categories
          const userCategories = allCategories.filter(category => 
            (category.userId === userId || category.userId === 'default') && !category.deleted
          );

          console.log('AsyncStorage: Retrieved categories:', userCategories.length);
          return userCategories;
        },
        300000 // 5 minutes for categories
      );
    } catch (error) {
      console.error('Error getting categories:', error);
      return [];
    }
  }

  /**
   * Get ALL categories for a user, including deleted ones (tombstones)
   * Used for syncing deletions to Firebase
   */
  async getAllCategories(userId: string): Promise<Category[]> {
    try {
      console.log('AsyncStorage: Fetching ALL categories (including deleted) for user:', userId);
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CATEGORIES);
      
      let allCategories: Category[] = [];
      
      if (stored) {
        allCategories = JSON.parse(stored).map((category: any) => ({
          ...category,
          createdAt: new Date(category.createdAt),
          deletedAt: category.deletedAt ? new Date(category.deletedAt) : undefined
        }));
      }

      // Return all categories for this user (including deleted), plus default categories
      const userCategories = allCategories.filter(category => 
        category.userId === userId || category.userId === 'default'
      );

      console.log('AsyncStorage: Retrieved ALL categories for user (including deleted):', userCategories.length,
                  `(${userCategories.filter(c => c.deleted).length} deleted)`);
      return userCategories;
    } catch (error) {
      console.error('Error getting all categories:', error);
      return [];
    }
  }

  async createCategory(category: Omit<Category, 'id' | 'createdAt' | 'version'>): Promise<Category> {
    try {
      const newCategory: Category = {
        id: `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...category,
        version: 1, // Git-style: New items start at version 1
        lastModifiedBy: category.lastModifiedBy || category.userId, // Track who created it
        lastSyncedVersion: category.lastSyncedVersion, // Preserve if provided
        createdAt: new Date()
      };

      const allCategoriesStored = await AsyncStorage.getItem(STORAGE_KEYS.CATEGORIES);
      const allCategories: Category[] = allCategoriesStored ? JSON.parse(allCategoriesStored) : [];
      allCategories.push(newCategory);
      
      await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(allCategories));
      
      // Invalidate categories cache for this user
      await dataCacheService.invalidatePattern(`categories:userId:${category.userId}`);
      
      // Trigger auto-sync
      this.notifyDataChanged();
      
      return newCategory;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  async updateCategory(categoryId: string, updates: Partial<Omit<Category, 'id' | 'createdAt' | 'userId'>>): Promise<void> {
    try {
      const allCategoriesStored = await AsyncStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (!allCategoriesStored) {
        throw new Error('No categories found');
      }

      const allCategories: Category[] = JSON.parse(allCategoriesStored);
      const categoryIndex = allCategories.findIndex(cat => cat.id === categoryId);
      
      if (categoryIndex === -1) {
        throw new Error('Category not found');
      }

      // Update the category
      const currentVersion = allCategories[categoryIndex].version || 1;
      const userId = allCategories[categoryIndex].userId;
      allCategories[categoryIndex] = {
        ...allCategories[categoryIndex],
        ...updates,
        version: currentVersion + 1, // Git-style: Increment version on update
        lastModifiedBy: userId // Track who modified it
      };

      await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(allCategories));
      
      // Invalidate categories cache for this user
      await dataCacheService.invalidatePattern(`categories:userId:${allCategories[categoryIndex].userId}`);
      
      // Trigger auto-sync
      this.notifyDataChanged();
      
      console.log('Category updated successfully:', categoryId);
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  async deleteCategory(categoryId: string): Promise<void> {
    try {
      const allCategoriesStored = await AsyncStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (!allCategoriesStored) {
        throw new Error('No categories found');
      }

      const allCategories: Category[] = JSON.parse(allCategoriesStored);
      const categoryToDelete = allCategories.find(cat => cat.id === categoryId);
      
      if (!categoryToDelete) {
        throw new Error('Category not found');
      }

      // Prevent deletion of "Others" default category
      if (categoryToDelete.name.toLowerCase() === 'others' && categoryToDelete.userId === 'default') {
        throw new Error('Cannot delete the "Others" category as it is a mandatory default category');
      }

      // Mark category as deleted (tombstone marker) instead of removing it
      const updatedCategories = allCategories.map(cat => 
        cat.id === categoryId 
          ? { 
              ...cat, 
              deleted: true, 
              deletedAt: new Date()
            } 
          : cat
      );
      await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(updatedCategories));
      console.log(`AsyncStorage: Successfully marked category as deleted (tombstone): ${categoryId}`);
      
      // Invalidate categories cache for this user
      await dataCacheService.invalidatePattern(`categories:userId:${categoryToDelete.userId}`);
      
      // Trigger auto-sync
      this.notifyDataChanged();
      
      console.log('Category deleted successfully:', categoryId);
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  async createDefaultCategories(userId: string): Promise<Category[]> {
    try {
      console.log('Creating default categories for user:', userId);
      
      // Get all existing categories to check what's already there
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CATEGORIES);
      let allCategories: Category[] = stored ? JSON.parse(stored) : [];
      
      // "Others" is mandatory and should always exist
      const othersExists = allCategories.some(cat => 
        cat.name.toLowerCase() === 'others' && cat.userId === 'default'
      );

      // Define useful default categories with valid MaterialIcons
      // Others is always first and mandatory
      const defaultCategoriesData = [
        { name: 'Others', color: '#9E9E9E', icon: 'category', description: 'Miscellaneous expenses' },
        { name: 'Food & Dining', color: '#FF5722', icon: 'restaurant', description: 'Meals and restaurants' },
        { name: 'Shopping', color: '#E91E63', icon: 'shopping-cart', description: 'General shopping' },
        { name: 'Transportation', color: '#2196F3', icon: 'directions-car', description: 'Travel and commute' },
        { name: 'Bills & Utilities', color: '#FF9800', icon: 'phone', description: 'Monthly bills' },
        { name: 'Healthcare', color: '#F44336', icon: 'local-hospital', description: 'Medical expenses' },
        { name: 'Entertainment', color: '#9C27B0', icon: 'movie', description: 'Fun and leisure' },
        { name: 'Salary', color: '#4CAF50', icon: 'work', description: 'Income from work' },
      ];

      const createdCategories: Category[] = [];
      
      for (const categoryData of defaultCategoriesData) {
        // Check if this specific category already exists
        const exists = allCategories.some(cat => 
          cat.name.toLowerCase() === categoryData.name.toLowerCase() && 
          cat.userId === 'default'
        );
        
        if (!exists) {
          const category = await this.createCategory({
            ...categoryData,
            userId: 'default', // Use 'default' as userId so it's shared across all users
            lastModifiedBy: 'default'
          });
          createdCategories.push(category);
        } else {
          // Add existing category to return list
          const existingCat = allCategories.find(cat => 
            cat.name.toLowerCase() === categoryData.name.toLowerCase() && 
            cat.userId === 'default'
          );
          if (existingCat) {
            createdCategories.push(existingCat);
          }
        }
      }
      
      // Invalidate cache for both default and the requesting user to force refresh
      await dataCacheService.invalidatePattern(`categories:userId:default`);
      await dataCacheService.invalidatePattern(`categories:userId:${userId}`);
      
      console.log(`Ensured ${createdCategories.length} default categories exist`);
      return createdCategories;
    } catch (error) {
      console.error('Error creating default categories:', error);
      throw error;
    }
  }

  async closeDatabase(): Promise<void> {
    // No cleanup needed for AsyncStorage
    console.log('AsyncStorage: No cleanup needed');
  }
}

export const asyncStorageService = new AsyncStorageService();
export default asyncStorageService;