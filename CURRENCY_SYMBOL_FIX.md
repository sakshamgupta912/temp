# Currency Symbol Display Fix

## Problem
The Dashboard (Home page) was showing the **wrong currency symbol** even though the calculations were correct.

**Example of the bug:**
- Amounts calculated in INR: 5431 INR
- Display showed: $5431 (USD symbol instead of ₹)

## Root Cause

The amounts in the Dashboard are now in the **user's default currency** (e.g., INR) thanks to the normalized amounts optimization. However, the formatting function wasn't explicitly told which currency to use.

```typescript
// BEFORE: Implicit currency (could mismatch)
amounts.totalBalance = await formatAmount(Math.abs(totalBalance));
// formatAmount uses userDisplayCurrency from hook state
// But there's a timing issue - the state might not be loaded yet!
```

### Why It Happened
1. `loadDashboardData()` calculates amounts in `userDefaultCurrency` (INR)
2. `formatAmount()` uses `userDisplayCurrency` from hook state
3. **Race condition:** Hook state might not be loaded yet when formatting happens
4. Falls back to default currency (USD) → Wrong symbol!

## Solution

Explicitly pass the currency code to the formatting function:

```typescript
// AFTER: Explicit currency (guaranteed match)
const userDefaultCurrency = await currencyUtils.getUserDefaultCurrency();
amounts.totalBalance = await formatAmount(Math.abs(totalBalance), userDefaultCurrency);
// Now formatAmount knows exactly which currency to use!
```

## Technical Details

### Before Fix
```typescript
useEffect(() => {
  const formatAllAmounts = async () => {
    const amounts: {[key: string]: string} = {};
    
    // ❌ No currency specified - uses hook state (might be wrong)
    amounts.totalBalance = await formatAmount(Math.abs(totalBalance));
    
    // ... more formatting
  };
  formatAllAmounts();
}, [totalBalance, bookSummaries, formatAmount]);
```

### After Fix
```typescript
useEffect(() => {
  const formatAllAmounts = async () => {
    // ✅ Get the currency explicitly
    const userDefaultCurrency = await currencyUtils.getUserDefaultCurrency();
    
    const amounts: {[key: string]: string} = {};
    
    // ✅ Pass currency explicitly - guaranteed correct symbol
    amounts.totalBalance = await formatAmount(Math.abs(totalBalance), userDefaultCurrency);
    amounts[`balance_${summary.bookId}`] = await formatAmount(Math.abs(summary.netBalance), userDefaultCurrency);
    amounts[`income_${summary.bookId}`] = await formatAmount(summary.totalIncome, userDefaultCurrency);
    amounts[`expenses_${summary.bookId}`] = await formatAmount(summary.totalExpenses, userDefaultCurrency);
    
    // ... more formatting
  };
  formatAllAmounts();
}, [totalBalance, bookSummaries, formatAmount]);
```

## What Changed

**File:** `src/screens/DashboardScreen.tsx`

**Changes:**
1. Added `userDefaultCurrency` fetch in `formatAllAmounts()`
2. Pass `userDefaultCurrency` explicitly to all `formatAmount()` calls
3. Updated comment to clarify amounts are in user's default currency

## How It Works Now

```
1. loadDashboardData() calculates amounts
   → All amounts in userDefaultCurrency (e.g., INR)
   
2. formatAllAmounts() gets called
   → Fetches userDefaultCurrency (INR)
   → Passes INR explicitly to formatAmount()
   
3. formatAmount(5431, "INR")
   → Looks up INR currency data
   → Gets symbol: ₹
   → Formats: ₹5,431
   
4. Display shows: ₹5,431 ✅ (Correct!)
```

## Why This is Better

### ✅ Explicit is Better Than Implicit
- Currency code passed directly
- No reliance on hook state timing
- No race conditions

### ✅ Guaranteed Correctness
- Amount currency and display currency always match
- Amounts calculated in INR → Displayed with ₹ symbol

### ✅ Consistent with Architecture
- Normalized amounts in user default currency
- Display uses same currency
- No confusion about which currency is which

## Testing

To verify the fix:

1. **Check Dashboard**: Open app → Dashboard should show correct currency symbol (₹ for INR, $ for USD, etc.)
2. **Check Totals**: Total Balance should have correct symbol
3. **Check Book Cards**: Each book's income/expenses/balance should have correct symbol
4. **Change Currency**: Settings → Change default currency → Dashboard should update symbol

## Expected Behavior

| User Default | Display |
|--------------|---------|
| INR | ₹5,431 |
| USD | $100.00 |
| SGD | S$543.10 |
| EUR | €456.78 |

All amounts are calculated in the user's default currency and displayed with the **correct symbol** for that currency.

## Related Files

- `src/screens/DashboardScreen.tsx` - Fixed currency symbol display
- `src/hooks/useCurrency.ts` - Formatting logic
- `src/services/currencyService.ts` - Currency data and symbols
- `src/utils/currencyUtils.ts` - Currency utilities

## Prevention

To prevent this in the future:

1. **Always pass currency explicitly** when you know which currency the amount is in
2. **Don't rely on implicit hook state** for critical display logic
3. **Match calculation currency with display currency** - if you calculate in INR, display in INR

## Bonus: Other Screens

This same pattern should be applied to other screens that display formatted amounts:

- ✅ **DashboardScreen** - Fixed
- ⚠️ **AnalyticsScreen** - Should verify symbol display
- ⚠️ **BookDetailScreen** - Should verify symbol display
- ⚠️ **CategoryManagementScreen** - Should verify symbol display

If any of these show wrong symbols, apply the same fix: explicitly pass currency to `formatAmount()`.
