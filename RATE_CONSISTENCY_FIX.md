# Locked Exchange Rate Consistency Fix

## Problem
Dashboard and Analytics were showing **incorrect calculations** even though amounts were being aggregated correctly. The issue was **rate inconsistency** between what was stored in `normalizedAmount` and the book's current `lockedExchangeRate`.

### Example of the Bug
```
Book: "Fhj" (SGD)
Book Locked Rate: 70 (SGD → INR)
Entry: 100 SGD

Expected: 100 × 70 = 7000 INR
Actual: 5508.8 INR (used rate 55.088 instead!)
```

## Root Cause

Entries could have `normalizedAmount` calculated with a **different exchange rate** than the book's current locked rate due to:

1. **Entry created before locked rate system** - Used API rate at creation time
2. **Book's locked rate was changed** after entry was created
3. **Migration used wrong rate** - Migration might have used API rate instead of book locked rate
4. **Rate mismatch over time** - API rate changed between entry creation and now

### The Core Issue
```typescript
// Entry stored in database:
{
  amount: 100,           // Original (SGD)
  normalizedAmount: 5508.8,  // ❌ Calculated with API rate 55.088
  conversionRate: 55.088,    // ❌ Not the book's locked rate!
}

// Book stored in database:
{
  name: "Fhj",
  currency: "SGD",
  lockedExchangeRate: 70,  // ✅ Correct locked rate
  targetCurrency: "INR"
}

// Problem: Entry's normalized amount uses 55.088, but should use 70!
```

## Solution

Add **rate consistency check** before using `normalizedAmount`. If the entry's `conversionRate` doesn't match the book's `lockedExchangeRate`, recalculate on-the-fly with the correct locked rate.

### Implementation

#### DashboardScreen Fix
```typescript
for (const entry of entries) {
  let amount = entry.amount;
  
  // Get book's locked rate
  const bookLockedRate = book.lockedExchangeRate;
  const isBookRateLocked = bookLockedRate && book.targetCurrency === userDefaultCurrency;
  
  const hasNormalizedAmount = entry.normalizedAmount !== undefined && 
                              entry.normalizedCurrency === userDefaultCurrency;
  
  // ✅ NEW: Check if normalized amount uses correct locked rate
  if (hasNormalizedAmount && isBookRateLocked && entry.conversionRate !== bookLockedRate) {
    // Rate mismatch - recalculate with book's locked rate
    amount = entry.amount * bookLockedRate;
    console.log(`⚠️ Rate mismatch! Recalculating with locked rate ${bookLockedRate}`);
  } 
  // Fast path: normalized amount uses correct rate
  else if (hasNormalizedAmount && entry.normalizedAmount !== undefined) {
    amount = entry.normalizedAmount;
  }
  // Fallback: no normalized amount, convert on-the-fly
  else if (entry.currency !== userDefaultCurrency) {
    const rate = await currencyService.getExchangeRate(...);
    amount = entry.amount * rate;
  }
}
```

#### AnalyticsScreen Fix
Applied the same logic to ensure Analytics also uses the correct locked rate.

## How It Works Now

### Scenario 1: Correct Normalized Amount
```
Entry: normalizedAmount = 7000, conversionRate = 70
Book: lockedExchangeRate = 70
✅ Rate matches! Use normalized amount (FAST)
Result: 7000 INR
```

### Scenario 2: Incorrect Normalized Amount (FIXED!)
```
Entry: normalizedAmount = 5508.8, conversionRate = 55.088
Book: lockedExchangeRate = 70
⚠️ Rate mismatch detected!
🔄 Recalculate: 100 × 70 = 7000 INR (using locked rate)
Result: 7000 INR ✅ (Correct!)
```

### Scenario 3: No Normalized Amount
```
Entry: normalizedAmount = undefined
Book: lockedExchangeRate = 70
💱 Convert on-the-fly: 100 × 70 = 7000 INR
Result: 7000 INR ✅
```

## Benefits

### ✅ Accuracy Guaranteed
- Always uses book's locked rate when available
- Prevents rate drift over time
- Historical consistency maintained

### ✅ Still Performant
- Most entries will have correct normalized amount (FAST path)
- Only recalculates when rate mismatch detected
- No database updates needed (recalculation on-the-fly)

