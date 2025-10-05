// Type definitions for the Budget Management app

export interface Book {
  id: string;
  name: string;
  description?: string;
  currency?: string; // Optional - falls back to user's default currency
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface Entry {
  id: string;
  bookId: string;
  amount: number; // Always stored in default currency for calculations
  date: Date;
  party?: string; // Customer/supplier name
  category: string;
  paymentMode: PaymentMode;
  remarks?: string;
  attachmentUrl?: string; // URL to Firebase Storage
  attachmentName?: string;
  
  // Currency tracking fields
  originalCurrency?: string; // Currency user entered (if different from default)
  originalAmount?: number; // Amount in original currency (if different from default)
  exchangeRate?: number; // Rate used for conversion (originalAmount * rate = amount)
  
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  userId: string;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
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
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  entryCount: number;
}

export interface CategorySummary {
  categoryName: string;
  amount: number;
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
export interface BookEntity extends Omit<Book, 'createdAt' | 'updatedAt'> {
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface EntryEntity extends Omit<Entry, 'date' | 'createdAt' | 'updatedAt'> {
  date: string; // ISO string
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface CategoryEntity extends Omit<Category, 'createdAt'> {
  createdAt: string; // ISO string
}