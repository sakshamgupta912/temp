# 💱 Currency Logic Documentation

## Overview

This document explains how currency management works in the Budget Management app, ensuring consistency across books, entries, and analytics.

---

## Architecture Principles

### 1. **Book-Level Currency** 
- Each **Book** has its own **currency** (mandatory field)
- Currency is set when creating a book
- All entries in a book **inherit** the book's currency
- Book currency can be changed (with full audit trail via `currencyHistory`)

### 2. **Entry Currency Inheritance**
- Entries **CANNOT** have a different currency than their parent book
- Entry currency is **read-only** from the user's perspective
- When creating/editing an entry, the book's currency is automatically used
- **Design Rule**: If a book uses GBP, ALL its entries must use GBP

### 3. **User Default Currency**
- Users have a `defaultCurrency` (set at signup, changeable in preferences)
- Used for **dashboard/analytics** - aggregating totals across all books
- Used for **normalized amounts** - pre-converting entries for fast analytics

---

## Implementation Details

### Book Model (`src/models/types.ts`)

```typescript
export interface Book {
  id: string;
  name: string;
  currency: string; // MANDATORY - e.g., 'GBP', 'USD', 'EUR'
  
  // Optional locked exchange rate for conversions
  lockedExchangeRate?: number; // e.g., 1 GBP = 1.27 USD
  targetCurrency?: string; // User's default currency
  rateLockedAt?: Date;
  
  // Track currency changes
  currencyHistory?: BookCurrencyHistory[];
  
  // ... other fields
}
```

### Entry Model

```typescript
export interface Entry {
  id: string;
  bookId: string;
  
  // Amount in BOOK'S currency
  amount: number; // e.g., 1000 GBP
  currency: string; // MUST match book.currency (denormalized for performance)
  
  // PERFORMANCE: Pre-converted amount for fast analytics
  normalizedAmount?: number; // e.g., 1270 USD (1000 × 1.27)
  normalizedCurrency?: string; // User's default currency
  conversionRate?: number; // Rate used for conversion
  
  // Historical rates snapshot
  historicalRates?: HistoricalRatesSnapshot;
  
  // ... other fields
}
```

---

## User Experience

### Creating a New Entry (`AddEntryScreen.tsx`)

**What User Sees**:
```
┌─────────────────────────────┐
│ Add New Entry               │
├─────────────────────────────┤
│ Amount: [1000____]          │
│                             │
│ Book Currency               │
│ ┌─────────────────────────┐ │
│ │   Book Currency         │ │
│ │       GBP               │ │  ← READ-ONLY DISPLAY
│ │ Entries are stored in   │ │
│ │ the book's currency     │ │
│ └─────────────────────────┘ │
│                             │
│ Date: [Oct 15, 2025]        │
│ Category: [Select...]       │
│ ...                         │
└─────────────────────────────┘
```

**Implementation**:
```typescript
// Load book details
const loadBookDetails = async () => {
  const books = await asyncStorageService.getBooks(user!.id);
  const currentBook = books.find(b => b.id === bookId);
  
  if (currentBook) {
    setBookCurrency(currentBook.currency);
    setBookName(currentBook.name);
  }
};

// Create entry with book's currency
const entryData = {
  bookId,
  amount: finalAmount,
  currency: bookCurrency, // ← Inherited from book
  date,
  category,
  // ... other fields
};
```

### Editing an Entry (`EditEntryScreen.tsx`)

**What User Sees**:
```
┌─────────────────────────────┐
│ Edit Entry                  │
├─────────────────────────────┤
│ Amount: [1000____]          │
│                             │
│ Book Currency (Read-only)   │
│ ┌─────────────────────────┐ │
│ │ Book Currency (Read-only)│ │
│ │       GBP               │ │  ← CANNOT CHANGE
│ │ Entry currency cannot be │ │
│ │ changed - it matches the │ │
│ │ book's currency         │ │
│ └─────────────────────────┘ │
│                             │
│ Date: [Oct 15, 2025]        │
│ ...                         │
└─────────────────────────────┘
```

**Implementation**:
```typescript
// Load book details (read-only)
const populateForm = async (entry: Entry) => {
  // ... populate other fields
  
  // Load book's currency
  const books = await asyncStorageService.getBooks(user!.id);
  const currentBook = books.find(b => b.id === entry.bookId);
  
  if (currentBook) {
    setBookCurrency(currentBook.currency); // Read-only
    setBookName(currentBook.name);
  }
};

// Update entry (currency stays the same)
const handleUpdate = async () => {
  const updates: Partial<Entry> = {
    amount: finalAmount,
    date,
    category,
    // ❌ NO currency field - it CANNOT be changed
  };
  
  await asyncStorageService.updateEntry(originalEntry.id, updates);
};
```

---

## Changes Made (Fix)

### Before (BROKEN ❌)

**EditEntryScreen.tsx** incorrectly showed a `CurrencyPicker` that allowed users to change the entry's currency:

```tsx
// ❌ WRONG - Allowed changing currency
<CurrencyPicker
  selectedCurrency={selectedCurrency}
  onCurrencySelect={handleCurrencySelect}
  label="Currency"
  showFlag={true}
/>
```

**Problems**:
1. User could change entry currency independent of book
2. Would break data consistency (entry.currency !== book.currency)
3. Violates the architecture principle
4. Confusing UX - why can I change currency here but not in AddEntry?

