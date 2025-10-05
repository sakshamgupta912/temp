// Currency Hook - React hook for currency formatting and display currency handling
// NOTE: All amounts are stored in INR, this hook handles display currency conversion
import { useCallback, useEffect, useState } from 'react';
import preferencesService from '../services/preferences';
import currencyService from '../services/currencyService';
import currencyUtils from '../utils/currencyUtils';
import { Book } from '../models/types';

interface CurrencyHookReturn {
  // Formatting functions (amounts should be in INR, will be converted for display)
  formatAmount: (inrAmount: number, displayCurrency?: string) => Promise<string>;
  formatAmountSync: (amount: number, currency: string) => string;
  getSymbol: (currency?: string) => string;
  getCurrencyCode: (currency?: string) => string;
  
  // User display currency info
  userDisplayCurrency: string;
  displaySymbol: string;
  
  // Loading state
  isLoading: boolean;
}

export const useCurrency = (): CurrencyHookReturn => {
  const [userDisplayCurrency, setUserDisplayCurrency] = useState<string>('INR');
  const [displaySymbol, setDisplaySymbol] = useState<string>('₹');
  const [isLoading, setIsLoading] = useState(true);

  // Load user's display currency preference on hook initialization
  useEffect(() => {
    const loadDisplayCurrency = async () => {
      try {
        const displayCurrency = await currencyUtils.getUserDisplayCurrency();
        setUserDisplayCurrency(displayCurrency);
        const currencyData = currencyService.getCurrencyByCode(displayCurrency);
        setDisplaySymbol(currencyData?.symbol || '₹');
      } catch (error) {
        console.error('Error loading display currency:', error);
        // Keep defaults (INR)
      } finally {
        setIsLoading(false);
      }
    };

    loadDisplayCurrency();
  }, []);

  // Get currency symbol
  const getSymbol = useCallback((currency?: string): string => {
    const targetCurrency = currency || userDisplayCurrency;
    const currencyData = currencyService.getCurrencyByCode(targetCurrency);
    return currencyData?.symbol || displaySymbol;
  }, [displaySymbol, userDisplayCurrency]);

  // Get currency code
  const getCurrencyCode = useCallback((currency?: string): string => {
    return currency || userDisplayCurrency;
  }, [userDisplayCurrency]);

  // Format amount (convert from INR to display currency)
  const formatAmount = useCallback(async (inrAmount: number, displayCurrency?: string): Promise<string> => {
    const targetCurrency = displayCurrency || userDisplayCurrency;
    const convertedAmount = await currencyUtils.convertFromINR(inrAmount, targetCurrency);
    return currencyService.formatCurrency(convertedAmount, targetCurrency, true);
  }, [userDisplayCurrency]);

  // Synchronous format (for when currency is already known)
  const formatAmountSync = useCallback((amount: number, currency: string): string => {
    return currencyService.formatCurrency(amount, currency, true);
  }, []);

  return {
    formatAmount,
    formatAmountSync,
    getSymbol,
    getCurrencyCode,
    userDisplayCurrency,
    displaySymbol,
    isLoading,
  };
};

// Simplified book currency hook (books no longer have individual currencies)
export const useBookCurrency = (book?: Book): CurrencyHookReturn => {
  const currencyHook = useCurrency();
  // All amounts are in INR, display in user's preferred currency
  return currencyHook;
};

// Entry currency hook (all entries are stored in INR)
export const useEntryCurrency = () => {
  const currencyHook = useCurrency();

  // Format entry amount (convert from INR to display currency)
  const formatEntry = useCallback(async (inrAmount: number): Promise<string> => {
    return await currencyHook.formatAmount(inrAmount);
  }, [currencyHook]);

  return {
    ...currencyHook,
    formatEntry,
  };
};

export default useCurrency;