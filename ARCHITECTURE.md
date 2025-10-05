# Multi-Currency Expense Tracker - Complete Architecture

## 🎯 Core Concept

**Problem to Solve:** Track expenses across multiple currencies while maintaining accuracy and providing meaningful analytics in a single currency.

**Solution:** Book-based currency system with locked exchange rates and hybrid storage for performance.

---

## 📚 Data Model Hierarchy

```
User (Firebase Auth)
  └── Books (Multiple)
       ├── Currency: SGD, INR, USD, etc.
       ├── Locked Exchange Rate (captured at creation)
       └── Entries (Multiple)
            ├── Amount (in book's currency)
            ├── NormalizedAmount (pre-converted to user default)
            └── Category, Date, Party, etc.
```

### Key Entities

#### 1. **User**
- Firebase Authentication
- Has a **default currency** preference (e.g., INR)
- Can have multiple books in different currencies

#### 2. **Book**
```typescript
{
  id: "book_123",
  name: "Singapore Trip",
  currency: "SGD",                    // Book's native currency
  lockedExchangeRate: 54.31,          // SGD → INR rate at creation
  targetCurrency: "INR",              // User's default at creation
  rateLockedAt: "2025-10-01",         // When rate was locked
  userId: "user_456"
}
```

**Why books?**
- Real-world use case: Different trips/projects in different currencies
- Example: "Singapore Trip" (SGD), "India Expenses" (INR), "US Business" (USD)

#### 3. **Entry**
```typescript
{
  id: "entry_789",
  bookId: "book_123",
  amount: -100,                        // Original amount in book currency (SGD)
  currency: "SGD",                     // Inherits from book
  
  // PERFORMANCE: Pre-converted amounts (hybrid storage)
  normalizedAmount: -5431,             // Pre-converted to user default (INR)
  normalizedCurrency: "INR",           // User's default at creation
  conversionRate: 54.31,               // Rate used (from book's locked rate)
  
  // Entry details
  category: "Food & Dining",
  date: "2025-10-05",
  party: "Restaurant ABC",
  paymentMode: "credit_card",
  remarks: "Team dinner",
  
  // Historical data
  historicalRates: {...},              // All rates at entry creation time
  
  userId: "user_456"
}
```

---

## 💱 Exchange Rate System

### Rate Priority (Critical!)

When converting currency, the system checks in this order:

```
1. Book Locked Rate (highest priority)
   ↓ (if not available)
2. Custom Rate (manual override)
   ↓ (if not available)
3. API Rate (live rate, cached 30min)
```

### Why Locked Rates?

**Problem:** Exchange rates change daily. If you spent 100 SGD when rate was 54, but later the rate is 55, your historical expenses would show incorrect values.

**Solution:** Lock the exchange rate at book creation time.

```
Book created: Oct 1, 2025, SGD → INR = 54.31 (locked)
Entry 1 (Oct 2): -100 SGD × 54.31 = -5431 INR
Entry 2 (Oct 5): -50 SGD × 54.31 = -2715.50 INR

Even if live rate changes to 55, your entries remain consistent!
```

### Rate Sources

#### 1. **API Rates** (exchangerate-api.com)
- Live rates fetched from external API
- Cached for 30 minutes to reduce API calls
- Used as fallback when no custom/locked rate exists

#### 2. **Custom Rates** (Manual Override)
- User can manually set rate (e.g., "I got 55 at exchange counter")
- Stored in AsyncStorage per currency pair
- Can be cleared to revert to API rate

#### 3. **Locked Rates** (Book-Specific)
- Captured when book is created
- Immutable unless manually edited
- Ensures historical consistency

---

## 🚀 Hybrid Storage Architecture (Performance Optimization)

### The Problem
```typescript
// OLD APPROACH (SLOW)
Analytics loads → Loop through 1000 entries → Convert each one
Entry 1: 100 SGD → Fetch rate → Convert to INR
Entry 2: 50 USD → Fetch rate → Convert to INR
Entry 3: 200 EUR → Fetch rate → Convert to INR
... (takes 2-5 seconds with many entries)
```

### The Solution: Hybrid Storage
Store **both** original and converted amounts!

```typescript
{
  amount: 100,              // Original (SGD) - for book detail view
  currency: "SGD",
  
  normalizedAmount: 5431,   // Pre-converted (INR) - for analytics
  normalizedCurrency: "INR",
  conversionRate: 54.31
}
```

### Benefits

✅ **Accuracy:** Original amount preserved in book currency
✅ **Performance:** Analytics uses normalized amount (no conversion needed)
✅ **Auditability:** Conversion rate stored for transparency
✅ **Consistency:** Uses book's locked rate at conversion time

### When Conversion Happens