### After (FIXED ✅)

**EditEntryScreen.tsx** now shows currency as **read-only**:

```tsx
// ✅ CORRECT - Read-only display
<View style={styles.section}>
  <Surface style={styles.currencyInfoCard} elevation={1}>
    <View style={styles.currencyInfoContent}>
      <Text variant="bodySmall" style={styles.currencyInfoLabel}>
        Book Currency (Read-only)
      </Text>
      <Text variant="titleMedium" style={styles.currencyInfoValue}>
        {bookCurrency}
      </Text>
      <Text variant="bodySmall" style={styles.currencyInfoHelper}>
        Entry currency cannot be changed - it matches the book's currency
      </Text>
    </View>
  </Surface>
</View>
```

**Benefits**:
1. ✅ Consistent with `AddEntryScreen`
2. ✅ Enforces book-entry currency relationship
3. ✅ Clear messaging to user
4. ✅ Prevents data inconsistency

---

## Currency Conversion (Analytics)

### When User Views Dashboard

User has `defaultCurrency: 'USD'` and multiple books:

```
Book 1 (GBP):
  Entry 1: 1000 GBP
  Entry 2: 500 GBP

Book 2 (EUR):
  Entry 3: 200 EUR
  Entry 4: 300 EUR
```

**Conversion Process**:
1. Each entry has `normalizedAmount` pre-calculated at creation:
   ```typescript
   // Entry 1
   normalizedAmount = 1000 × 1.27 = 1270 USD
   
   // Entry 3
   normalizedAmount = 200 × 1.12 = 224 USD
   ```

2. Dashboard aggregates `normalizedAmount`:
   ```typescript
   const totalInUserCurrency = entries
     .map(e => e.normalizedAmount || e.amount)
     .reduce((sum, amt) => sum + amt, 0);
   // Result: 1270 + 635 + 224 + 336 = 2465 USD
   ```

3. **No real-time conversion needed** - all entries already pre-converted!

---

## Changing Book Currency

If a user wants to change a book's currency (e.g., from GBP to USD):

1. Go to Book Settings
2. Click "Change Currency"
3. Select new currency (USD)
4. System:
   - Updates `book.currency = 'USD'`
   - Creates `currencyHistory` entry
   - Optionally converts all entries
   - Updates each entry's `currency` field
   - Adds conversion to entry's `conversionHistory`

**This is a rare operation** - usually done during data migration or audit.

---

## Validation Rules

### AsyncStorage Service (`src/services/asyncStorage.ts`)

```typescript
// Creating a book
async createBook(book: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>) {
  // Validate currency is provided
  if (!book.currency) {
    throw new Error('Book currency is required');
  }
  // ... create book
}

// Creating an entry
async createEntry(entry: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>) {
  // Validate currency is provided
  if (!entry.currency) {
    throw new Error('Entry currency is required (must match book currency)');
  }
  
  // Future enhancement: Validate entry.currency === book.currency
  const book = await this.getBook(entry.bookId);
  if (book && entry.currency !== book.currency) {
    throw new Error(
      `Entry currency (${entry.currency}) must match book currency (${book.currency})`
    );
  }
  
  // ... create entry
}
```

---

## Testing

### Test Case 1: Create Entry

1. Create book "UK Expenses" with currency GBP
2. Add entry to "UK Expenses"
3. **Verify**: Entry currency field shows "GBP" (read-only)
4. **Verify**: Entry is saved with `currency: 'GBP'`

### Test Case 2: Edit Entry

1. Open existing entry in "UK Expenses" book (GBP)
2. Try to change amount
3. **Verify**: Currency field shows "GBP" (read-only)
4. **Verify**: No currency picker available
5. Save entry
6. **Verify**: Entry still has `currency: 'GBP'`

### Test Case 3: Multi-Currency Books

1. Create Book A (USD) with entry: $100
2. Create Book B (EUR) with entry: €50
3. User default currency: INR
4. View dashboard
5. **Verify**: Both entries converted to INR using their normalized amounts

---

## Summary

✅ **Book decides currency** - Each book has one currency  
✅ **Entries inherit** - All entries use their book's currency  
✅ **User sees read-only** - Currency displayed but not editable in entry forms  
✅ **Analytics convert** - Dashboard converts using pre-calculated normalized amounts  
✅ **Consistent UX** - Both AddEntry and EditEntry screens show same read-only currency  

**Design Philosophy**: 
> "A book is like a ledger in a specific currency. All transactions in that ledger use that currency. If you need a different currency, create a new book."

---

## Files Modified

1. **`src/screens/EditEntryScreen.tsx`** ✅
   - Removed `CurrencyPicker` component
   - Added read-only book currency display
   - Updated state management to load book's currency
   - Updated styles with `currencyInfoCard` styles

2. **`src/screens/AddEntryScreen.tsx`** ✅ (Already correct)
   - Already has read-only book currency display
   - Correctly inherits book's currency

---

## Future Enhancements

1. **Book Currency Change Tool**:
   - UI to change a book's currency
   - Automatically convert all entries
   - Create full audit trail

2. **Validation Enhancement**:
   - Add strict validation in `asyncStorage.createEntry()`
   - Reject entries with currency ≠ book currency

3. **Migration Tool**:
   - Tool to fix any existing entries with wrong currency
   - Batch update entries to match their book's currency
