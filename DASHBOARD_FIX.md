# Dashboard Consistency Fix

## Problem
The Dashboard (Home page) was showing **inconsistent totals** because:

1. **Old entries** (created before the performance optimization) don't have `normalizedAmount` yet
2. The fallback logic was using `entry.amount` directly without checking the currency
3. This caused **currency mixing**: Adding 100 SGD + 1000 INR = 1100 (nonsense!)

## Root Cause
```typescript
// WRONG - Mixed currencies!
const amount = entry.normalizedAmount !== undefined 
  ? entry.normalizedAmount  // ✅ Converted to INR
  : entry.amount;           // ❌ Still in SGD/other currency!
```

## Solution
Enhanced the fallback logic to **convert on-the-fly** for old entries:

### DashboardScreen Fix
```typescript
for (const entry of entries) {
  let amount = entry.amount;
  
  // FAST path: Use pre-converted normalized amount
  if (entry.normalizedAmount !== undefined && 
      entry.normalizedCurrency === userDefaultCurrency) {
    amount = entry.normalizedAmount;
  } 
  // Fallback: Convert old entries on-the-fly
  else if (entry.currency !== userDefaultCurrency) {
    const rate = await currencyService.getExchangeRate(
      entry.currency,
      userDefaultCurrency,
      entry.bookId
    );
    if (rate) {
      amount = entry.amount * rate;  // ✅ Now properly converted!
    }
  }
  
  // Aggregate converted amounts
  if (amount >= 0) {
    totalIncome += amount;
  } else {
    totalExpenses += Math.abs(amount);
  }
}
```

### AnalyticsScreen Fix
Applied the same logic to ensure consistent conversion for old entries.

## How It Works Now

### Scenario 1: New Entry (After Migration)
- Entry has `normalizedAmount = 5431 INR` (pre-converted)
- **Uses normalized amount directly** ⚡ (instant)
- No conversion needed

### Scenario 2: Old Entry (Before Migration)
- Entry has `amount = 100 SGD`, no `normalizedAmount`
- **Converts on-the-fly**: 100 SGD × 54.31 = 5431 INR
- Correct total!

### Scenario 3: Entry Already in User Currency
- Entry has `amount = 1000 INR`, currency = user's default
- No `normalizedAmount` yet
- **No conversion needed**, uses amount directly
- Correct total!

## Migration Timeline

1. **Right now**: Fallback conversion ensures consistency
2. **After migration runs**: Old entries get `normalizedAmount` populated
3. **Going forward**: All entries use fast path (normalized amounts)

The migration (`migrateNormalizedAmounts`) will run automatically on next app start and populate normalized amounts for all existing entries. After that, the fallback path will rarely be used.

## Testing

✅ **Dashboard should now show consistent totals**
✅ **Analytics should aggregate correctly**
✅ **No currency mixing**
✅ **Proper conversion using book locked rates**

## Performance Impact

- **New entries**: Instant (uses normalized amount)
- **Old entries (before migration)**: Slightly slower (converts on-the-fly)
- **After migration**: Everything instant!

The migration is a one-time operation, so this temporary slowdown for old entries is acceptable.