```
Entry Creation:
  User enters: 100 SGD
  ↓
  Get book's locked rate: 54.31
  ↓
  Calculate: 100 × 54.31 = 5431 INR
  ↓
  Save both:
    - amount: 100 (original)
    - normalizedAmount: 5431 (converted)

Analytics Query:
  Load entries
  ↓
  Use normalizedAmount directly (instant!)
  ↓
  Sum: 5431 + 2715.50 + ... = Total
```

---

## 🏗️ System Architecture

### Layer 1: Data Storage

```
SQLite (expo-sqlite)                AsyncStorage
├── users                           ├── books
├── books                           ├── entries
├── entries                         ├── categories
├── categories                      └── custom_exchange_rates
└── migration_log
```

**Why both?**
- **SQLite:** Complex queries, relationships, migrations
- **AsyncStorage:** Simple key-value storage, quick access

### Layer 2: Services

#### **currencyService.ts**
- Fetches exchange rates from API
- Manages custom rates
- Implements rate priority logic
- Returns locked rate if available

```typescript
getExchangeRate(from, to, bookId?)
  → Checks book locked rate first
  → Falls back to custom rate
  → Falls back to API rate
```

#### **asyncStorage.ts**
- CRUD operations for books/entries
- Wraps AsyncStorage with typed interfaces
- Handles JSON serialization

#### **database.ts**
- SQLite database management
- Schema creation and migrations
- Indexes for performance

#### **preferences.ts**
- User settings (default currency, theme, etc.)
- Persisted in AsyncStorage

### Layer 3: Utils

#### **currencyUtils.ts**
- Currency conversion functions
- Book summary calculations
- Formatting utilities

#### **chartUtils.ts**
- Data processing for charts
- Category grouping
- Time-based aggregations

### Layer 4: UI Components

```
Screens/
├── LoginScreen          → Firebase auth
├── DashboardScreen      → Overview of all books
├── BooksScreen          → List of books
├── BookDetailScreen     → Single book details
├── AddBookScreen        → Create book + lock exchange rate
├── AddEntryScreen       → Create entry + calculate normalized amount
├── EditEntryScreen      → Edit entry + recalculate normalized amount
├── AnalyticsScreen      → Charts & insights (uses normalized amounts)
└── SettingsScreen       → User preferences

Components/
├── CurrencyPicker       → Select currency
├── ExchangeRateEditor   → View/edit book's exchange rate
└── Charts               → Visualization components
```

---

## 🔄 Data Flow Examples

### Example 1: Creating a Book

```
User: "Create Singapore Trip book in SGD"
  ↓
AddBookScreen:
  1. User selects SGD as book currency
  2. App fetches SGD → INR rate: 54.31
  3. User can edit rate if needed (e.g., got 55 at exchange)
  4. User clicks "Create Book"
  ↓
Save to AsyncStorage:
  {
    name: "Singapore Trip",
    currency: "SGD",
    lockedExchangeRate: 54.31,      ← Locked!
    targetCurrency: "INR",
    rateLockedAt: "2025-10-01"
  }
```

### Example 2: Adding an Entry

```
User: "Add ₹-100 SGD expense for Restaurant"
  ↓
AddEntryScreen:
  1. Amount: -100
  2. Category: "Food & Dining"
  3. Book: "Singapore Trip" (SGD)
  ↓
Calculate Normalized Amount:
  - Get book's locked rate: 54.31
  - Convert: -100 × 54.31 = -5431 INR
  - Capture historical rates (all currencies)
  ↓
Save to AsyncStorage:
  {
    amount: -100,
    currency: "SGD",
    normalizedAmount: -5431,        ← Pre-converted!
    normalizedCurrency: "INR",
    conversionRate: 54.31,
    category: "Food & Dining",
    historicalRates: {...}
  }
```

### Example 3: Dashboard Aggregation

```
DashboardScreen Load:
  ↓
Load all books:
  - Singapore Trip (SGD): 10 entries
  - India Expenses (INR): 50 entries
  - US Business (USD): 20 entries
  ↓
For each book:
  Load entries → Use normalizedAmount
  ↓
  Singapore Trip:
    Sum normalizedAmounts: -5431 + -2715.50 + ... = -15000 INR
  
  India Expenses:
    Sum normalizedAmounts: -500 + -1000 + ... = -10000 INR
  
  US Business:
    Sum normalizedAmounts: -6885 + -4130 + ... = -25000 INR
  ↓
Total: -50000 INR (instant calculation!)
```

### Example 4: Analytics by Category

```
AnalyticsScreen Load:
  ↓
Load all entries from all books
  ↓
Group by category (using normalizedAmount):
  Food & Dining: -15000 INR
  Transportation: -8000 INR
  Shopping: -12000 INR
  ...
  ↓
Display chart (instant - no conversion needed!)
```

---

## 🔐 Key Design Decisions