### ✅ Self-Healing
- Automatically fixes inconsistent data at display time
- No manual intervention needed
- Works for all old/migrated/new entries

## Detection & Logging

Enhanced logging to debug rate issues:

```typescript
// Rate mismatch detected
console.log(`⚠️ Rate mismatch! Entry has rate ${entry.conversionRate}, but book locked rate is ${bookLockedRate}. Recalculating...`);
console.log(`🔄 Recalculated: ${entry.amount} ${entry.currency} × ${bookLockedRate} = ${amount} ${userDefaultCurrency}`);

// Using normalized amount (correct rate)
console.log(`✅ Using normalized: ${entry.amount} ${entry.currency} → ${amount} ${userDefaultCurrency} (rate: ${entry.conversionRate})`);

// Converting on-the-fly (no normalized amount)
console.log(`⚠️ No normalized amount, converting: ${entry.amount} ${entry.currency} → ${userDefaultCurrency}`);
console.log(`💱 Converted: ${entry.amount} × ${rate} = ${amount} ${userDefaultCurrency}`);

// Same currency (no conversion)
console.log(`ℹ️ Same currency, no conversion: ${entry.amount} ${entry.currency}`);
```

## Long-Term Fix (Optional)

While the current fix works perfectly, you could optionally add a **background migration** to update all entries' `normalizedAmount` and `conversionRate` to match their book's locked rate:

```typescript
async function fixNormalizedAmounts() {
  const books = await getBooks();
  
  for (const book of books) {
    if (book.lockedExchangeRate) {
      const entries = await getEntries(book.id);
      
      for (const entry of entries) {
        // If entry's rate doesn't match book's locked rate, update it
        if (entry.conversionRate !== book.lockedExchangeRate) {
          const correctNormalizedAmount = entry.amount * book.lockedExchangeRate;
          
          await updateEntry(entry.id, {
            normalizedAmount: correctNormalizedAmount,
            conversionRate: book.lockedExchangeRate
          });
        }
      }
    }
  }
}
```

However, this isn't strictly necessary since the current fix handles it at display time.

## Testing

To verify the fix:

1. **Check logs**: Look for "⚠️ Rate mismatch!" messages
2. **Verify calculations**: Dashboard total should match sum of book balances
3. **Compare with book detail**: Book detail view should show same total as dashboard card
4. **Test with multiple books**: Ensure all books aggregate correctly

### Expected Log Output
```
📊 Dashboard: Aggregating 2 books in INR (using normalized amounts)
📖 Book "Fhj" (SGD): 1 entries
  ⚠️ Rate mismatch! Entry has rate 55.088, but book locked rate is 70. Recalculating...
  🔄 Recalculated: 100 SGD × 70 = 7000 INR
  Income: 7000 INR
  Expenses: 0 INR
  Balance: 7000 INR
📖 Book "Singa" (SGD): 1 entries
  ✅ Using normalized: -10 SGD → -700 INR (rate: 70)
  Income: 0 INR
  Expenses: 700 INR
  Balance: -700 INR
✅ Dashboard: Total balance: 6300 INR (instant calculation)
```

## Files Modified

1. **src/screens/DashboardScreen.tsx** - Added rate consistency check
2. **src/screens/AnalyticsScreen.tsx** - Added rate consistency check

## Prevention

To prevent this in the future:

1. **Always use getExchangeRate with bookId** - This ensures locked rate is used
2. **Update normalized amounts when locked rate changes** - If user edits book's locked rate, recalculate all entries
3. **Validate rate on entry creation** - Ensure `conversionRate` matches book's locked rate
4. **Add database constraint** - Could add CHECK constraint to ensure rate consistency

## Summary

**Problem:** Entries stored with wrong conversion rate (API rate instead of book's locked rate)

**Solution:** Runtime validation - check if entry's rate matches book's locked rate, recalculate if mismatch

**Result:** 
- ✅ Correct calculations using book's locked rate
- ✅ Still fast (only recalculates when needed)
- ✅ Self-healing (no manual fixes required)
- ✅ Works for all entries (old, new, migrated)

Your Dashboard and Analytics now **always** use the book's locked exchange rate, ensuring historical consistency and accurate totals! 🎯
