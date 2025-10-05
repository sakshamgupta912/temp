// App Preferences Service - manage user preferences and settings
import AsyncStorage from '@react-native-async-storage/async-storage';
import currencyService from './currencyService';

export interface AppPreferences {
  // Display preferences
  currency: string; // Changed to support all currencies
  currencySymbol: string; // Auto-updated from currency service
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  
  // Default values
  defaultPaymentMode: 'cash' | 'upi' | 'card' | 'net_banking' | 'cheque' | 'other';
  defaultEntryType: 'income' | 'expense';
  
  // App behavior
  showDecimalPlaces: boolean;
  enableNotifications: boolean;
  enableBiometric: boolean;
  autoBackup: boolean;
  
  // Theme preferences  
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  
  // Advanced settings
  cacheTimeout: number; // in milliseconds
  maxEntriesPerPage: number;
  enableAnalytics: boolean;
}

const DEFAULT_PREFERENCES: AppPreferences = {
  currency: 'INR',
  currencySymbol: '₹',
  dateFormat: 'DD/MM/YYYY',
  defaultPaymentMode: 'cash',
  defaultEntryType: 'expense',
  showDecimalPlaces: true,
  enableNotifications: true,
  enableBiometric: false,
  autoBackup: false,
  theme: 'light',
  accentColor: '#6750A4',
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  maxEntriesPerPage: 50,
  enableAnalytics: true,
};

const PREFERENCES_KEY = 'app_preferences';

class PreferencesService {
  private static instance: PreferencesService;
  private cachedPreferences: AppPreferences | null = null;

  static getInstance(): PreferencesService {
    if (!PreferencesService.instance) {
      PreferencesService.instance = new PreferencesService();
    }
    return PreferencesService.instance;
  }

  async getPreferences(): Promise<AppPreferences> {
    if (this.cachedPreferences) {
      return this.cachedPreferences;
    }

    try {
      const stored = await AsyncStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        const preferences = JSON.parse(stored);
        // Merge with defaults to handle new preference additions
        this.cachedPreferences = { ...DEFAULT_PREFERENCES, ...preferences };
      } else {
        this.cachedPreferences = { ...DEFAULT_PREFERENCES };
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      this.cachedPreferences = { ...DEFAULT_PREFERENCES };
    }

    return this.cachedPreferences!;
  }

  async updatePreferences(updates: Partial<AppPreferences>): Promise<void> {
    try {
      const currentPreferences = await this.getPreferences();
      let newPreferences = { ...currentPreferences, ...updates };
      
      // Auto-update currency symbol when currency changes
      if (updates.currency && updates.currency !== currentPreferences.currency) {
        const currencyData = currencyService.getCurrencyByCode(updates.currency);
        if (currencyData) {
          newPreferences.currencySymbol = currencyData.symbol;
        }
      }
      
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(newPreferences));
      this.cachedPreferences = newPreferences;
      
      console.log('Preferences updated:', updates);
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  async resetPreferences(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PREFERENCES_KEY);
      this.cachedPreferences = DEFAULT_PREFERENCES;
      console.log('Preferences reset to defaults');
    } catch (error) {
      console.error('Error resetting preferences:', error);
      throw error;
    }
  }

  // Helper methods for common preferences
  async getCurrency(): Promise<{ code: string; symbol: string }> {
    const prefs = await this.getPreferences();
    return { code: prefs.currency, symbol: prefs.currencySymbol };
  }

  async getDateFormat(): Promise<string> {
    const prefs = await this.getPreferences();
    return prefs.dateFormat;
  }

  async getDefaultPaymentMode(): Promise<string> {
    const prefs = await this.getPreferences();
    return prefs.defaultPaymentMode;
  }

  // Format currency according to preferences
  async formatCurrency(amount: number): Promise<string> {
    const prefs = await this.getPreferences();
    const absAmount = Math.abs(amount);
    
    if (prefs.showDecimalPlaces) {
      return `${prefs.currencySymbol}${absAmount.toLocaleString('en-IN', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`;
    } else {
      return `${prefs.currencySymbol}${absAmount.toLocaleString('en-IN', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
      })}`;
    }
  }

  // Format date according to preferences
  async formatDate(date: Date): Promise<string> {
    const prefs = await this.getPreferences();
    
    switch (prefs.dateFormat) {
      case 'DD/MM/YYYY':
        return date.toLocaleDateString('en-GB');
      case 'MM/DD/YYYY':
        return date.toLocaleDateString('en-US');
      case 'YYYY-MM-DD':
        return date.toISOString().split('T')[0];
      default:
        return date.toLocaleDateString();
    }
  }

  // Set currency with automatic symbol update
  async setCurrency(currencyCode: string): Promise<void> {
    const currencyData = currencyService.getCurrencyByCode(currencyCode);
    if (currencyData) {
      await this.updatePreferences({
        currency: currencyCode,
        currencySymbol: currencyData.symbol
      });
    } else {
      throw new Error(`Unsupported currency: ${currencyCode}`);
    }
  }

  // Get all supported currencies from currency service
  getSupportedCurrencies() {
    return currencyService.getSupportedCurrencies();
  }

  // Format currency with full currency service integration
  async formatCurrencyAdvanced(amount: number, currencyCode?: string): Promise<string> {
    const prefs = await this.getPreferences();
    const currency = currencyCode || prefs.currency;
    
    return currencyService.formatCurrency(
      amount, 
      currency, 
      true // showSymbol
    );
  }

  // Currency options (deprecated - use getSupportedCurrencies instead)
  getCurrencyOptions(): Array<{ code: string; symbol: string; name: string }> {
    return currencyService.getSupportedCurrencies().slice(0, 8).map(currency => ({
      code: currency.code,
      symbol: currency.symbol,
      name: currency.name
    }));
  }

  // Date format options
  getDateFormatOptions(): Array<{ value: string; label: string; example: string }> {
    const now = new Date();
    return [
      { 
        value: 'DD/MM/YYYY', 
        label: 'DD/MM/YYYY', 
        example: now.toLocaleDateString('en-GB') 
      },
      { 
        value: 'MM/DD/YYYY', 
        label: 'MM/DD/YYYY', 
        example: now.toLocaleDateString('en-US') 
      },
      { 
        value: 'YYYY-MM-DD', 
        label: 'YYYY-MM-DD', 
        example: now.toISOString().split('T')[0] 
      },
    ];
  }

  // Payment mode options
  getPaymentModeOptions(): Array<{ value: string; label: string; icon: string }> {
    return [
      { value: 'cash', label: 'Cash', icon: 'money' },
      { value: 'upi', label: 'UPI', icon: 'qr-code-scanner' },
      { value: 'card', label: 'Card', icon: 'credit-card' },
      { value: 'net_banking', label: 'Net Banking', icon: 'account-balance' },
      { value: 'cheque', label: 'Cheque', icon: 'receipt' },
      { value: 'other', label: 'Other', icon: 'more-horiz' },
    ];
  }
}

export const preferencesService = PreferencesService.getInstance();
export default preferencesService;