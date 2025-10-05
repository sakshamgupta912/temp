// Currency Utilities - Handle multi-currency book/entry management with historical rates
import preferencesService from '../services/preferences';
import currencyService from '../services/currencyService';
import { Entry, Book, BookCurrencyHistory, ConversionHistoryEntry, ConversionReason } from '../models/types';

/**
 * NEW ARCHITECTURE:
 * - Each book has its own currency
 * - Entries are stored in their book's currency
 * - User has a default currency for dashboard/global views
 * - Historical rates are captured at entry creation
 * - Book currency can be changed with full audit trail
 */

export interface BookConversionResult {
  convertedAmount: number;
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
  usedHistoricalRate: boolean;
}

export interface BookSummaryWithCurrency {
  bookId: string;
  bookName: string;
  bookCurrency: string;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  entryCount: number;
  // Converted to user's default currency
  convertedTotalIncome?: number;
  convertedTotalExpenses?: number;
  convertedNetBalance?: number;
  convertedCurrency?: string;
  conversionRate?: number;
}

class CurrencyUtils {
  private static instance: CurrencyUtils;

  static getInstance(): CurrencyUtils {
    if (!CurrencyUtils.instance) {
      CurrencyUtils.instance = new CurrencyUtils();
    }
    return CurrencyUtils.instance;
  }

  /**
   * Get user's default currency for dashboard/global views
   */
  async getUserDefaultCurrency(): Promise<string> {
    try {
      const prefs = await preferencesService.getPreferences();
      return prefs.currency || 'USD';
    } catch (error) {
      console.error('Error getting user default currency:', error);
      return 'USD';
    }
  }

  /**
   * Set user's default currency
   */
  async setUserDefaultCurrency(currency: string): Promise<void> {
    try {
      await preferencesService.savePreferences({ currency });
      console.log(`✅ User default currency set to: ${currency}`);
    } catch (error) {
      console.error('Error setting user default currency:', error);
      throw error;
    }
  }

  /**
   * Calculate book summary in book's native currency
   */
  calculateBookSummary(entries: Entry[], bookCurrency: string): {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    currency: string;
  } {
    // All entries in a book are in the same currency
    const totalIncome = entries
      .filter(e => e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);
    
    const totalExpenses = entries
      .filter(e => e.amount < 0)
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
    
    const netBalance = totalIncome - totalExpenses;

    return {
      totalIncome,
      totalExpenses,
      netBalance,
      currency: bookCurrency
    };
  }

  /**
   * Convert book summary to user's default currency for dashboard display
   */
  async convertBookSummaryToUserCurrency(
    bookSummary: {
      totalIncome: number;
      totalExpenses: number;
      netBalance: number;
      currency: string;
    },
    userDefaultCurrency: string,
    bookId?: string // Add bookId to use book's locked rate
  ): Promise<{
    convertedTotalIncome: number;
    convertedTotalExpenses: number;
    convertedNetBalance: number;
    conversionRate: number;
    convertedCurrency: string;
  }> {
    if (bookSummary.currency === userDefaultCurrency) {
      // No conversion needed
      return {
        convertedTotalIncome: bookSummary.totalIncome,
        convertedTotalExpenses: bookSummary.totalExpenses,
        convertedNetBalance: bookSummary.netBalance,
        conversionRate: 1,
        convertedCurrency: userDefaultCurrency
      };
    }

    try {
      const rate = await currencyService.getExchangeRate(
        bookSummary.currency,
        userDefaultCurrency,
        bookId // Pass bookId to use locked rate
      );

      if (rate === null) {
        console.warn(`Could not get rate ${bookSummary.currency} → ${userDefaultCurrency}`);
        return {
          convertedTotalIncome: bookSummary.totalIncome,
          convertedTotalExpenses: bookSummary.totalExpenses,
          convertedNetBalance: bookSummary.netBalance,
          conversionRate: 1,
          convertedCurrency: bookSummary.currency
        };
      }

      return {
        convertedTotalIncome: bookSummary.totalIncome * rate,
        convertedTotalExpenses: bookSummary.totalExpenses * rate,
        convertedNetBalance: bookSummary.netBalance * rate,
        conversionRate: rate,
        convertedCurrency: userDefaultCurrency
      };
    } catch (error) {
      console.error('Error converting book summary:', error);
      return {
        convertedTotalIncome: bookSummary.totalIncome,
        convertedTotalExpenses: bookSummary.totalExpenses,
        convertedNetBalance: bookSummary.netBalance,
        conversionRate: 1,
        convertedCurrency: bookSummary.currency
      };
    }
  }

