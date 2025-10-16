// App Preferences Service - manage user preferences and settings
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firestore } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth } from './firebase';
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
  autoSync: boolean;
  
  // Theme preferences  
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  
  // Advanced settings
  cacheTimeout: number; // in milliseconds
  maxEntriesPerPage: number;
  enableAnalytics: boolean;
}

const DEFAULT_PREFERENCES: AppPreferences = {
  currency: 'USD', // Changed to USD as default (users can set their own during signup)
  currencySymbol: '$',
  dateFormat: 'DD/MM/YYYY',
  defaultPaymentMode: 'cash',
  defaultEntryType: 'expense',
  showDecimalPlaces: true,
  enableNotifications: true,
  enableBiometric: false,
  autoBackup: false,
  autoSync: true,
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
  private firebaseSyncEnabled: boolean = false;

  static getInstance(): PreferencesService {
    if (!PreferencesService.instance) {
      PreferencesService.instance = new PreferencesService();
    }
    return PreferencesService.instance;
  }

  /**
   * Get current user ID from Firebase Auth
   */
  private getCurrentUserId(): string | null {
    return auth.currentUser?.uid || null;
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

      // Sync with Firebase if user is signed in
      if (this.firebaseSyncEnabled) {
        const userId = this.getCurrentUserId();
        if (userId) {
          await this.saveToFirebase(userId, newPreferences);
        }
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Enable Firebase sync (call after user signs in)
   */
  enableFirebaseSync(): void {
    this.firebaseSyncEnabled = true;
  }

  /**
   * Disable Firebase sync (call after user signs out)
   */
  disableFirebaseSync(): void {
    this.firebaseSyncEnabled = false;
  }

  /**
   * Load preferences from Firebase and merge with local preferences
   */
  async syncWithFirebase(userId: string): Promise<void> {
    try {
      const userPrefsRef = doc(firestore, 'users', userId, 'preferences', 'settings');
      const docSnap = await getDoc(userPrefsRef);

      if (docSnap.exists()) {
        const firebasePrefs = docSnap.data() as AppPreferences;
        
        // Merge Firebase preferences with local preferences (Firebase takes priority)
        const localPrefs = await this.getPreferences();
        const mergedPrefs = { ...localPrefs, ...firebasePrefs };
        
        // Save merged preferences locally
        await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(mergedPrefs));
        this.cachedPreferences = mergedPrefs;
        
        console.log('Preferences synced from Firebase');
      } else {
        // No Firebase preferences exist, push local preferences to Firebase
        const localPrefs = await this.getPreferences();
        await this.saveToFirebase(userId, localPrefs);
        console.log('Local preferences pushed to Firebase');
      }

      this.enableFirebaseSync();
    } catch (error) {
      console.error('Error syncing preferences with Firebase:', error);
      // Continue with local preferences even if Firebase sync fails
    }
  }

  /**
   * Save preferences to Firebase
   */
  private async saveToFirebase(userId: string, preferences: AppPreferences): Promise<void> {
    try {
      const userPrefsRef = doc(firestore, 'users', userId, 'preferences', 'settings');
      await setDoc(userPrefsRef, preferences);
      console.log('Preferences saved to Firebase');
    } catch (error) {
      console.error('Error saving preferences to Firebase:', error);
      // Don't throw error - local preferences are still saved
    }
  }

  // Alias for updatePreferences (for backward compatibility)
  async savePreferences(updates: Partial<AppPreferences>): Promise<void> {
    return this.updatePreferences(updates);
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