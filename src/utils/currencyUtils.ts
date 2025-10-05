// Currency Utilities - Handle entry currency conversions and mixed currency scenarios
import preferencesService from '../services/preferences';
import currencyService from '../services/currencyService';
import { Entry } from '../models/types';

export interface CurrencyConversionResult {
  convertedAmount: number; // Amount in default currency
  originalCurrency: string;
  originalAmount: number;
  exchangeRate: number;
  defaultCurrency: string;
}

export interface EntryWithCurrency extends Entry {
  displayCurrency: string; // Currency to display (original or default)
  displayAmount: number; // Amount to display  
}


class CurrencyUtils {
  private static instance: CurrencyUtils;
  private static readonly BACKEND_CURRENCY = 'INR'; // Always store in INR

  static getInstance(): CurrencyUtils {
    if (!CurrencyUtils.instance) {
      CurrencyUtils.instance = new CurrencyUtils();
    }
    return CurrencyUtils.instance;
  }

  // Always return INR as the backend currency
  async getBackendCurrency(): Promise<string> {
    return CurrencyUtils.BACKEND_CURRENCY;
  }

  // Get user's preferred display currency
  async getUserDisplayCurrency(): Promise<string> {
    try {
      const prefs = await preferencesService.getPreferences();
      return prefs.currency || 'INR';
    } catch (error) {
      return 'INR';
    }
  }

  // Convert amount from input currency to INR for storage
  async convertToINR(
    amount: number,
    fromCurrency: string
  ): Promise<CurrencyConversionResult> {
    const backendCurrency = await this.getBackendCurrency();
    if (fromCurrency === backendCurrency) {
      return {
        convertedAmount: amount,
        originalCurrency: fromCurrency,
        originalAmount: amount,
        exchangeRate: 1,
        defaultCurrency: backendCurrency
      };
    }
    try {
      const rate = await currencyService.getExchangeRate(fromCurrency, backendCurrency);
      if (rate === null) {
        console.warn(`Could not get exchange rate from ${fromCurrency} to ${backendCurrency}, using 1:1`);
        return {
          convertedAmount: amount,
          originalCurrency: fromCurrency,
          originalAmount: amount,
          exchangeRate: 1,
          defaultCurrency: backendCurrency
        };
      }
      const convertedAmount = amount * rate;
      console.log(`Converted ${currencyService.formatCurrency(amount, fromCurrency)} to ${currencyService.formatCurrency(convertedAmount, backendCurrency)} (rate: ${rate})`);
      return {
        convertedAmount,
        originalCurrency: fromCurrency,
        originalAmount: amount,
        exchangeRate: rate,
        defaultCurrency: backendCurrency
      };
    } catch (error) {
      console.error('Currency conversion error:', error);
      return {
        convertedAmount: amount,
        originalCurrency: fromCurrency,
        originalAmount: amount,
        exchangeRate: 1,
        defaultCurrency: backendCurrency
      };
    }
  }

  // Convert amount from INR to user's display currency for UI
  async convertFromINR(
    inrAmount: number,
    toCurrency: string
  ): Promise<number> {
    const backendCurrency = await this.getBackendCurrency();
    if (toCurrency === backendCurrency) {
      return inrAmount;
    }
    try {
      const rate = await currencyService.getExchangeRate(backendCurrency, toCurrency);
      return rate !== null ? inrAmount * rate : inrAmount;
    } catch (error) {
      console.error('Error converting from INR:', error);
      return inrAmount;
    }
  }

  // Prepare entry data for storage (convert to INR)
  async prepareEntryForStorage(entryData: {
    amount: number;
    currency: string;
    [key: string]: any;
  }): Promise<Partial<Entry>> {
    const conversion = await this.convertToINR(entryData.amount, entryData.currency);
    const backendCurrency = await this.getBackendCurrency();
    const result: Partial<Entry> = {
      ...entryData,
      amount: conversion.convertedAmount, // Store in INR
    };
    // Only store currency info if different from INR
    if (entryData.currency !== backendCurrency) {
      result.originalCurrency = conversion.originalCurrency;
      result.originalAmount = conversion.originalAmount;
      result.exchangeRate = conversion.exchangeRate;
    }
    return result;
  }

  // Prepare entry for display (convert from INR to user's display currency)
  async prepareEntryForDisplay(entry: Entry): Promise<EntryWithCurrency> {
    const userCurrency = await this.getUserDisplayCurrency();
    const backendCurrency = await this.getBackendCurrency();
    // Convert from INR to user's display currency
    const displayAmount = await this.convertFromINR(entry.amount, userCurrency);
    return {
      ...entry,
      displayCurrency: userCurrency,
      displayAmount
    };
  }

  // Calculate totals for entries (all amounts are in INR)
  async calculateTotals(entries: Entry[]): Promise<{
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    currency: string;
  }> {
    // All entries are stored in INR
    const totalIncome = entries.filter(e => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = entries.filter(e => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const netBalance = totalIncome - totalExpenses;
    return {
      totalIncome,
      totalExpenses,
      netBalance,
      currency: 'INR',
    };
  }

  // Format amount for display (from INR to user's currency)
  async formatEntryAmount(entry: Entry): Promise<string> {
    const entryWithCurrency = await this.prepareEntryForDisplay(entry);
    const isIncome = entryWithCurrency.displayAmount > 0;
    const sign = isIncome ? '+' : '-';
    const formatted = currencyService.formatCurrency(
      Math.abs(entryWithCurrency.displayAmount),
      entryWithCurrency.displayCurrency
    );
    return `${sign}${formatted}`;
  }

  // Format mixed currency summary
  formatMixedCurrencySummary(breakdown: { [currency: string]: { income: number; expenses: number; count: number } }): string {
    const currencies = Object.keys(breakdown);
    
    if (currencies.length <= 1) {
      return ''; // Not mixed currency
    }

    return currencies
      .map(currency => {
        const data = breakdown[currency];
        const net = data.income - data.expenses;
        return `${currencyService.formatCurrency(net, currency)} (${data.count} entries)`;
      })
      .join(' + ');
  }

  // Validate currency conversion setup
  async validateCurrencySetup(): Promise<{
    isValid: boolean;
    defaultCurrency: string;
    issues: string[];
  }> {
    const issues: string[] = [];
  const backendCurrency = await this.getBackendCurrency();
    
    // Check if currency service is working
    try {
      const testRate = await currencyService.getExchangeRate('USD', 'EUR');
      if (testRate === null) {
        issues.push('Currency service unable to fetch exchange rates');
      }
    } catch (error) {
      issues.push('Currency service error: ' + error);
    }

    // Check if default currency is supported
  const supportedCurrency = currencyService.getCurrencyByCode(backendCurrency);
    if (!supportedCurrency) {
  issues.push(`Backend currency ${backendCurrency} not supported`);
    }

    return {
      isValid: issues.length === 0,
  defaultCurrency: backendCurrency,
      issues
    };
  }
}

export default CurrencyUtils.getInstance();