  /**
   * Format entry amount for display using historical rates if available
   */
  async formatEntryAmount(
    entry: Entry,
    displayCurrency?: string
  ): Promise<string> {
    const targetCurrency = displayCurrency || entry.currency;
    
    if (entry.currency === targetCurrency) {
      // No conversion needed
      const isIncome = entry.amount > 0;
      const sign = isIncome ? '+' : '-';
      const formatted = currencyService.formatCurrency(
        Math.abs(entry.amount),
        entry.currency
      );
      return `${sign}${formatted}`;
    }

    // Try to use historical rates
    const conversion = await currencyService.convertWithHistoricalRates(
      entry.amount,
      entry.currency,
      targetCurrency,
      entry.historicalRates
    );

    const isIncome = conversion.convertedAmount > 0;
    const sign = isIncome ? '+' : '-';
    const formatted = currencyService.formatCurrency(
      Math.abs(conversion.convertedAmount),
      targetCurrency
    );

    return `${sign}${formatted}`;
  }

  /**
   * Aggregate entries from multiple books in user's default currency
   * Used for dashboard "All Books" view
   */
  async aggregateMultiCurrencyEntries(
    entries: Entry[],
    targetCurrency: string
  ): Promise<{
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    currency: string;
    conversionDetails: Array<{
      currency: string;
      count: number;
      income: number;
      expenses: number;
      rate: number;
    }>;
  }> {
    // Group entries by currency
    const byCurrency: {
      [currency: string]: {
        count: number;
        income: number;
        expenses: number;
      };
    } = {};

    entries.forEach(entry => {
      if (!byCurrency[entry.currency]) {
        byCurrency[entry.currency] = { count: 0, income: 0, expenses: 0 };
      }
      byCurrency[entry.currency].count++;
      
      if (entry.amount > 0) {
        byCurrency[entry.currency].income += entry.amount;
      } else {
        byCurrency[entry.currency].expenses += Math.abs(entry.amount);
      }
    });

    // Convert each currency group to target currency
    let totalIncome = 0;
    let totalExpenses = 0;
    const conversionDetails = [];

    for (const [currency, data] of Object.entries(byCurrency)) {
      let rate = 1;
      let convertedIncome = data.income;
      let convertedExpenses = data.expenses;

      if (currency !== targetCurrency) {
        rate = await currencyService.getExchangeRate(currency, targetCurrency) || 1;
        convertedIncome = data.income * rate;
        convertedExpenses = data.expenses * rate;
      }

      totalIncome += convertedIncome;
      totalExpenses += convertedExpenses;

      conversionDetails.push({
        currency,
        count: data.count,
        income: data.income,
        expenses: data.expenses,
        rate
      });
    }

    return {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      currency: targetCurrency,
      conversionDetails
    };
  }

  /**
   * NEW: Change a book's currency and convert all its entries
   * This is the core function for book currency change feature
   */
  async changeBookCurrency(
    book: Book,
    entries: Entry[],
    newCurrency: string,
    userId: string,
    customExchangeRate?: number,
    notes?: string
  ): Promise<{
    updatedBook: Book;
    updatedEntries: Entry[];
    conversionSummary: {
      entriesConverted: number;
      oldCurrency: string;
      newCurrency: string;
      exchangeRate: number;
    };
  }> {
    const oldCurrency = book.currency;

    if (oldCurrency === newCurrency) {
      throw new Error('Book is already in this currency');
    }

    console.log(`🔄 Changing book currency: ${oldCurrency} → ${newCurrency}`);

    // Step 1: Get exchange rate
    const exchangeRate = customExchangeRate || 
      await currencyService.getExchangeRate(oldCurrency, newCurrency) || 1;

    console.log(`   Using exchange rate: 1 ${oldCurrency} = ${exchangeRate} ${newCurrency}`);

    // Step 2: Convert all entries
    const updatedEntries: Entry[] = [];
    
    for (const entry of entries) {
      const convertedAmount = entry.amount * exchangeRate;
      
      // Create conversion history record
      const conversionRecord: ConversionHistoryEntry = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fromCurrency: oldCurrency,
        fromAmount: entry.amount,
        toCurrency: newCurrency,
        toAmount: convertedAmount,
        exchangeRate,
        convertedAt: new Date(),
        convertedBy: userId,
        reason: ConversionReason.BOOK_CURRENCY_CHANGE,
        notes: notes
      };

      // Update entry with new currency and conversion history
      const updatedEntry: Entry = {
        ...entry,
        amount: convertedAmount,
        currency: newCurrency,
        conversionHistory: [
          ...(entry.conversionHistory || []),
          conversionRecord
        ],
        updatedAt: new Date()
      };

      updatedEntries.push(updatedEntry);
    }

