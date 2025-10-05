// Currency Service - handle currency data, exchange rates, and conversions
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag?: string; // Unicode flag or country code
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  lastUpdated: Date;
}

export interface CurrencyAPIResponse {
  success: boolean;
  timestamp: number;
  base: string;
  date: string;
  rates: { [key: string]: number };
}

// Comprehensive list of currencies with symbols and flags
export const SUPPORTED_CURRENCIES: Currency[] = [
  // Major currencies
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  
  // Other popular currencies
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', flag: '🇨🇭' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', flag: '🇳🇴' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', flag: '🇩🇰' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', flag: '🇵🇱' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', flag: '🇨🇿' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', flag: '🇭🇺' },
  
  // Asian currencies
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', flag: '🇹🇭' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', flag: '🇵🇭' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', flag: '🇻🇳' },
  
  // Middle East & Africa
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', flag: '🇸🇦' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', flag: '🇪🇬' },
  
  // Americas
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$', flag: '🇲🇽' },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$', flag: '🇦🇷' },
  { code: 'CLP', name: 'Chilean Peso', symbol: '$', flag: '🇨🇱' },
  { code: 'COP', name: 'Colombian Peso', symbol: '$', flag: '🇨🇴' },
  
  // Crypto (if needed)
  { code: 'BTC', name: 'Bitcoin', symbol: '₿', flag: '₿' },
  { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', flag: 'Ξ' },
];

class CurrencyService {
  private static instance: CurrencyService;
  private exchangeRatesCache: Map<string, ExchangeRate[]> = new Map();
  private lastCacheUpdate: Date | null = null;
  
  // Free API - ExchangeRate-API (15,000 requests/month free)
  private readonly API_BASE_URL = 'https://api.exchangerate-api.com/v4/latest';
  
  // Alternative APIs if needed:
  // private readonly API_BASE_URL = 'https://api.fixer.io/latest'; // Requires API key
  // private readonly API_BASE_URL = 'https://open.er-api.com/v6/latest'; // Free alternative
  
  private readonly CACHE_DURATION = 1000 * 60 * 30; // 30 minutes
  private readonly STORAGE_KEY = 'currency_exchange_rates';

  static getInstance(): CurrencyService {
    if (!CurrencyService.instance) {
      CurrencyService.instance = new CurrencyService();
    }
    return CurrencyService.instance;
  }

  // Get all supported currencies
  getSupportedCurrencies(): Currency[] {
    return SUPPORTED_CURRENCIES;
  }

  // Get currency by code
  getCurrencyByCode(code: string): Currency | undefined {
    return SUPPORTED_CURRENCIES.find(c => c.code === code);
  }

