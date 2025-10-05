// SQLite database service for local data storage
import * as SQLite from 'expo-sqlite';
import { BookEntity, EntryEntity, CategoryEntity, Book, Entry, Category } from '../models/types';

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
      // Books table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS books (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          userId TEXT NOT NULL
        );
      `);

      // Categories table
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

      // Entries table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY,
          bookId TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          party TEXT,
          category TEXT NOT NULL,
          paymentMode TEXT NOT NULL,
          remarks TEXT,
          attachmentUrl TEXT,
          attachmentName TEXT,
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
        CREATE INDEX IF NOT EXISTS idx_books_userId ON books(userId);
        CREATE INDEX IF NOT EXISTS idx_categories_userId ON categories(userId);
        CREATE INDEX IF NOT EXISTS idx_entries_userId ON entries(userId);
      `);
      
      console.log('Tables created successfully');
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
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

    await this.db.runAsync(
      'INSERT INTO books (id, name, description, createdAt, updatedAt, userId) VALUES (?, ?, ?, ?, ?, ?)',
      [id, book.name, book.description || '', now, now, book.userId]
    );

    return {
      id,
      ...book,
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
    const values = [...Object.values(updates), now, bookId];

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

    await this.db.runAsync(
      `INSERT INTO entries (
        id, bookId, amount, date, party, category, paymentMode, 
        remarks, attachmentUrl, attachmentName, createdAt, updatedAt, userId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        entry.bookId,
        entry.amount,
        entry.date.toISOString(),
        entry.party || '',
        entry.category,
        entry.paymentMode,
        entry.remarks || '',
        entry.attachmentUrl || '',
        entry.attachmentName || '',
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
    const values: (string | number)[] = updateFields.map(key => {
      const value = updates[key as keyof typeof updates];
      if (value instanceof Date) {
        return value.toISOString();
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
    return {
      ...entity,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt)
    };
  }

  private mapEntryEntityToEntry(entity: EntryEntity): Entry {
    return {
      ...entity,
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