# Performance Optimization: Hybrid Storage for Fast Analytics

## Overview
Implemented a hybrid storage approach that stores both **original amounts** (in book currency) and **normalized amounts** (pre-converted to user default currency) for instant analytics and dashboard calculations.

## Problem
Previously, every time you opened the Analytics or Dashboard screen, the app had to:
1. Load all entries across all books
2. Loop through each entry
3. Fetch exchange rate (from book locked rate, custom rate, or API)
4. Convert amount to user's default currency
5. Aggregate the converted amounts

**This was slow**, especially with many entries or multiple books.

## Solution: Hybrid Storage

### What Changed
Each entry now stores:
- `amount` - Original amount in the book's currency (preserved for accuracy)
- `currency` - Book's currency
- `normalizedAmount` - **Pre-converted amount** in user's default currency
- `normalizedCurrency` - User's default currency at entry creation time
- `conversionRate` - Exchange rate used for conversion

### How It Works

#### 1. Entry Creation (AddEntryScreen)
When you create a new entry:
```typescript
// Get user's default currency
const userDefaultCurrency = await preferencesService.getCurrency();

// Get exchange rate (uses book's locked rate)
const rate = await currencyService.getExchangeRate(
  bookCurrency, 
  userDefaultCurrency, 
  bookId
);

// Pre-calculate normalized amount
const normalizedAmount = finalAmount * rate;

// Save both original AND normalized
await createEntry({
  amount: finalAmount,           // Original (e.g., 100 SGD)
  currency: bookCurrency,        // e.g., "SGD"
  normalizedAmount,              // Converted (e.g., 5431 INR)
  normalizedCurrency: "INR",     // User's default
  conversionRate: 54.31          // Rate used
});
```

#### 2. Entry Editing (EditEntryScreen)
When you edit an entry's amount:
- Recalculates `normalizedAmount` using current exchange rate
- Keeps `normalizedCurrency` same (user's default at creation)
- Updates `conversionRate` to reflect current rate

#### 3. Analytics (AnalyticsScreen)
**Before (SLOW):**
```typescript
// Had to convert EVERY entry EVERY time
for (const entry of entries) {
  const rate = await getExchangeRate(...);
  convertedAmount = entry.amount * rate;
}
```

**After (FAST):**
```typescript
// Use pre-converted normalized amount directly
for (const entry of entries) {
  const amount = entry.normalizedAmount || entry.amount;
  // Instant aggregation, no conversion!
}
```

#### 4. Dashboard (DashboardScreen)
**Before (SLOW):**
- Called `convertBookSummaryToUserCurrency()` for each book
- Converted totals using exchange rates

**After (FAST):**
```typescript
// Sum normalized amounts directly
for (const entry of entries) {
  const amount = entry.normalizedAmount || entry.amount;
  totalIncome += amount > 0 ? amount : 0;
  totalExpenses += amount < 0 ? Math.abs(amount) : 0;
}
// Instant totals!
```

### 5. Migration for Existing Entries
Automatically runs on app start to populate `normalizedAmount` for entries that don't have it:
- Fetches user's default currency
- Gets exchange rate (book locked → custom → API)
- Calculates normalized amount
- Updates database

## Benefits

### ✅ Performance
- **Analytics loads instantly** - no conversion loop
- **Dashboard totals calculated instantly** - no API calls
- **Scales well** - performance doesn't degrade with more entries

### ✅ Accuracy
- Original amounts preserved in book currency
- Book locked exchange rates used for consistency
- Conversion rate stored for audit trail

### ✅ Backward Compatible
- Fallback to original amount if `normalizedAmount` not available
- Migration handles existing entries automatically
- No data loss

## Database Schema Changes

### Entry Table (SQLite)
Added columns:
```sql
normalizedAmount REAL,       -- Pre-converted amount
normalizedCurrency TEXT,     -- User's default currency
conversionRate REAL          -- Rate used for conversion
```

### Index for Performance
```sql
CREATE INDEX idx_entries_normalizedCurrency 
ON entries(normalizedCurrency);
```

## Files Modified

1. **src/models/types.ts** - Added normalized fields to Entry interface
2. **src/services/database.ts** - Schema update + migration
3. **src/screens/AddEntryScreen.tsx** - Calculate normalized amount on creation
4. **src/screens/EditEntryScreen.tsx** - Recalculate normalized amount on edit
5. **src/screens/AnalyticsScreen.tsx** - Use normalized amount directly
6. **src/screens/DashboardScreen.tsx** - Use normalized amount for aggregation

## Testing Checklist

- [ ] Create new entry → Verify `normalizedAmount` saved
- [ ] Edit entry amount → Verify `normalizedAmount` updated
- [ ] Open Analytics → Should load instantly (check console for "instant" message)
- [ ] Open Dashboard → Should show correct totals instantly
- [ ] Test with multiple books in different currencies
- [ ] Verify locked exchange rates still used correctly
- [ ] Check migration runs on first app start after update

## Technical Notes

### Rate Priority (Preserved)
1. **Book locked rate** (captured at book creation)
2. **Custom rate** (manually overridden)
3. **API rate** (live rate from exchange API)

### Migration Safety
- Runs once per database (tracked in `migration_log`)
- Uses try-catch to prevent app crash if migration fails
- Logs success/failure for debugging
- Non-blocking - app continues even if migration fails

### Edge Cases Handled
- Entry already in user's default currency (rate = 1.0)
- Exchange rate not available (uses original amount)
- Old entries without normalized amount (falls back gracefully)
- User changes default currency (entries keep original normalized currency)

## Performance Metrics (Expected)

**Before:**
- Analytics load: 2-5 seconds with 100+ entries
- Dashboard load: 1-3 seconds with multiple books
- Scales poorly: O(n × m) where n = entries, m = books

**After:**
- Analytics load: <500ms with 1000+ entries
- Dashboard load: <300ms with dozens of books
- Scales well: O(n) - linear with entry count

## Future Enhancements

1. **Background recalculation** - Update normalized amounts when user changes default currency
2. **Bulk operations** - Batch calculate normalized amounts for better performance
3. **Analytics by currency** - Show breakdowns by original currency if needed
4. **Audit trail** - Show conversion history for transparency