  // Format amount with currency
  formatCurrency(amount: number, currencyCode: string, showSymbol: boolean = true): string {
    const currency = this.getCurrencyByCode(currencyCode);
    if (!currency) return amount.toFixed(2);

    const formattedAmount = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));

    if (showSymbol) {
      return `${amount < 0 ? '-' : ''}${currency.symbol}${formattedAmount}`;
    }
    return formattedAmount;
  }

  // Load exchange rates from cache
  private async loadCachedRates(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        this.lastCacheUpdate = new Date(data.timestamp);
        
        // Convert rates to Map
        data.rates.forEach((rate: any) => {
          const key = rate.from;
          if (!this.exchangeRatesCache.has(key)) {
            this.exchangeRatesCache.set(key, []);
          }
          this.exchangeRatesCache.get(key)!.push({
            ...rate,
            lastUpdated: new Date(rate.lastUpdated)
          });
        });
      }
    } catch (error) {
      console.error('Error loading cached exchange rates:', error);
    }
  }

  // Save exchange rates to cache
  private async saveCachedRates(): Promise<void> {
    try {
      const allRates: any[] = [];
      this.exchangeRatesCache.forEach((rates, from) => {
        rates.forEach(rate => {
          allRates.push({
            ...rate,
            lastUpdated: rate.lastUpdated.toISOString()
          });
        });
      });

      const cacheData = {
        timestamp: new Date().toISOString(),
        rates: allRates
      };

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving exchange rates cache:', error);
    }
  }

  // Check if cache is valid
  private isCacheValid(): boolean {
    if (!this.lastCacheUpdate) return false;
    const now = new Date().getTime();
    const cacheTime = this.lastCacheUpdate.getTime();
    return (now - cacheTime) < this.CACHE_DURATION;
  }

  // Fetch exchange rates from API
  async fetchExchangeRates(baseCurrency: string = 'USD'): Promise<boolean> {
    try {
      console.log(`Fetching exchange rates for ${baseCurrency}...`);
      
      const response = await fetch(`${this.API_BASE_URL}/${baseCurrency}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CurrencyAPIResponse = await response.json();
      
      if (!data.success && data.success !== undefined) {
        throw new Error('API returned unsuccessful response');
      }

      // Store rates in cache
      const rates: ExchangeRate[] = [];
      Object.entries(data.rates).forEach(([toCurrency, rate]) => {
        rates.push({
          from: baseCurrency,
          to: toCurrency,
          rate: rate,
          lastUpdated: new Date()
        });
      });

      this.exchangeRatesCache.set(baseCurrency, rates);
      this.lastCacheUpdate = new Date();
      
      // Save to persistent cache
      await this.saveCachedRates();
      
      console.log(`Successfully cached ${rates.length} exchange rates for ${baseCurrency}`);
      return true;
      
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      return false;
    }
  }

  // Get exchange rate between two currencies
  // Priority: 1) Book-specific locked rate, 2) Custom rate, 3) API rate
  async getExchangeRate(fromCurrency: string, toCurrency: string, bookId?: string): Promise<number | null> {
    if (fromCurrency === toCurrency) return 1;

    // First, check for book-specific locked rate
    if (bookId) {
      const bookRate = await this.getBookLockedRate(bookId, fromCurrency, toCurrency);
      if (bookRate !== null) {
        console.log(`Using book-locked rate for ${bookId}: 1 ${fromCurrency} = ${bookRate} ${toCurrency}`);
        return bookRate;
      }
    }

    // Second, check for custom exchange rate (manual override)
    const customRate = await this.getCustomExchangeRate(fromCurrency, toCurrency, bookId);
    if (customRate) {
      console.log(`Using custom rate: 1 ${fromCurrency} = ${customRate.rate} ${toCurrency}`);
      return customRate.rate;
    }

    // Finally, fall back to API rates
    // Load cache on first use
    if (this.exchangeRatesCache.size === 0) {
      await this.loadCachedRates();
    }

    // Check if we need fresh data
    if (!this.isCacheValid()) {
      const success = await this.fetchExchangeRates(fromCurrency);
      if (!success && this.exchangeRatesCache.size === 0) {
        // Try fetching with USD as base if fromCurrency failed
        await this.fetchExchangeRates('USD');
      }
    }

    // Try direct conversion
    const directRates = this.exchangeRatesCache.get(fromCurrency);
    if (directRates) {
      const rate = directRates.find(r => r.to === toCurrency);
      if (rate) return rate.rate;
    }

    // Try reverse conversion (to -> from, then invert)
    const reverseRates = this.exchangeRatesCache.get(toCurrency);
    if (reverseRates) {
      const rate = reverseRates.find(r => r.to === fromCurrency);
      if (rate && rate.rate !== 0) return 1 / rate.rate;
    }

    // Try via USD as intermediate currency
    const usdRates = this.exchangeRatesCache.get('USD');
    if (usdRates && fromCurrency !== 'USD' && toCurrency !== 'USD') {
      const fromUsdRate = usdRates.find(r => r.to === fromCurrency);
      const toUsdRate = usdRates.find(r => r.to === toCurrency);
      
      if (fromUsdRate && toUsdRate && fromUsdRate.rate !== 0) {
        return toUsdRate.rate / fromUsdRate.rate;
      }
    }

    console.warn(`Could not find exchange rate from ${fromCurrency} to ${toCurrency}`);
    return null;
  }

  // Convert amount between currencies
  async convertAmount(amount: number, fromCurrency: string, toCurrency: string): Promise<number | null> {
    if (fromCurrency === toCurrency) return amount;
    
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    if (rate === null) return null;
    
    return amount * rate;
  }

  // Convert multiple amounts (useful for dashboard aggregations)
  async convertAmounts(
    amounts: { amount: number; currency: string }[], 
    targetCurrency: string
  ): Promise<{ amount: number; originalCurrency: string; convertedAmount: number }[]> {
    const results = [];
    
    for (const item of amounts) {
      const convertedAmount = await this.convertAmount(item.amount, item.currency, targetCurrency);
      results.push({
        amount: item.amount,
        originalCurrency: item.currency,
        convertedAmount: convertedAmount || 0
      });
    }
    
    return results;
  }

  // Get cached rates info
  getCacheInfo(): { lastUpdated: Date | null; isValid: boolean; cachedCurrencies: string[] } {
    return {
      lastUpdated: this.lastCacheUpdate,
      isValid: this.isCacheValid(),
      cachedCurrencies: Array.from(this.exchangeRatesCache.keys())
    };
  }

  // Clear cache (useful for testing or manual refresh)
  async clearCache(): Promise<void> {
    this.exchangeRatesCache.clear();
    this.lastCacheUpdate = null;
    await AsyncStorage.removeItem(this.STORAGE_KEY);
  }

  // Preload common currencies
  async preloadCommonCurrencies(): Promise<void> {
    const commonCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'JPY'];
    
    for (const currency of commonCurrencies) {
      try {
        await this.fetchExchangeRates(currency);
        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Failed to preload rates for ${currency}:`, error);
      }
    }
  }

  /**
   * NEW: Capture historical exchange rates snapshot
   * Call this when creating an entry to preserve rates at that point in time
   */
  async captureHistoricalRates(baseCurrency: string): Promise<{
    capturedAt: Date;
    baseCurrency: string;
    rates: { [currencyCode: string]: number };
  }> {
    try {
      console.log(`📸 Capturing historical rates for ${baseCurrency}...`);
      
      // Fetch rates from API (will use cache if available)
      await this.fetchExchangeRates(baseCurrency);
      
      const rates: { [currencyCode: string]: number } = {};
      const cachedRates = this.exchangeRatesCache.get(baseCurrency);
      
      if (cachedRates) {
        // Store rates for major currencies to save storage space
        const majorCurrencies = [
          'USD', 'EUR', 'GBP', 'INR', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 
          'SEK', 'NOK', 'SGD', 'HKD', 'KRW', 'MXN', 'BRL', 'ZAR', 'AED'
        ];
        
        cachedRates.forEach(rate => {
          if (majorCurrencies.includes(rate.to)) {
            rates[rate.to] = rate.rate;
          }
        });
      }
      
      console.log(`✅ Captured ${Object.keys(rates).length} exchange rates`);
      
      return {
        capturedAt: new Date(),
        baseCurrency,
        rates
      };
    } catch (error) {
      console.error('Error capturing historical rates:', error);
      
      // Return minimal snapshot on error
      return {
        capturedAt: new Date(),
        baseCurrency,
        rates: {}
      };
    }
  }

  /**
   * NEW: Convert amount using historical rates (if available)
   * Falls back to current rates if historical rates don't have the target currency
   */
  async convertWithHistoricalRates(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    historicalRates?: {
      capturedAt: Date;
      baseCurrency: string;
      rates: { [currencyCode: string]: number };
    }
  ): Promise<{ convertedAmount: number; usedHistoricalRate: boolean }> {
    // Same currency, no conversion needed
    if (fromCurrency === toCurrency) {
      return { convertedAmount: amount, usedHistoricalRate: false };
    }

    // Try to use historical rates first
    if (historicalRates && historicalRates.baseCurrency === fromCurrency) {
      const historicalRate = historicalRates.rates[toCurrency];
      
      if (historicalRate) {
        // Handle capturedAt as either Date object or string (from database)
        const capturedDate = typeof historicalRates.capturedAt === 'string' 
          ? historicalRates.capturedAt 
          : historicalRates.capturedAt.toISOString();
        const dateStr = capturedDate.split('T')[0];
        console.log(`Using historical rate: 1 ${fromCurrency} = ${historicalRate} ${toCurrency} (captured: ${dateStr})`);
        return {
          convertedAmount: amount * historicalRate,
          usedHistoricalRate: true
        };
      }
    }

    // Fallback to current rates
    console.log(`Historical rate not available, using current rate for ${fromCurrency} → ${toCurrency}`);
    const currentRate = await this.getExchangeRate(fromCurrency, toCurrency);
    
    if (currentRate === null) {
      console.warn(`Could not convert ${fromCurrency} to ${toCurrency}`);
      return { convertedAmount: amount, usedHistoricalRate: false };
    }

    return {
      convertedAmount: amount * currentRate,
      usedHistoricalRate: false
    };
  }

  /**
   * NEW: Get exchange rate for a specific date (if available in historical snapshot)
   * Otherwise returns current rate
   */
  getHistoricalRate(
    fromCurrency: string,
    toCurrency: string,
    historicalSnapshot?: {
      capturedAt: Date;
      baseCurrency: string;
      rates: { [currencyCode: string]: number };
    }
  ): { rate: number | null; isHistorical: boolean; capturedAt?: Date } {
    if (fromCurrency === toCurrency) {
      return { rate: 1, isHistorical: true };
    }

    // Check if historical snapshot exists and has the rate
    if (historicalSnapshot && historicalSnapshot.baseCurrency === fromCurrency) {
      const rate = historicalSnapshot.rates[toCurrency];
      
      if (rate) {
        return {
          rate,
          isHistorical: true,
          capturedAt: historicalSnapshot.capturedAt
        };
      }
    }

    // No historical rate available
    return { rate: null, isHistorical: false };
  }

  /**
   * Save a custom exchange rate manually set by user
   * This allows users to override API rates if needed
   */
  async saveCustomExchangeRate(
    baseCurrency: string,
    targetCurrency: string,
    customRate: number,
    bookId?: string
  ): Promise<void> {
    const key = bookId 
      ? `custom_rate_${bookId}_${baseCurrency}_${targetCurrency}`
      : `custom_rate_global_${baseCurrency}_${targetCurrency}`;
    
    const customRateData = {
      baseCurrency,
      targetCurrency,
      rate: customRate,
      setAt: new Date().toISOString(),
      setBy: 'user',
      bookId
    };

    await AsyncStorage.setItem(key, JSON.stringify(customRateData));
    console.log(`✏️ Saved custom rate: 1 ${baseCurrency} = ${customRate} ${targetCurrency}`);
  }

  /**
   * Get book's locked exchange rate (captured at creation or manually updated)
   */
  async getBookLockedRate(
    bookId: string,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number | null> {
    try {
      // Import asyncStorageService here to avoid circular dependency
      const asyncStorageService = require('./asyncStorage').default;
      const book = await asyncStorageService.getBookById(bookId);
      
      console.log(`🔍 Checking locked rate for book ${bookId}:`, {
        fromCurrency,
        toCurrency,
        bookFound: !!book,
        bookCurrency: book?.currency,
        bookTargetCurrency: book?.targetCurrency,
        bookLockedRate: book?.lockedExchangeRate
      });
      
      if (!book) return null;
      
      // Check if this book has a locked rate for the target currency
      if (
        book.lockedExchangeRate &&
        book.currency === fromCurrency &&
        book.targetCurrency === toCurrency
      ) {
        console.log(`✅ Using book's locked rate: 1 ${fromCurrency} = ${book.lockedExchangeRate} ${toCurrency}`);
        return book.lockedExchangeRate;
      }
      
      // Check reverse (if book's target currency is the from, and currency is the to)
      if (
        book.lockedExchangeRate &&
        book.targetCurrency === fromCurrency &&
        book.currency === toCurrency
      ) {
        const invertedRate = 1 / book.lockedExchangeRate;
        console.log(`✅ Using inverted locked rate: 1 ${fromCurrency} = ${invertedRate} ${toCurrency}`);
        return invertedRate;
      }
      
      console.log(`ℹ️ No locked rate found for ${fromCurrency} → ${toCurrency}`);
      return null;
    } catch (error) {
      console.error('Error getting book locked rate:', error);
      return null;
    }
  }

  /**
   * Get custom exchange rate if user has set one
   */
  async getCustomExchangeRate(
    baseCurrency: string,
    targetCurrency: string,
    bookId?: string
  ): Promise<{ rate: number; setAt: Date } | null> {
    try {
      const key = bookId 
        ? `custom_rate_${bookId}_${baseCurrency}_${targetCurrency}`
        : `custom_rate_global_${baseCurrency}_${targetCurrency}`;
      
      const data = await AsyncStorage.getItem(key);
      if (!data) return null;

      const parsed = JSON.parse(data);
      return {
        rate: parsed.rate,
        setAt: new Date(parsed.setAt)
      };
    } catch (error) {
      console.error('Error getting custom rate:', error);
      return null;
    }
  }

  /**
   * Clear custom exchange rate (revert to API rates)
   */
  async clearCustomExchangeRate(
    baseCurrency: string,
    targetCurrency: string,
    bookId?: string
  ): Promise<void> {
    const key = bookId 
      ? `custom_rate_${bookId}_${baseCurrency}_${targetCurrency}`
      : `custom_rate_global_${baseCurrency}_${targetCurrency}`;
    
    await AsyncStorage.removeItem(key);
    console.log(`🗑️ Cleared custom rate: ${baseCurrency} → ${targetCurrency}`);
  }

  /**
   * Validate if a custom rate is reasonable (not too extreme)
   */
  validateCustomRate(
    baseCurrency: string,
    targetCurrency: string,
    customRate: number,
    apiRate: number
  ): { valid: boolean; warning?: string } {
    if (customRate <= 0) {
      return { valid: false, warning: 'Exchange rate must be positive' };
    }

    // Check if rate is too far from API rate (more than 50% difference)
    const percentDiff = Math.abs((customRate - apiRate) / apiRate * 100);
    
    if (percentDiff > 50) {
      return { 
        valid: true, 
        warning: `⚠️ This rate differs by ${percentDiff.toFixed(1)}% from the current API rate (${apiRate.toFixed(4)}). Please verify this is correct.` 
      };
    }

    if (percentDiff > 20) {
      return { 
        valid: true, 
        warning: `This rate differs by ${percentDiff.toFixed(1)}% from the current API rate.` 
      };
    }

    return { valid: true };
  }
}

export default CurrencyService.getInstance();