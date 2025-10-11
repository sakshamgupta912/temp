// Type definitions for the Budget Management app

// ==================== USER ====================
export interface User {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  
  // User's default currency for dashboard/global view (set at signup)
  defaultCurrency: string; // e.g., 'USD', 'EUR', 'INR'
  
  createdAt: Date;
}

// ==================== BOOK ====================
export interface Book {
  id: string;
  name: string;
  description?: string;
  
  // Book's currency (mandatory) - all entries in this book use this currency
  currency: string; // e.g., 'GBP', 'USD', 'EUR'
  
  // Locked exchange rate for this book (captured at creation or manually set)
  // This is the rate used for converting this book's totals to user's default currency
  lockedExchangeRate?: number; // e.g., 1 GBP = 1.27 USD
  targetCurrency?: string; // User's default currency at time of lock (e.g., 'USD')
  rateLockedAt?: Date; // When the rate was last locked/updated
  
  // Track currency changes over time (for audit trail)
  currencyHistory?: BookCurrencyHistory[];
  
  // Soft delete support for multi-device sync
  deleted?: boolean; // Tombstone marker: true if deleted, undefined/false if active
  deletedAt?: Date; // When the item was deleted
  
  // Git-style version control (like Git commits)
  version: number; // Increments on each modification (starts at 1)
  lastModifiedBy?: string; // User ID who last modified this item
  lastSyncedVersion?: number; // Version when last synced from cloud (base for 3-way merge)
  
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface BookCurrencyHistory {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
  changedAt: Date;
  changedBy: string; // userId
  affectedEntriesCount: number;
  notes?: string;
}

// ==================== ENTRY ====================
export interface Entry {
  id: string;
  bookId: string;
  
  // Amount stored in BOOK'S currency (not user's default currency)
  amount: number; // e.g., 1000 (in book's currency)
  
  // Currency of this entry (must match book.currency)
  currency: string; // Denormalized for performance
  
  // PERFORMANCE OPTIMIZATION: Pre-converted amount in user's default currency
  // Calculated once at entry creation using book's locked exchange rate
  // Used for fast analytics and dashboard aggregation (no conversion needed)
  normalizedAmount?: number; // e.g., 70000 (amount × locked rate, in user's default currency)
  normalizedCurrency?: string; // User's default currency at time of entry creation
  conversionRate?: number; // Rate used for normalization (for audit trail)
  
  date: Date;
  party?: string; // Customer/supplier name
  category: string;
  paymentMode: PaymentMode;
  remarks?: string;
  attachmentUrl?: string; // URL to Firebase Storage
  attachmentName?: string;
  
  // Historical exchange rates snapshot (captured at entry creation)
  historicalRates?: HistoricalRatesSnapshot;
  
  // Conversion history (if book currency was changed after entry creation)
  conversionHistory?: ConversionHistoryEntry[];
  
  // Soft delete support for multi-device sync
  deleted?: boolean; // Tombstone marker: true if deleted, undefined/false if active
  deletedAt?: Date; // When the item was deleted
  
  // Git-style version control
  version: number; // Increments on each modification
  lastModifiedBy?: string; // User ID who last modified
  lastSyncedVersion?: number; // Base version for 3-way merge
  
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface HistoricalRatesSnapshot {
  capturedAt: Date; // When rates were captured
  baseCurrency: string; // Entry's currency at time of creation
  
  // Exchange rates to major currencies (key: currency code, value: rate)
  rates: {
    [currencyCode: string]: number;
  };
  // Example: { 'USD': 1.1236, 'EUR': 1.0, 'GBP': 0.8632, 'INR': 93.42 }
}

export interface ConversionHistoryEntry {
  id: string;
  fromCurrency: string;
  fromAmount: number;
  toCurrency: string;
  toAmount: number;
  exchangeRate: number;
  convertedAt: Date;
  convertedBy: string; // userId
  reason: ConversionReason;
  notes?: string;
}

export enum ConversionReason {
  BOOK_CURRENCY_CHANGE = 'book_currency_change',
  MANUAL_CORRECTION = 'manual_correction',
  DATA_MIGRATION = 'data_migration',
  AUDIT_ADJUSTMENT = 'audit_adjustment'
}

// ==================== CATEGORY ====================
export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  userId: string;
  
  // Soft delete support for multi-device sync
  deleted?: boolean; // Tombstone marker: true if deleted, undefined/false if active
  deletedAt?: Date; // When the item was deleted
  
  // Git-style version control
  version: number; // Increments on each modification
  lastModifiedBy?: string; // User ID who last modified
  lastSyncedVersion?: number; // Base version for 3-way merge
  
  createdAt: Date;
}

export enum PaymentMode {
  CASH = 'cash',
  UPI = 'upi',
  CARD = 'card',
  NET_BANKING = 'net_banking',
  CHEQUE = 'cheque',
  OTHER = 'other'
}

export interface BookSummary {
  bookId: string;
  bookCurrency: string; // Book's native currency
  
  // Amounts in book's currency
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  entryCount: number;
  
  // Converted amounts (for dashboard display in user's default currency)
  convertedTotalIncome?: number;
  convertedTotalExpenses?: number;
  convertedNetBalance?: number;
  convertedToCurrency?: string; // User's default currency
  conversionRate?: number;
  lastUpdated?: Date; // When conversion was calculated
}

export interface CategorySummary {
  categoryName: string;
  amount: number;
  currency: string; // Currency context
  count: number;
  percentage: number;
}

export interface PendingApproval {
  id: string;
  suggestedCategory: string;
  suggestedBookId: string;
  amount: number;
  date: Date;
  party?: string;
  description: string;
  confidence: number; // AI confidence score
  source: 'sms' | 'manual' | 'import';
  createdAt: Date;
}

// Database entity types (for SQLite)
export interface UserEntity extends Omit<User, 'createdAt'> {
  createdAt: string; // ISO string
}

export interface BookEntity extends Omit<Book, 'createdAt' | 'updatedAt' | 'currencyHistory'> {
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  currencyHistory: string; // JSON stringified array
}

export interface EntryEntity extends Omit<Entry, 'date' | 'createdAt' | 'updatedAt' | 'historicalRates' | 'conversionHistory'> {
  date: string; // ISO string
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  historicalRates: string | null; // JSON stringified
  conversionHistory: string | null; // JSON stringified array
}

export interface CategoryEntity extends Omit<Category, 'createdAt'> {
  createdAt: string; // ISO string
}