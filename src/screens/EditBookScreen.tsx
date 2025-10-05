// Edit Book Screen - Professional Material Design UI with exchange rate and currency management
import React, { useState, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Alert, 
  KeyboardAvoidingView, 
  Platform,
  Keyboard
} from 'react-native';
import {
  TextInput,
  Button,
  Card,
  Title,
  Text,
  Surface,
  useTheme,
  IconButton,
  Divider,
  Chip,
  HelperText,
  Portal,
  Dialog,
  List,
  ActivityIndicator
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/Navigation';
import { Book } from '../models/types';
import asyncStorageService from '../services/asyncStorage';
import currencyService, { Currency, SUPPORTED_CURRENCIES } from '../services/currencyService';
import { useAuth } from '../contexts/AuthContext';
import { spacing, borderRadius } from '../theme/materialTheme';

type EditBookScreenRouteProp = RouteProp<RootStackParamList, 'EditBook'>;
type EditBookScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function EditBookScreen() {
  const navigation = useNavigation<EditBookScreenNavigationProp>();
  const route = useRoute<EditBookScreenRouteProp>();
  const theme = useTheme();
  const { user } = useAuth();

  const { bookId } = route.params;

  // Book data
  const [originalBook, setOriginalBook] = useState<Book | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('INR');
  const [lockedExchangeRate, setLockedExchangeRate] = useState<number | null>(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});
  
  // Dialogs
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showRateEditor, setShowRateEditor] = useState(false);
  const [showCurrencyChangeWarning, setShowCurrencyChangeWarning] = useState(false);
  
  // Rate editing
  const [customRate, setCustomRate] = useState('');
  const [apiRate, setApiRate] = useState<number | null>(null);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [targetCurrency, setTargetCurrency] = useState('INR');

  // Load book data
  useEffect(() => {
    loadBookData();
  }, [bookId]);

  const loadBookData = async () => {
    try {
      setIsLoading(true);
      const book = await asyncStorageService.getBookById(bookId);
      
      if (!book) {
        Alert.alert('Error', 'Book not found');
        navigation.goBack();
        return;
      }

      setOriginalBook(book);
      setName(book.name);
      setDescription(book.description || '');
      setSelectedCurrency(book.currency || 'INR');
      setLockedExchangeRate(book.lockedExchangeRate || null);
      
      // Get user's default currency for rate display
      const userPrefs = await import('../services/preferences');
      const userCurrency = await userPrefs.default.getCurrency();
      setTargetCurrency(userCurrency.code);
      
    } catch (error) {
      console.error('Error loading book:', error);
      Alert.alert('Error', 'Failed to load book data');
    } finally {
      setIsLoading(false);
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: { name?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Book name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Book name must be at least 2 characters';
    } else if (name.trim().length > 50) {
      newErrors.name = 'Book name must be less than 50 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle currency change
  const handleCurrencySelect = (currency: Currency) => {
    if (originalBook && currency.code !== originalBook.currency) {
      // Show warning dialog
      setShowCurrencyPicker(false);
      setTimeout(() => {
        setShowCurrencyChangeWarning(true);
      }, 300);
      setSelectedCurrency(currency.code);
    } else {
      setSelectedCurrency(currency.code);
      setShowCurrencyPicker(false);
    }
  };

  // Confirm currency change
  const confirmCurrencyChange = async () => {
    setShowCurrencyChangeWarning(false);
    
    // Fetch new exchange rate for the new currency
    setIsFetchingRate(true);
    try {
      const rate = await currencyService.getExchangeRate(selectedCurrency, targetCurrency);
      if (rate) {
        setLockedExchangeRate(rate);
        setApiRate(rate);
        Alert.alert(
          'Currency Changed',
          `Book currency changed to ${selectedCurrency}.\n\nNew exchange rate: 1 ${selectedCurrency} = ${rate.toFixed(4)} ${targetCurrency}\n\nAll future entries will be in ${selectedCurrency}. Existing entries remain unchanged.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error fetching rate:', error);
      Alert.alert('Warning', 'Could not fetch exchange rate. You can set it manually.');
    } finally {
      setIsFetchingRate(false);
    }
  };

  // Cancel currency change
  const cancelCurrencyChange = () => {
    setShowCurrencyChangeWarning(false);
    setSelectedCurrency(originalBook?.currency || 'INR');
  };

  // Open rate editor
  const openRateEditor = async () => {
    setIsFetchingRate(true);
    try {
      const rate = await currencyService.getExchangeRate(selectedCurrency, targetCurrency);
      setApiRate(rate);
      setCustomRate(lockedExchangeRate?.toFixed(6) || rate?.toFixed(6) || '');
      setIsEditingRate(false);
      setShowRateEditor(true);
    } catch (error) {
      console.error('Error fetching rate:', error);
      Alert.alert('Error', 'Failed to fetch current exchange rate');
    } finally {
      setIsFetchingRate(false);
    }
  };

  // Save custom rate
  const saveCustomRate = () => {
    const newRate = parseFloat(customRate);
    
    if (isNaN(newRate) || newRate <= 0) {
      Alert.alert('Invalid Rate', 'Please enter a valid positive number');
      return;
    }

    // Warning if rate differs significantly from API rate
    if (apiRate && Math.abs((newRate - apiRate) / apiRate) > 0.1) {
      Alert.alert(
        '⚠️ Large Rate Difference',
        `Your rate: 1 ${selectedCurrency} = ${newRate.toFixed(4)} ${targetCurrency}\n` +
        `API rate: 1 ${selectedCurrency} = ${apiRate.toFixed(4)} ${targetCurrency}\n\n` +
        `Difference: ${(Math.abs(newRate - apiRate) / apiRate * 100).toFixed(1)}%\n\n` +
        `Are you sure this is correct?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            style: 'destructive',
            onPress: () => {
              setLockedExchangeRate(newRate);
              setShowRateEditor(false);
              Alert.alert('Rate Updated', `Exchange rate set to ${newRate.toFixed(4)}`);
            }
          }
        ]
      );
    } else {
      setLockedExchangeRate(newRate);
      setShowRateEditor(false);
      Alert.alert('Rate Updated', `Exchange rate set to ${newRate.toFixed(4)}`);
    }
  };

  // Reset to API rate
  const resetToApiRate = () => {
    if (apiRate) {
      setCustomRate(apiRate.toFixed(6));
      setIsEditingRate(false);
    }
  };

  // Handle update
  const handleUpdate = async () => {
    Keyboard.dismiss();
    
    if (!validateForm() || !originalBook) {
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to update books');
      return;
    }

    setIsLoading(true);
    
    try {
      const currencyChanged = selectedCurrency !== originalBook.currency;
      const rateChanged = lockedExchangeRate !== originalBook.lockedExchangeRate;
      
      // Prepare updates
      const updates: Partial<Book> = {
        name: name.trim(),
        description: description.trim() || undefined,
        currency: selectedCurrency,
        lockedExchangeRate: lockedExchangeRate || undefined,
        targetCurrency: targetCurrency,
        rateLockedAt: (currencyChanged || rateChanged) ? new Date() : originalBook.rateLockedAt
      };

      // Update book
      await asyncStorageService.updateBook(bookId, updates);
      
      // If currency or rate changed, update all entries' normalized amounts
      if ((currencyChanged || rateChanged) && lockedExchangeRate) {
        console.log('🔄 Updating all entries with new currency/exchange rate...');
        const entries = await asyncStorageService.getEntries(bookId);
        let updatedCount = 0;
        
        for (const entry of entries) {
          // Get the conversion rate for this entry's currency to target currency
          let entryConversionRate: number;
          
          if (entry.currency === targetCurrency) {
            // Entry is already in target currency, no conversion needed
            entryConversionRate = 1;
          } else if (entry.currency === selectedCurrency && !currencyChanged) {
            // Entry is in book currency and book currency didn't change
            entryConversionRate = lockedExchangeRate;
          } else {
            // Entry is in old currency, need to convert to target currency
            // This happens when book currency changed
            try {
              const rate = await currencyService.getExchangeRate(entry.currency, targetCurrency);
              if (!rate) {
                console.error(`No rate available for ${entry.currency} → ${targetCurrency}, skipping entry ${entry.id}`);
                continue;
              }
              entryConversionRate = rate;
            } catch (error) {
              console.error(`Failed to get rate for ${entry.currency} → ${targetCurrency}, skipping entry ${entry.id}`);
              continue;
            }
          }
          
          const newNormalizedAmount = entry.amount * entryConversionRate;
          await asyncStorageService.updateEntry(entry.id, {
            normalizedAmount: newNormalizedAmount,
            normalizedCurrency: targetCurrency,
            conversionRate: entryConversionRate
          });
          updatedCount++;
        }
        
        console.log(`✅ Updated ${updatedCount} entries with new rates`);
        
        // Invalidate cache to refresh all screens
        const dataCache = await import('../services/dataCache');
        dataCache.default.invalidate('books');
        dataCache.default.invalidate('entries');
      }
      
      Alert.alert(
        'Success',
        'Book updated successfully!' + 
        (currencyChanged ? '\n\nNote: Existing entries remain in their original currency but normalized amounts have been recalculated.' : ''),
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
      
    } catch (error) {
      console.error('Error updating book:', error);
      Alert.alert('Error', 'Failed to update book. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete
  const handleDelete = () => {
    Alert.alert(
      'Delete Book',
      `Are you sure you want to delete "${originalBook?.name}"?\n\nThis will permanently delete the book and all its entries. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await asyncStorageService.deleteBook(bookId);
              Alert.alert('Deleted', 'Book deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => {
                    // Navigate back to main screen, books tab
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'Main' }],
                    });
                  }
                }
              ]);
            } catch (error) {
              console.error('Error deleting book:', error);
              Alert.alert('Error', 'Failed to delete book');
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  if (isLoading && !originalBook) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.onBackground }]}>
          Loading book...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Card */}
        <Surface style={[styles.headerCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={styles.headerContent}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
              <MaterialIcons name="edit" size={28} color={theme.colors.onPrimaryContainer} />
            </View>
            <View style={styles.headerText}>
              <Title style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
                Edit Book
              </Title>
              <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Update book details and settings
              </Text>
            </View>
          </View>
        </Surface>

        {/* Basic Information Card */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="info" size={20} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Basic Information
              </Text>
            </View>

            <TextInput
              label="Book Name *"
              value={name}
              onChangeText={setName}
              mode="outlined"
              error={!!errors.name}
              style={styles.input}
              left={<TextInput.Icon icon="book" />}
              maxLength={50}
            />
            <HelperText type="error" visible={!!errors.name}>
              {errors.name}
            </HelperText>

            <TextInput
              label="Description (Optional)"
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              left={<TextInput.Icon icon="text" />}
              maxLength={200}
            />
            <HelperText type="info" visible>
              {description.length}/200 characters
            </HelperText>
          </Card.Content>
        </Card>

        {/* Currency Settings Card */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="attach-money" size={20} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Currency Settings
              </Text>
            </View>

            {/* Currency Selector */}
            <Surface style={[styles.settingItem, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
              <View style={styles.settingContent}>
                <View style={styles.settingLeft}>
                  <MaterialIcons name="monetization-on" size={24} color={theme.colors.primary} />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>
                      Book Currency
                    </Text>
                    <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
                      All entries will be in this currency
                    </Text>
                  </View>
                </View>
                <Chip
                  icon="currency-exchange"
                  onPress={() => setShowCurrencyPicker(true)}
                  style={[styles.currencyChip, { backgroundColor: theme.colors.primaryContainer }]}
                  textStyle={{ color: theme.colors.onPrimaryContainer }}
                >
                  {currencyService.getCurrencyByCode(selectedCurrency)?.symbol} {selectedCurrency}
                </Chip>
              </View>
            </Surface>

            <Divider style={styles.divider} />

            {/* Exchange Rate */}
            <Surface style={[styles.settingItem, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
              <View style={styles.settingContent}>
                <View style={styles.settingLeft}>
                  <MaterialIcons name="swap-horiz" size={24} color={theme.colors.secondary} />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>
                      Exchange Rate
                    </Text>
                    <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
                      {selectedCurrency} → {targetCurrency}
                    </Text>
                  </View>
                </View>
                <View style={styles.rateContainer}>
                  {lockedExchangeRate ? (
                    <View style={styles.rateDisplay}>
                      <Text style={[styles.rateValue, { color: theme.colors.onSurface }]}>
                        {lockedExchangeRate.toFixed(4)}
                      </Text>
                      <IconButton
                        icon="pencil"
                        size={20}
                        iconColor={theme.colors.primary}
                        onPress={openRateEditor}
                        style={styles.editRateButton}
                      />
                    </View>
                  ) : (
                    <Button
                      mode="outlined"
                      onPress={openRateEditor}
                      compact
                      loading={isFetchingRate}
                    >
                      Set Rate
                    </Button>
                  )}
                </View>
              </View>
            </Surface>

            <HelperText type="info" visible>
              Exchange rate is locked at book creation. Changes will affect all future calculations.
            </HelperText>
          </Card.Content>
        </Card>

        {/* Metadata Card */}
        {originalBook && (
          <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Card.Content>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="schedule" size={20} color={theme.colors.primary} />
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                  Information
                </Text>
              </View>

              <View style={styles.metadataRow}>
                <MaterialIcons name="event" size={16} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.metadataText, { color: theme.colors.onSurfaceVariant }]}>
                  Created: {new Date(originalBook.createdAt).toLocaleDateString()}
                </Text>
              </View>

              <View style={styles.metadataRow}>
                <MaterialIcons name="update" size={16} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.metadataText, { color: theme.colors.onSurfaceVariant }]}>
                  Last Updated: {new Date(originalBook.updatedAt).toLocaleDateString()}
                </Text>
              </View>

              {originalBook.rateLockedAt && (
                <View style={styles.metadataRow}>
                  <MaterialIcons name="lock-clock" size={16} color={theme.colors.onSurfaceVariant} />
                  <Text style={[styles.metadataText, { color: theme.colors.onSurfaceVariant }]}>
                    Rate Locked: {new Date(originalBook.rateLockedAt).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Button
            mode="contained"
            onPress={handleUpdate}
            loading={isLoading}
            disabled={isLoading}
            icon="check"
            style={[styles.updateButton, { backgroundColor: theme.colors.primary }]}
            labelStyle={{ color: theme.colors.onPrimary }}
            contentStyle={styles.buttonContent}
          >
            Update Book
          </Button>

          <Button
            mode="outlined"
            onPress={handleDelete}
            disabled={isLoading}
            icon="delete"
            textColor={theme.colors.error}
            style={[styles.deleteButton, { borderColor: theme.colors.error }]}
            contentStyle={styles.buttonContent}
          >
            Delete Book
          </Button>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Currency Picker Dialog */}
      <Portal>
        <Dialog
          visible={showCurrencyPicker}
          onDismiss={() => setShowCurrencyPicker(false)}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title>Select Currency</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView>
              {SUPPORTED_CURRENCIES.map((currency) => (
                <List.Item
                  key={currency.code}
                  title={`${currency.name} (${currency.code})`}
                  description={`${currency.symbol} ${currency.code}`}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon={selectedCurrency === currency.code ? 'check-circle' : 'circle-outline'}
                      color={selectedCurrency === currency.code ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    />
                  )}
                  onPress={() => handleCurrencySelect(currency)}
                  style={[
                    styles.currencyItem,
                    selectedCurrency === currency.code && {
                      backgroundColor: theme.colors.primaryContainer
                    }
                  ]}
                />
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowCurrencyPicker(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Currency Change Warning Dialog */}
      <Portal>
        <Dialog
          visible={showCurrencyChangeWarning}
          onDismiss={cancelCurrencyChange}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Icon icon="alert" color={theme.colors.error} size={48} />
          <Dialog.Title style={styles.dialogTitle}>Change Currency?</Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.warningText, { color: theme.colors.onSurface }]}>
              You are about to change this book's currency from {originalBook?.currency} to {selectedCurrency}.
            </Text>
            
            <View style={[styles.warningBox, { backgroundColor: theme.colors.errorContainer }]}>
              <MaterialIcons name="warning" size={24} color={theme.colors.error} />
              <Text style={[styles.warningBoxText, { color: theme.colors.onErrorContainer }]}>
                Important: Existing entries will remain in {originalBook?.currency}. Only new entries will be in {selectedCurrency}.
              </Text>
            </View>

            <Text style={[styles.warningDetail, { color: theme.colors.onSurfaceVariant }]}>
              {'\n'}What will happen:{'\n'}
              • All existing entries stay in {originalBook?.currency}{'\n'}
              • New exchange rate will be fetched{'\n'}
              • Future entries will be in {selectedCurrency}{'\n'}
              • Analytics will convert everything to your default currency
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={cancelCurrencyChange}>Cancel</Button>
            <Button
              onPress={confirmCurrencyChange}
              textColor={theme.colors.error}
              loading={isFetchingRate}
            >
              Change Currency
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Exchange Rate Editor Dialog */}
      <Portal>
        <Dialog
          visible={showRateEditor}
          onDismiss={() => setShowRateEditor(false)}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title>Exchange Rate</Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.rateDialogText, { color: theme.colors.onSurface }]}>
              1 {selectedCurrency} = ? {targetCurrency}
            </Text>

            {apiRate && (
              <Surface style={[styles.apiRateBox, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
                <MaterialIcons name="cloud" size={20} color={theme.colors.primary} />
                <Text style={[styles.apiRateText, { color: theme.colors.onSurfaceVariant }]}>
                  Current API Rate: {apiRate.toFixed(6)}
                </Text>
              </Surface>
            )}

            {!isEditingRate ? (
              <View style={styles.rateDisplayContainer}>
                <Text style={[styles.currentRateLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Your Rate:
                </Text>
                <Text style={[styles.currentRateValue, { color: theme.colors.primary }]}>
                  {customRate}
                </Text>
                <Button
                  mode="outlined"
                  onPress={() => setIsEditingRate(true)}
                  icon="pencil"
                  style={styles.editButton}
                >
                  Edit
                </Button>
              </View>
            ) : (
              <>
                <TextInput
                  label="Custom Exchange Rate"
                  value={customRate}
                  onChangeText={setCustomRate}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  style={styles.rateInput}
                  left={<TextInput.Icon icon="calculator" />}
                />
                <View style={styles.rateActions}>
                  <Button
                    mode="text"
                    onPress={resetToApiRate}
                    icon="refresh"
                  >
                    Reset to API
                  </Button>
                </View>
              </>
            )}

            <HelperText type="info" visible>
              This rate will be used for all calculations. Changes affect all entries in this book.
            </HelperText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowRateEditor(false)}>Cancel</Button>
            <Button onPress={saveCustomRate} mode="contained">
              Save Rate
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
  },
  headerCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  card: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  input: {
    marginBottom: spacing.xs,
  },
  settingItem: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  settingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
  },
  currencyChip: {
    marginLeft: spacing.sm,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  rateContainer: {
    marginLeft: spacing.sm,
  },
  rateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rateValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  editRateButton: {
    margin: 0,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  metadataText: {
    fontSize: 14,
    marginLeft: spacing.sm,
  },
  actionsContainer: {
    marginTop: spacing.md,
  },
  updateButton: {
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
  },
  deleteButton: {
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
  dialog: {
    maxHeight: '80%',
    borderRadius: borderRadius.lg,
  },
  dialogScrollArea: {
    maxHeight: 400,
  },
  dialogTitle: {
    textAlign: 'center',
  },
  currencyItem: {
    paddingVertical: spacing.xs,
  },
  warningText: {
    fontSize: 16,
    marginBottom: spacing.md,
    lineHeight: 24,
  },
  warningBox: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  warningBoxText: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
  },
  warningDetail: {
    fontSize: 14,
    lineHeight: 22,
  },
  rateDialogText: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  apiRateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  apiRateText: {
    fontSize: 14,
    marginLeft: spacing.sm,
  },
  rateDisplayContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  currentRateLabel: {
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  currentRateValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  editButton: {
    minWidth: 120,
  },
  rateInput: {
    marginBottom: spacing.sm,
  },
  rateActions: {
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
});
