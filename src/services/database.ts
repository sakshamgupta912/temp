// SQLite database service for local data storage
import * as SQLite from 'expo-sqlite';
import { 
  BookEntity, EntryEntity, CategoryEntity, 
  Book, Entry, Category,
  BookCurrencyHistory, HistoricalRatesSnapshot, ConversionHistoryEntry
} from '../models/types';

const DATABASE_NAME = 'BudgetApp.db';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initializeDatabase(): Promise<void> {
    try {
      console.log('Opening database:', DATABASE_NAME);
      this.db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      
      if (!this.db) {
        throw new Error('Failed to open database');
      }
      
      console.log('Database opened successfully, creating tables...');
      await this.createTables();
      console.log('Tables created, seeding default categories...');
      await this.seedDefaultCategories();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // FIRST: Run migrations to add columns to existing tables
      await this.migrateExistingData();
      await this.migrateLockedExchangeRate();
      await this.migrateNormalizedAmounts();
      
      // Users table (NEW)
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          displayName TEXT,
          photoURL TEXT,
          defaultCurrency TEXT NOT NULL DEFAULT 'USD',
          createdAt TEXT NOT NULL
        );
      `);

      // Books table (UPDATED with currency fields and locked exchange rate)
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS books (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          currency TEXT NOT NULL DEFAULT 'USD',
          currencyHistory TEXT,
          lockedExchangeRate REAL,
          targetCurrency TEXT,
          rateLockedAt TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          userId TEXT NOT NULL
        );
      `);

      // Categories table (no changes)
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          color TEXT,
          icon TEXT,
          userId TEXT NOT NULL,
          createdAt TEXT NOT NULL
        );
      `);

      // Entries table (UPDATED with currency and historical fields + normalized amounts for performance)
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY,
          bookId TEXT NOT NULL,
          amount REAL NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          normalizedAmount REAL,
          normalizedCurrency TEXT,
          conversionRate REAL,
          date TEXT NOT NULL,
          party TEXT,
          category TEXT NOT NULL,
          paymentMode TEXT NOT NULL,
          remarks TEXT,
          attachmentUrl TEXT,
          attachmentName TEXT,
          historicalRates TEXT,
          conversionHistory TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          userId TEXT NOT NULL,
          FOREIGN KEY (bookId) REFERENCES books (id) ON DELETE CASCADE
        );
      `);

      // Create indexes for better performance
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_entries_bookId ON entries(bookId);
        CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
        CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category);
        CREATE INDEX IF NOT EXISTS idx_entries_currency ON entries(currency);
        CREATE INDEX IF NOT EXISTS idx_entries_normalizedCurrency ON entries(normalizedCurrency);
        CREATE INDEX IF NOT EXISTS idx_books_userId ON books(userId);
        CREATE INDEX IF NOT EXISTS idx_books_currency ON books(currency);
        CREATE INDEX IF NOT EXISTS idx_categories_userId ON categories(userId);
        CREATE INDEX IF NOT EXISTS idx_entries_userId ON entries(userId);
      `);
      
      console.log('Tables created successfully');
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  /**
   * Migrate existing data from old schema to new multi-currency schema
   * This handles backward compatibility for users upgrading from old version
   */
  private async migrateExistingData(): Promise<void> {
    if (!this.db) return;

    try {
      console.log('🔄 Checking if migration is needed...');

      // Check if migration has already been done
      const migrationCheck = await this.db.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='migration_log'"
      );

      if (!migrationCheck) {
        await this.db.execAsync(`
          CREATE TABLE IF NOT EXISTS migration_log (
            id TEXT PRIMARY KEY,
            migration_name TEXT NOT NULL,
            executed_at TEXT NOT NULL
          );
        `);
      }

      const alreadyMigrated = await this.db.getFirstAsync(
        "SELECT id FROM migration_log WHERE migration_name = 'multi_currency_v1'"
      );

      if (alreadyMigrated) {
        console.log('✅ Migration already completed, skipping');
        return;
      }

      console.log('🚀 Running multi-currency migration...');

      // Check if tables exist before trying to alter them
      const booksTableExists = await this.db.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='books'"
      );
      
      const entriesTableExists = await this.db.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='entries'"
      );

      if (!booksTableExists && !entriesTableExists) {
        console.log('✓ Fresh install, no migration needed');
        // Mark as migrated so we don't run this again
        await this.db.runAsync(
          "INSERT INTO migration_log (id, migration_name, executed_at) VALUES (?, ?, ?)",
          [`mig_${Date.now()}`, 'multi_currency_v1', new Date().toISOString()]
        );
        return;
      }

      // Step 1: Add currency column to books if it doesn't exist
      if (booksTableExists) {
        try {
          await this.db.execAsync(`
            ALTER TABLE books ADD COLUMN currency TEXT DEFAULT 'INR';
          `);
          console.log('✓ Added currency column to books');
        } catch (e: any) {
          if (!e.message?.includes('duplicate column name')) {
            throw e;
          }
          console.log('✓ Currency column already exists in books');
        }
      }

      // Step 2: Add currencyHistory column to books
      if (booksTableExists) {
        try {
          await this.db.execAsync(`
            ALTER TABLE books ADD COLUMN currencyHistory TEXT;
          `);
          console.log('✓ Added currencyHistory column to books');
        } catch (e: any) {
          if (!e.message?.includes('duplicate column name')) {
            throw e;
          }
        }
      }

      // Step 3: Add currency column to entries
      if (entriesTableExists) {
        try {
          await this.db.execAsync(`
            ALTER TABLE entries ADD COLUMN currency TEXT DEFAULT 'INR';
          `);
          console.log('✓ Added currency column to entries');
        } catch (e: any) {
          if (!e.message?.includes('duplicate column name')) {
            throw e;
          }
        }
      }

      // Step 4: Add historicalRates column to entries
      if (entriesTableExists) {
        try {
          await this.db.execAsync(`
            ALTER TABLE entries ADD COLUMN historicalRates TEXT;
          `);
          console.log('✓ Added historicalRates column to entries');
        } catch (e: any) {
          if (!e.message?.includes('duplicate column name')) {
            throw e;
          }
        }
      }

      // Step 5: Add conversionHistory column to entries
      if (entriesTableExists) {
        try {
          await this.db.execAsync(`
            ALTER TABLE entries ADD COLUMN conversionHistory TEXT;
          `);
          console.log('✓ Added conversionHistory column to entries');
        } catch (e: any) {
          if (!e.message?.includes('duplicate column name')) {
            throw e;
          }
        }
      }

      // Step 6: Update existing books to have currency = 'INR' (old default)
      if (booksTableExists) {
        await this.db.runAsync(`
          UPDATE books SET currency = 'INR' WHERE currency IS NULL OR currency = '';
        `);
        console.log('✓ Updated existing books with INR currency');
      }

      // Step 7: Update existing entries to have currency = 'INR'
      if (entriesTableExists) {
        await this.db.runAsync(`
          UPDATE entries SET currency = 'INR' WHERE currency IS NULL OR currency = '';
        `);
        console.log('✓ Updated existing entries with INR currency');
      }

      // Step 8: Remove old originalCurrency, originalAmount, exchangeRate columns
      // Note: SQLite doesn't support DROP COLUMN easily, so we'll leave them for now
      // They won't interfere with new system

      // Record migration completion
      await this.db.runAsync(
        "INSERT INTO migration_log (id, migration_name, executed_at) VALUES (?, ?, ?)",
        [`mig_${Date.now()}`, 'multi_currency_v1', new Date().toISOString()]
      );

      console.log('✅ Multi-currency migration completed successfully!');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  // NEW: Migration for locked exchange rate fields
  private async migrateLockedExchangeRate(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const alreadyMigrated = await this.db.getFirstAsync(
        "SELECT id FROM migration_log WHERE migration_name = 'locked_exchange_rate_v1'"
      );

      if (alreadyMigrated) {
        console.log('✅ Locked exchange rate migration already completed, skipping');
        return;
      }

      console.log('🚀 Running locked exchange rate migration...');

      const booksTableExists = await this.db.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='books'"
      );

      if (!booksTableExists) {
        console.log('✓ Fresh install, no migration needed');
        await this.db.runAsync(
          "INSERT INTO migration_log (id, migration_name, executed_at) VALUES (?, ?, ?)",
          [`mig_${Date.now()}`, 'locked_exchange_rate_v1', new Date().toISOString()]
        );
        return;
      }

      // Add lockedExchangeRate column
      try {
        await this.db.execAsync(`
          ALTER TABLE books ADD COLUMN lockedExchangeRate REAL;
        `);
        console.log('✓ Added lockedExchangeRate column to books');
      } catch (e: any) {
        if (!e.message?.includes('duplicate column name')) {
          throw e;
        }
      }

      // Add targetCurrency column
      try {
        await this.db.execAsync(`
          ALTER TABLE books ADD COLUMN targetCurrency TEXT;
        `);
        console.log('✓ Added targetCurrency column to books');
      } catch (e: any) {
        if (!e.message?.includes('duplicate column name')) {
          throw e;
        }
      }

      // Add rateLockedAt column
      try {
        await this.db.execAsync(`
          ALTER TABLE books ADD COLUMN rateLockedAt TEXT;
        `);
        console.log('✓ Added rateLockedAt column to books');
      } catch (e: any) {
        if (!e.message?.includes('duplicate column name')) {
          throw e;
        }
      }

      // Record migration completion
      await this.db.runAsync(
        "INSERT INTO migration_log (id, migration_name, executed_at) VALUES (?, ?, ?)",
        [`mig_${Date.now()}`, 'locked_exchange_rate_v1', new Date().toISOString()]
      );

      console.log('✅ Locked exchange rate migration completed successfully!');
    } catch (error) {
      console.error('❌ Error during migration:', error);
      // Don't throw - allow app to continue even if migration fails
    }
  }

  // NEW: Migration for normalized amounts (performance optimization)
  private async migrateNormalizedAmounts(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const alreadyMigrated = await this.db.getFirstAsync(
        "SELECT id FROM migration_log WHERE migration_name = 'normalized_amounts_v1'"
      );

      if (alreadyMigrated) {
        console.log('✅ Normalized amounts migration already completed, skipping');
        return;
      }

      console.log('🚀 Running normalized amounts migration...');

      const entriesTableExists = await this.db.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='entries'"
      );

      if (!entriesTableExists) {
        console.log('✓ Fresh install, no migration needed');
        await this.db.runAsync(
          "INSERT INTO migration_log (id, migration_name, executed_at) VALUES (?, ?, ?)",
          [`mig_${Date.now()}`, 'normalized_amounts_v1', new Date().toISOString()]
        );
        return;
      }

      // Add normalized amount columns to entries
      try {
        await this.db.execAsync(`
          ALTER TABLE entries ADD COLUMN normalizedAmount REAL;
        `);
        console.log('✓ Added normalizedAmount column to entries');
      } catch (e: any) {
        if (!e.message?.includes('duplicate column name')) {
          throw e;
        }
      }

      try {
        await this.db.execAsync(`
          ALTER TABLE entries ADD COLUMN normalizedCurrency TEXT;
        `);
        console.log('✓ Added normalizedCurrency column to entries');
      } catch (e: any) {
        if (!e.message?.includes('duplicate column name')) {
          throw e;
        }
      }

      try {
        await this.db.execAsync(`
          ALTER TABLE entries ADD COLUMN conversionRate REAL;
        `);
        console.log('✓ Added conversionRate column to entries');
      } catch (e: any) {
        if (!e.message?.includes('duplicate column name')) {
          throw e;
        }
      }

      // Populate normalized amounts for existing entries
      console.log('🔄 Populating normalized amounts for existing entries...');
      
      // Get all entries with their book info
      const entries = await this.db.getAllAsync<any>(`
        SELECT e.id, e.amount, e.currency, e.bookId, e.userId,
               b.lockedExchangeRate, b.targetCurrency
        FROM entries e
        LEFT JOIN books b ON e.bookId = b.id
        WHERE e.normalizedAmount IS NULL
      `);

      console.log(`📊 Found ${entries.length} entries to normalize`);

      // Import services dynamically to avoid circular dependency
      const currencyServiceModule = await import('./currencyService');
      const currencyService = currencyServiceModule.default;
      
      const preferencesModule = await import('./preferences');
      const preferencesService = preferencesModule.default;

      let updated = 0;
      let failed = 0;

      for (const entry of entries) {
        try {
          // Get user's default currency
          const currencyPrefs = await preferencesService.getCurrency();
          const userDefaultCurrency = currencyPrefs.code;
          
          // If entry is already in user's default currency, no conversion needed
          if (entry.currency === userDefaultCurrency) {
            await this.db.runAsync(
              `UPDATE entries 
               SET normalizedAmount = ?, 
                   normalizedCurrency = ?, 
                   conversionRate = 1.0
               WHERE id = ?`,
              [entry.amount, userDefaultCurrency, entry.id]
            );
            updated++;
            continue;
          }

          // Try to get exchange rate
          let rate = 1.0;
          
          // Priority 1: Book's locked rate
          if (entry.lockedExchangeRate && entry.targetCurrency === userDefaultCurrency) {
            rate = entry.lockedExchangeRate;
          } else {
            // Priority 2: Get rate from currencyService (custom or API)
            try {
              const fetchedRate = await currencyService.getExchangeRate(
                entry.currency,
                userDefaultCurrency,
                entry.bookId
              );
              if (fetchedRate !== null) {
                rate = fetchedRate;
              } else {
                console.warn(`⚠️ Could not get rate for ${entry.currency} → ${userDefaultCurrency}, using 1.0`);
              }
            } catch (rateError) {
              console.warn(`⚠️ Error getting rate for ${entry.currency} → ${userDefaultCurrency}, using 1.0`);
              rate = 1.0;
            }
          }

          const normalizedAmount = entry.amount * rate;

          await this.db.runAsync(
            `UPDATE entries 
             SET normalizedAmount = ?, 
                 normalizedCurrency = ?, 
                 conversionRate = ?
             WHERE id = ?`,
            [normalizedAmount, userDefaultCurrency, rate, entry.id]
          );
          
          updated++;
        } catch (error) {
          console.error(`❌ Failed to normalize entry ${entry.id}:`, error);
          failed++;
        }
      }

      console.log(`✅ Updated ${updated} entries, ${failed} failed`);

      // Mark migration as complete
      await this.db.runAsync(
        "INSERT INTO migration_log (id, migration_name, executed_at) VALUES (?, ?, ?)",
        [`mig_${Date.now()}`, 'normalized_amounts_v1', new Date().toISOString()]
      );

      console.log('✅ Normalized amounts migration completed successfully!');
    } catch (error) {
      console.error('❌ Error during normalized amounts migration:', error);
      // Don't throw - allow app to continue even if migration fails
    }
  }

  private async seedDefaultCategories(): Promise<void> {
    if (!this.db) return;

    try {
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

      for (const categoryName of defaultCategories) {
        try {
          const exists = await this.db.getFirstAsync(
            'SELECT id FROM categories WHERE name = ? AND userId = ?',
            [categoryName, 'default']
          );

          if (!exists) {
            await this.db.runAsync(
              'INSERT INTO categories (id, name, description, userId, createdAt) VALUES (?, ?, ?, ?, ?)',
              [
                `default_${categoryName.toLowerCase().replace(/\s+/g, '_')}`,
                categoryName,
                null,
                'default',
                new Date().toISOString()
              ]
            );
          }
        } catch (error) {
          console.error(`Error seeding category ${categoryName}:`, error);
          // Continue with other categories
        }
      }
      
      console.log('Default categories seeded successfully');
    } catch (error) {
      console.error('Error in seedDefaultCategories:', error);
      throw error;
    }
  }

  // Book operations
  async createBook(book: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>): Promise<Book> {
    if (!this.db) throw new Error('Database not initialized');

    const id = `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const currencyHistory = book.currencyHistory ? JSON.stringify(book.currencyHistory) : null;

    await this.db.runAsync(
      'INSERT INTO books (id, name, description, currency, currencyHistory, createdAt, updatedAt, userId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, book.name, book.description || '', book.currency, currencyHistory, now, now, book.userId]
    );

    return {
      id,
      ...book,
      currencyHistory: book.currencyHistory || [],
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };
  }

  async getBooks(userId: string): Promise<Book[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      console.log('Fetching books for user:', userId);
      const books = await this.db.getAllAsync(
        'SELECT * FROM books WHERE userId = ? ORDER BY createdAt DESC',
        [userId]
      ) as BookEntity[];

      console.log('Retrieved books:', books.length);
      return books.map(this.mapBookEntityToBook);
    } catch (error) {
      console.error('Error in getBooks:', error);
      throw error;
    }
  }

  async updateBook(bookId: string, updates: Partial<Omit<Book, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    
    // Serialize arrays and convert Dates to ISO strings
    const values = Object.values(updates).map(value => {
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    });
    
    values.push(now, bookId);

    await this.db.runAsync(
      `UPDATE books SET ${fields}, updatedAt = ? WHERE id = ?`,
      values
    );
  }

  async deleteBook(bookId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Delete entries first (cascade should handle this, but being explicit)
    await this.db.runAsync('DELETE FROM entries WHERE bookId = ?', [bookId]);
    await this.db.runAsync('DELETE FROM books WHERE id = ?', [bookId]);
  }

  // Entry operations
  async createEntry(entry: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entry> {
    if (!this.db) throw new Error('Database not initialized');

    const id = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const historicalRates = entry.historicalRates ? JSON.stringify(entry.historicalRates) : null;
    const conversionHistory = entry.conversionHistory ? JSON.stringify(entry.conversionHistory) : null;

    await this.db.runAsync(
      `INSERT INTO entries (
        id, bookId, amount, currency, date, party, category, paymentMode, 
        remarks, attachmentUrl, attachmentName, historicalRates, conversionHistory,
        createdAt, updatedAt, userId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        entry.bookId,
        entry.amount,
        entry.currency,
        entry.date.toISOString(),
        entry.party || '',
        entry.category,
        entry.paymentMode,
        entry.remarks || '',
        entry.attachmentUrl || '',
        entry.attachmentName || '',
        historicalRates,
        conversionHistory,
        now,
        now,
        entry.userId
      ]
    );

    return {
      id,
      ...entry,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };
  }

  async getEntries(bookId: string, limit?: number): Promise<Entry[]> {
    if (!this.db) throw new Error('Database not initialized');

    const limitClause = limit ? `LIMIT ${limit}` : '';
    const entries = await this.db.getAllAsync(
      `SELECT * FROM entries WHERE bookId = ? ORDER BY date DESC, createdAt DESC ${limitClause}`,
      [bookId]
    ) as EntryEntity[];

    return entries.map(this.mapEntryEntityToEntry);
  }

  async updateEntry(entryId: string, updates: Partial<Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const updateFields = Object.keys(updates).filter(key => updates[key as keyof typeof updates] !== undefined);
    
    if (updateFields.length === 0) return;

    const fields = updateFields.map(key => `${key} = ?`).join(', ');
    const values: any[] = updateFields.map(key => {
      const value = updates[key as keyof typeof updates];
      if (value instanceof Date) {
        return value.toISOString();
      }
      // Serialize objects/arrays to JSON
      if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
      }
      return value !== undefined ? value : '';
    });
    values.push(now, entryId);

    await this.db.runAsync(
      `UPDATE entries SET ${fields}, updatedAt = ? WHERE id = ?`,
      values
    );
  }

  async deleteEntry(entryId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync('DELETE FROM entries WHERE id = ?', [entryId]);
  }

  // Category operations
  async getCategories(userId: string): Promise<Category[]> {
    if (!this.db) throw new Error('Database not initialized');

    const categories = await this.db.getAllAsync(
      'SELECT * FROM categories WHERE userId = ? OR userId = ? ORDER BY name',
      [userId, 'default']
    ) as CategoryEntity[];

    return categories.map(this.mapCategoryEntityToCategory);
  }

  async createCategory(category: Omit<Category, 'id' | 'createdAt'>): Promise<Category> {
    if (!this.db) throw new Error('Database not initialized');

    const id = `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await this.db.runAsync(
      'INSERT INTO categories (id, name, description, color, icon, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, category.name, category.description || null, category.color || '', category.icon || '', category.userId, now]
    );

    return {
      id,
      ...category,
      createdAt: new Date(now)
    };
  }

  // Helper methods for mapping entities to models
  private mapBookEntityToBook(entity: BookEntity): Book {
    let currencyHistory: BookCurrencyHistory[] = [];
    
    if (entity.currencyHistory) {
      try {
        const parsed = JSON.parse(entity.currencyHistory);
        currencyHistory = parsed.map((h: any) => ({
          ...h,
          changedAt: new Date(h.changedAt)
        }));
      } catch (e) {
        console.error('Error parsing currencyHistory:', e);
      }
    }
    
    return {
      ...entity,
      currencyHistory,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt)
    };
  }

  private mapEntryEntityToEntry(entity: EntryEntity): Entry {
    let historicalRates: HistoricalRatesSnapshot | undefined;
    let conversionHistory: ConversionHistoryEntry[] | undefined;
    
    if (entity.historicalRates) {
      try {
        const parsed = JSON.parse(entity.historicalRates);
        historicalRates = {
          ...parsed,
          capturedAt: new Date(parsed.capturedAt)
        };
      } catch (e) {
        console.error('Error parsing historicalRates:', e);
      }
    }
    
    if (entity.conversionHistory) {
      try {
        const parsed = JSON.parse(entity.conversionHistory);
        conversionHistory = parsed.map((c: any) => ({
          ...c,
          convertedAt: new Date(c.convertedAt)
        }));
      } catch (e) {
        console.error('Error parsing conversionHistory:', e);
      }
    }
    
    return {
      ...entity,
      historicalRates,
      conversionHistory,
      date: new Date(entity.date),
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt)
    };
  }

  private mapCategoryEntityToCategory(entity: CategoryEntity): Category {
    return {
      ...entity,
      createdAt: new Date(entity.createdAt)
    };
  }

  // Migration: Assign existing data to a user
  async assignExistingDataToUser(userId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      console.log('🔄 Starting data migration for user:', userId);
      
      // Check if migration is needed by checking for records without userId
      const orphanedBooks = await this.db.getAllAsync<any>(
        'SELECT id FROM books WHERE userId IS NULL OR userId = ""'
      );
      
      const orphanedEntries = await this.db.getAllAsync<any>(
        'SELECT id FROM entries WHERE userId IS NULL OR userId = ""'
      );
      
      const orphanedCategories = await this.db.getAllAsync<any>(
        'SELECT id FROM categories WHERE userId IS NULL OR userId = "" AND userId != "default"'
      );

      if (orphanedBooks.length === 0 && orphanedEntries.length === 0 && orphanedCategories.length === 0) {
        console.log('✅ No orphaned data found, migration not needed');
        return;
      }

      console.log('📊 Found orphaned data:');
      console.log('  Books:', orphanedBooks.length);
      console.log('  Entries:', orphanedEntries.length);
      console.log('  Categories:', orphanedCategories.length);

      // Update books
      if (orphanedBooks.length > 0) {
        await this.db.runAsync(
          'UPDATE books SET userId = ? WHERE userId IS NULL OR userId = ""',
          [userId]
        );
        console.log('✅ Updated', orphanedBooks.length, 'books');
      }

      // Update entries
      if (orphanedEntries.length > 0) {
        await this.db.runAsync(
          'UPDATE entries SET userId = ? WHERE userId IS NULL OR userId = ""',
          [userId]
        );
        console.log('✅ Updated', orphanedEntries.length, 'entries');
      }

      // Update categories (but not default ones)
      if (orphanedCategories.length > 0) {
        await this.db.runAsync(
          'UPDATE categories SET userId = ? WHERE (userId IS NULL OR userId = "") AND userId != "default"',
          [userId]
        );
        console.log('✅ Updated', orphanedCategories.length, 'categories');
      }

      console.log('✅ Data migration completed successfully');
    } catch (error) {
      console.error('❌ Error during data migration:', error);
      throw error;
    }
  }

  // Clean up
  async closeDatabase(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

export const databaseService = new DatabaseService();
export default databaseService;