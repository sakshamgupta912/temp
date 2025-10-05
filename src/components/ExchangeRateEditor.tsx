// ExchangeRateEditor - Component to view and edit exchange rates with warnings
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Dialog,
  Portal,
  Button,
  Text,
  TextInput,
  Surface,
  Chip,
  Divider,
  useTheme,
  IconButton,
  HelperText
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import currencyService from '../services/currencyService';
import { spacing, borderRadius } from '../theme/materialTheme';

interface ExchangeRateEditorProps {
  visible: boolean;
  onDismiss: () => void;
  baseCurrency: string;
  userDefaultCurrency: string; // User's default currency for dashboard
  bookId?: string;
  onRateUpdated?: () => void;
}

interface RateData {
  currency: string;
  apiRate: number;
  customRate: number | null;
  editedRate: string;
  isEditing: boolean;
  hasWarning: boolean;
  warningMessage?: string;
}

export const ExchangeRateEditor: React.FC<ExchangeRateEditorProps> = ({
  visible,
  onDismiss,
  baseCurrency,
  userDefaultCurrency,
  bookId,
  onRateUpdated
}) => {
  const theme = useTheme();
  const [rates, setRates] = useState<RateData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (visible) {
      loadRates();
    }
  }, [visible, baseCurrency]);

  const loadRates = async () => {
    try {
      setLoading(true);
      
      // Only load the rate for user's default currency
      if (baseCurrency === userDefaultCurrency) {
        // Same currency, no rate needed
        setRates([]);
        return;
      }
      
      const historicalRates = await currencyService.captureHistoricalRates(baseCurrency);
      const apiRate = historicalRates.rates[userDefaultCurrency];
      
      if (!apiRate) {
        Alert.alert('Error', `Rate not available for ${userDefaultCurrency}`);
        setRates([]);
        return;
      }
      
      const customRateData = await currencyService.getCustomExchangeRate(
        baseCurrency,
        userDefaultCurrency,
        bookId
      );
      
      setRates([{
        currency: userDefaultCurrency,
        apiRate,
        customRate: customRateData?.rate || null,
        editedRate: '',
        isEditing: false,
        hasWarning: false
      }]);
    } catch (error) {
      console.error('Error loading rates:', error);
      Alert.alert('Error', 'Failed to load exchange rate');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (currency: string) => {
    setRates(prev => prev.map(r => 
      r.currency === currency
        ? { ...r, isEditing: true, editedRate: (r.customRate || r.apiRate).toString() }
        : r
    ));
  };

  const cancelEditing = (currency: string) => {
    setRates(prev => prev.map(r => 
      r.currency === currency
        ? { ...r, isEditing: false, editedRate: '', hasWarning: false, warningMessage: undefined }
        : r
    ));
  };

  const validateAndSave = async (currency: string) => {
    const rate = rates.find(r => r.currency === currency);
    if (!rate) return;

    const newRate = parseFloat(rate.editedRate);
    
    if (isNaN(newRate) || newRate <= 0) {
      Alert.alert('Invalid Rate', 'Please enter a valid positive number');
      return;
    }

    // Validate the rate
    const validation = currencyService.validateCustomRate(
      baseCurrency,
      currency,
      newRate,
      rate.apiRate
    );

    if (!validation.valid) {
      Alert.alert('Invalid Rate', validation.warning || 'Invalid exchange rate');
      return;
    }

    // Show warning if rate differs significantly
    if (validation.warning) {
      Alert.alert(
        '⚠️ Data Integrity Warning',
        `${validation.warning}\n\n` +
        `Current API Rate: 1 ${baseCurrency} = ${rate.apiRate.toFixed(4)} ${currency}\n` +
        `Your Custom Rate: 1 ${baseCurrency} = ${newRate.toFixed(4)} ${currency}\n\n` +
        `Setting a custom rate will affect all future calculations. This change will be logged in the book's history.\n\n` +
        `Are you sure you want to proceed?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => cancelEditing(currency) },
          { text: 'Confirm', style: 'destructive', onPress: () => saveRate(currency, newRate) }
        ]
      );
    } else {
      saveRate(currency, newRate);
    }
  };

  const saveRate = async (currency: string, newRate: number) => {
    try {
      // Save as custom rate
      await currencyService.saveCustomExchangeRate(baseCurrency, currency, newRate, bookId);
      
      // Also update the book's locked exchange rate if bookId is provided
      if (bookId) {
        const asyncStorageService = require('../services/asyncStorage').default;
        const book = await asyncStorageService.getBookById(bookId);
        
        if (book) {
          await asyncStorageService.updateBook(bookId, {
            lockedExchangeRate: newRate,
            targetCurrency: currency,
            rateLockedAt: new Date()
          });
          console.log(`📌 Updated book's locked rate: 1 ${baseCurrency} = ${newRate} ${currency}`);
          
          // Update all existing entries' normalized amounts with new rate
          console.log(`🔄 Updating normalized amounts for all entries in this book...`);
          const entries = await asyncStorageService.getEntries(bookId);
          let updatedCount = 0;
          
          for (const entry of entries) {
            // Only update if entry is in book's currency
            if (entry.currency === baseCurrency) {
              const newNormalizedAmount = entry.amount * newRate;
              await asyncStorageService.updateEntry(entry.id, {
                normalizedAmount: newNormalizedAmount,
                normalizedCurrency: currency,
                conversionRate: newRate
              });
              updatedCount++;
            }
          }
          
          console.log(`✅ Updated ${updatedCount} entries with new exchange rate`);
          
          // Force cache invalidation to ensure Dashboard refreshes
          const dataCacheService = require('../services/dataCache').dataCacheService;
          await dataCacheService.invalidatePattern(`entries:bookId:${bookId}`);
          await dataCacheService.invalidatePattern(`books`);
          console.log(`🔄 Cache invalidated - Dashboard will show updated values`);
        }
      }
      
      setRates(prev => prev.map(r => 
        r.currency === currency
          ? { ...r, customRate: newRate, isEditing: false, editedRate: '', hasWarning: false }
          : r
      ));
      
      setHasChanges(true);
      Alert.alert('Success', `Custom rate saved: 1 ${baseCurrency} = ${newRate.toFixed(4)} ${currency}`);
    } catch (error) {
      console.error('Error saving rate:', error);
      Alert.alert('Error', 'Failed to save custom rate');
    }
  };

  const revertToAPI = async (currency: string) => {
    Alert.alert(
      'Revert to API Rate?',
      `This will remove your custom rate and use the live API rate again.\n\nAre you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Revert', 
          style: 'destructive',
          onPress: async () => {
            try {
              await currencyService.clearCustomExchangeRate(baseCurrency, currency, bookId);
              
              // Get the current API rate and update the book's locked rate
              if (bookId) {
                const rate = rates.find(r => r.currency === currency);
                if (rate) {
                  const asyncStorageService = require('../services/asyncStorage').default;
                  const book = await asyncStorageService.getBookById(bookId);
                  if (book) {
                    await asyncStorageService.updateBook(bookId, {
                      lockedExchangeRate: rate.apiRate,
                      targetCurrency: currency,
                      rateLockedAt: new Date()
                    });
                    console.log(`📌 Reverted book's locked rate to API: 1 ${baseCurrency} = ${rate.apiRate} ${currency}`);
                  }
                }
              }
              
              setRates(prev => prev.map(r => 
                r.currency === currency
                  ? { ...r, customRate: null }
                  : r
              ));
              
              setHasChanges(true);
              Alert.alert('Success', 'Reverted to API rate');
            } catch (error) {
              console.error('Error reverting rate:', error);
              Alert.alert('Error', 'Failed to revert rate');
            }
          }
        }
      ]
    );
  };

  const handleClose = () => {
    if (hasChanges && onRateUpdated) {
      onRateUpdated();
    }
    onDismiss();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleClose} style={styles.dialog}>
        <Dialog.Title>
          <View style={styles.titleRow}>
            <MaterialIcons name="swap-horiz" size={24} color={theme.colors.primary} />
            <Text variant="titleLarge" style={{ marginLeft: spacing.sm }}>
              Exchange Rates for {baseCurrency}
            </Text>
          </View>
        </Dialog.Title>
        
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            <View style={styles.content}>
              <Surface style={[styles.infoCard, { backgroundColor: theme.colors.secondaryContainer }]} elevation={0}>
                <MaterialIcons name="info" size={20} color={theme.colors.onSecondaryContainer} />
                <Text variant="bodySmall" style={[styles.infoText, { color: theme.colors.onSecondaryContainer }]}>
                  This rate converts {baseCurrency} entries to {userDefaultCurrency} (your default currency) on the dashboard.
                  You can customize it if needed - changes are logged for transparency.
                </Text>
              </Surface>

              {loading ? (
                <Text style={{ textAlign: 'center', padding: spacing.lg, color: theme.colors.onSurface }}>
                  Loading rates...
                </Text>
              ) : (
                rates.map((rate, index) => (
                  <View key={rate.currency}>
                    <Surface style={[styles.rateCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                      <View style={styles.rateHeader}>
                        <View>
                          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                            {currencyService.getCurrencyByCode(rate.currency)?.name || rate.currency}
                          </Text>
                          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            1 {baseCurrency} = {rate.currency}
                          </Text>
                        </View>
                        
                        {rate.customRate && (
                          <Chip 
                            icon="pencil" 
                            mode="flat"
                            style={{ backgroundColor: theme.colors.tertiaryContainer }}
                            textStyle={{ color: theme.colors.onTertiaryContainer, fontSize: 11 }}
                          >
                            Custom
                          </Chip>
                        )}
                      </View>

                      {rate.isEditing ? (
                        <View style={styles.editSection}>
                          <TextInput
                            mode="outlined"
                            label="Custom Rate"
                            value={rate.editedRate}
                            onChangeText={(text) => {
                              setRates(prev => prev.map(r => 
                                r.currency === rate.currency
                                  ? { ...r, editedRate: text }
                                  : r
                              ));
                            }}
                            keyboardType="decimal-pad"
                            style={styles.input}
                            dense
                          />
                          <View style={styles.editButtons}>
                            <Button 
                              mode="outlined" 
                              onPress={() => cancelEditing(rate.currency)}
                              style={{ flex: 1, marginRight: spacing.xs }}
                            >
                              Cancel
                            </Button>
                            <Button 
                              mode="contained" 
                              onPress={() => validateAndSave(rate.currency)}
                              style={{ flex: 1 }}
                            >
                              Save
                            </Button>
                          </View>
                          <HelperText type="info" visible={true}>
                            API Rate: {rate.apiRate.toFixed(4)}
                          </HelperText>
                        </View>
                      ) : (
                        <View style={styles.displaySection}>
                          <View style={styles.rateDisplay}>
                            <Text variant="headlineSmall" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                              {(rate.customRate || rate.apiRate).toFixed(4)}
                            </Text>
                            {rate.customRate && rate.customRate !== rate.apiRate && (
                              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                API: {rate.apiRate.toFixed(4)}
                              </Text>
                            )}
                          </View>
                          
                          <View style={styles.actionButtons}>
                            <IconButton
                              icon="pencil"
                              size={20}
                              onPress={() => startEditing(rate.currency)}
                              mode="contained-tonal"
                            />
                            {rate.customRate && (
                              <IconButton
                                icon="refresh"
                                size={20}
                                onPress={() => revertToAPI(rate.currency)}
                                mode="contained-tonal"
                              />
                            )}
                          </View>
                        </View>
                      )}
                    </Surface>
                    
                    {index < rates.length - 1 && (
                      <Divider style={{ marginVertical: spacing.sm }} />
                    )}
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </Dialog.ScrollArea>

        <Dialog.Actions>
          <Button onPress={handleClose}>Done</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
  },
  scrollArea: {
    maxHeight: 500,
    paddingHorizontal: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    padding: spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    lineHeight: 18,
  },
  rateCard: {
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  rateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  editSection: {
    marginTop: spacing.sm,
  },
  input: {
    marginBottom: spacing.sm,
  },
  editButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  displaySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rateDisplay: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