    // Step 3: Update book with currency history
    const bookCurrencyHistory: BookCurrencyHistory = {
      id: `curr_hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromCurrency: oldCurrency,
      toCurrency: newCurrency,
      exchangeRate,
      changedAt: new Date(),
      changedBy: userId,
      affectedEntriesCount: entries.length,
      notes
    };

    const updatedBook: Book = {
      ...book,
      currency: newCurrency,
      currencyHistory: [
        ...(book.currencyHistory || []),
        bookCurrencyHistory
      ],
      updatedAt: new Date()
    };

    console.log(`✅ Book currency changed successfully`);
    console.log(`   Entries converted: ${entries.length}`);

    return {
      updatedBook,
      updatedEntries,
      conversionSummary: {
        entriesConverted: entries.length,
        oldCurrency,
        newCurrency,
        exchangeRate
      }
    };
  }

  /**
   * Validate currency setup
   */
  async validateCurrencySetup(): Promise<{
    isValid: boolean;
    userDefaultCurrency: string;
    issues: string[];
  }> {
    const issues: string[] = [];
    const userDefaultCurrency = await this.getUserDefaultCurrency();

    // Check if currency service is working
    try {
      const testRate = await currencyService.getExchangeRate('USD', 'EUR');
      if (testRate === null) {
        issues.push('Currency service unable to fetch exchange rates');
      }
    } catch (error) {
      issues.push('Currency service error: ' + error);
    }

    // Check if user's default currency is supported
    const supportedCurrency = currencyService.getCurrencyByCode(userDefaultCurrency);
    if (!supportedCurrency) {
      issues.push(`User default currency ${userDefaultCurrency} not supported`);
    }

    return {
      isValid: issues.length === 0,
      userDefaultCurrency,
      issues
    };
  }

  /**
   * Get conversion preview for book currency change
   */
  async getBookCurrencyChangePreview(
    entries: Entry[],
    fromCurrency: string,
    toCurrency: string,
    customRate?: number
  ): Promise<{
    exchangeRate: number;
    sampleConversions: Array<{
      originalAmount: number;
      convertedAmount: number;
      category: string;
    }>;
    totalOriginal: {
      income: number;
      expenses: number;
      balance: number;
    };
    totalConverted: {
      income: number;
      expenses: number;
      balance: number;
    };
  }> {
    const rate = customRate || await currencyService.getExchangeRate(fromCurrency, toCurrency) || 1;

    // Calculate totals
    const totalOriginal = {
      income: entries.filter(e => e.amount > 0).reduce((sum, e) => sum + e.amount, 0),
      expenses: entries.filter(e => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0),
      balance: 0
    };
    totalOriginal.balance = totalOriginal.income - totalOriginal.expenses;

    const totalConverted = {
      income: totalOriginal.income * rate,
      expenses: totalOriginal.expenses * rate,
      balance: totalOriginal.balance * rate
    };

    // Get sample conversions (first 5 entries)
    const sampleConversions = entries.slice(0, 5).map(entry => ({
      originalAmount: entry.amount,
      convertedAmount: entry.amount * rate,
      category: entry.category
    }));

    return {
      exchangeRate: rate,
      sampleConversions,
      totalOriginal,
      totalConverted
    };
  }
}

export default CurrencyUtils.getInstance();