### 1. **Book-Level Currency (Not Entry-Level)**
**Why?** Real-world trips/projects are typically in one currency. Entries inherit book's currency for consistency.

**Alternative considered:** Entry-level currency (each entry can be different)
**Why rejected:** Too complex, leads to confusion about "which currency am I tracking?"

### 2. **Locked Exchange Rates**
**Why?** Historical accuracy. Your October expenses should always show the same INR value.

**Alternative considered:** Always use live rates
**Why rejected:** Historical data would change every time rates fluctuate

### 3. **Hybrid Storage (Original + Normalized)**
**Why?** Performance without sacrificing accuracy.

**Alternative considered:** Only store original amounts
**Why rejected:** Analytics too slow with many entries

### 4. **Three-Tier Rate Priority**
**Why?** Flexibility + Consistency
- Locked: For historical accuracy
- Custom: For user control (e.g., "I got better rate at exchange")
- API: For convenience

---

## 📊 Database Schema

### Books Table
```sql
CREATE TABLE books (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT DEFAULT 'INR',
  currencyHistory TEXT,              -- JSON array of currency changes
  lockedExchangeRate REAL,           -- Locked rate at creation
  targetCurrency TEXT,               -- User's default currency
  rateLockedAt TEXT,                 -- ISO timestamp
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL
);
```

### Entries Table
```sql
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  bookId TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'INR',
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  party TEXT,
  paymentMode TEXT,
  remarks TEXT,
  historicalRates TEXT,              -- JSON of rates at creation
  conversionHistory TEXT,            -- JSON of conversion history
  normalizedAmount REAL,             -- Pre-converted amount
  normalizedCurrency TEXT,           -- User's default currency
  conversionRate REAL,               -- Rate used for conversion
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL
);

CREATE INDEX idx_entries_normalizedCurrency ON entries(normalizedCurrency);
```

---

## 🔄 Migration Strategy

The app uses migrations to handle schema changes:

```typescript
migration_log table:
  - Tracks which migrations have run
  - Prevents duplicate execution

Migrations:
  1. multi_currency_v1         → Added currency fields
  2. locked_exchange_rate_v1   → Added locked rate fields
  3. normalized_amounts_v1     → Added normalized amount fields
```

When app starts:
```
1. Check migration_log
2. Run pending migrations
3. Populate data for new columns
4. Mark migration as complete
```

---

## 🎨 User Experience Flow

### First Time User
```
1. Login with Firebase → LoginScreen
2. No books yet → Shows empty state
3. Clicks "Add Book" → AddBookScreen
   - Enters "Singapore Trip"
   - Selects SGD
   - Sees exchange rate: SGD → INR = 54.31
   - (Optional) Edits rate
   - Creates book
4. Dashboard shows new book (0 entries)
5. Clicks "Add Entry" → AddEntryScreen
   - Enters amount: -100
   - Selects category: "Food & Dining"
   - Saves entry
6. Dashboard updates: Shows -5431 INR
7. Can view analytics, charts, etc.
```

### Multi-Currency User
```
User has:
- Singapore Trip (SGD): -15000 INR equivalent
- India Expenses (INR): -10000 INR
- US Business (USD): -25000 INR equivalent

Dashboard:
  Total: -50000 INR (aggregated across all currencies)

Analytics:
  - By category (all in INR)
  - By time period (all in INR)
  - By book (shows each book's currency + INR equivalent)
```

---

## 🚀 Performance Optimizations

### 1. **Normalized Amounts**
- Pre-convert at entry creation
- Analytics loads instantly (no conversion loop)

### 2. **Exchange Rate Caching**
- API rates cached 30 minutes
- Reduces API calls
- Faster rate lookups

### 3. **Database Indexes**
- `idx_entries_normalizedCurrency` for fast filtering
- `idx_books_currency` for book queries
- `idx_entries_userId` for user-specific queries

### 4. **Memoization**
- React hooks (useMemo, useCallback) prevent unnecessary re-renders
- Currency formatting cached in useCurrency hook

---

## 🔮 Future Enhancements

1. **Multi-user books** - Share books with other users
2. **Currency migration** - Change book currency with bulk conversion
3. **Budget tracking** - Set budgets per category
4. **Export data** - CSV/PDF export with proper currency display
5. **Offline sync** - Queue changes and sync when online
6. **Receipt scanning** - OCR to extract amount/currency from receipts

---

## 📝 Summary

**Architecture Philosophy:**
- **Book-centric:** Organize expenses by trips/projects in their native currencies
- **Locked rates:** Historical accuracy through exchange rate locking
- **Hybrid storage:** Performance through pre-conversion without losing original data
- **Three-tier rates:** Flexibility through locked → custom → API priority
- **User-centric:** All aggregations in user's preferred default currency

**Result:** Fast, accurate, multi-currency expense tracking with meaningful analytics! 🎉
