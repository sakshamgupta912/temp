// Add Book screen - Material Design form to create new expense books
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Pressable
} from 'react-native';
import { 
  TextInput, 
  Button, 
  Surface, 
  Text,
  Divider,
  useTheme,
  HelperText
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import asyncStorageService from '../services/asyncStorage';
import { RootStackParamList } from '../navigation/Navigation';
import { spacing, borderRadius } from '../theme/materialTheme';
import { CurrencyPicker } from '../components/CurrencyPicker';
import preferencesService from '../services/preferences';
import currencyService from '../services/currencyService';

type AddBookNavigationProp = StackNavigationProp<RootStackParamList, 'AddBook'>;

const AddBookScreen: React.FC = () => {
  const navigation = useNavigation<AddBookNavigationProp>();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: number } | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [showRates, setShowRates] = useState(false);
  const [userDefaultCurrency, setUserDefaultCurrency] = useState<string>('USD');
  const [lockedExchangeRate, setLockedExchangeRate] = useState<number | null>(null);
  const [customRate, setCustomRate] = useState<string>(''); // For editing
  const [isEditingRate, setIsEditingRate] = useState(false);
  const theme = useTheme();
  const { width } = Dimensions.get('window');

  // Load default currency on component mount
  React.useEffect(() => {
    const loadDefaultCurrency = async () => {
      try {
        const prefs = await preferencesService.getPreferences();
        setCurrency(prefs.currency);
        setUserDefaultCurrency(prefs.currency); // Store user's default currency
      } catch (error) {
        console.error('Error loading default currency:', error);
        setCurrency('USD'); // fallback
        setUserDefaultCurrency('USD');
      }
    };
    loadDefaultCurrency();
  }, []);

  const validateName = (value: string) => {
    if (!value.trim()) {
      setNameError('Book name is required');
      return false;
    }
    if (value.trim().length < 2) {
      setNameError('Book name must be at least 2 characters');
      return false;
    }
    if (value.trim().length > 50) {
      setNameError('Book name must be less than 50 characters');
      return false;
    }
    setNameError('');
    return true;
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (nameError) {
      validateName(value);
    }
  };

  // Load exchange rates when currency changes
  const loadExchangeRates = async (currencyCode: string) => {
    if (!currencyCode) return;
    
    try {
      setLoadingRates(true);
      const rates = await currencyService.captureHistoricalRates(currencyCode);
      setExchangeRates(rates.rates);
      console.log(`Loaded exchange rates for ${currencyCode}:`, Object.keys(rates.rates).length, 'currencies');
      
      // Set the locked rate for book currency → user default currency
      if (currencyCode !== userDefaultCurrency && rates.rates[userDefaultCurrency]) {
        const rate = rates.rates[userDefaultCurrency];
        setLockedExchangeRate(rate);
        setCustomRate(rate.toFixed(6));
        console.log(`Locked exchange rate: 1 ${currencyCode} = ${rate} ${userDefaultCurrency}`);
      } else if (currencyCode === userDefaultCurrency) {
        setLockedExchangeRate(1);
        setCustomRate('1.000000');
      }
    } catch (error) {
      console.error('Error loading exchange rates:', error);
      setExchangeRates(null);
    } finally {
      setLoadingRates(false);
    }
  };

  // Load rates when currency changes
  React.useEffect(() => {
    if (currency) {
      loadExchangeRates(currency);
    }
  }, [currency]);

  const handleCreateBook = async () => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    const isNameValid = validateName(name);
    if (!isNameValid) {
      return;
    }

    setIsLoading(true);
    try {
      console.log('AddBook: Starting book creation process', {
        name: name.trim(),
        description: description.trim(),
        currency: currency || 'default',
        userId: user.id
      });

      // NEW: Currency is now MANDATORY (must match the new architecture)
      if (!currency) {
        Alert.alert('Error', 'Please select a currency for this book');
        return;
      }

      console.log('📘 Creating book with locked exchange rate:', {
        currency,
        userDefaultCurrency,
        lockedExchangeRate,
        targetCurrency: currency !== userDefaultCurrency ? userDefaultCurrency : undefined
      });

      const book = await asyncStorageService.createBook({
        name: name.trim(),
        description: description.trim(),
        currency: currency, // REQUIRED: Book must have a currency
        userId: user.id,
        lockedExchangeRate: lockedExchangeRate || undefined,
        targetCurrency: currency !== userDefaultCurrency ? userDefaultCurrency : undefined,
        rateLockedAt: lockedExchangeRate ? new Date() : undefined
      });

      console.log('✅ Book created successfully with rate:', {
        bookId: book.id,
        currency: book.currency,
        lockedExchangeRate: book.lockedExchangeRate,
        targetCurrency: book.targetCurrency
      });
      Alert.alert(
        'Success',
        `"${book.name}" has been created successfully!`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      console.error('AddBook: Error creating book:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to create book: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (name || description) {
      Alert.alert(
        'Discard Changes',
        'Are you sure you want to discard your changes?',
        [
          { text: 'Continue Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const isFormValid = name.trim().length >= 2 && !nameError;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      
      {/* Header Section */}
      <Surface style={[styles.headerSection, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
        <View style={styles.headerContent}>
          <Surface style={[styles.headerIcon, { backgroundColor: theme.colors.primary }]} elevation={2}>
            <MaterialIcons name="library-add" size={32} color={theme.colors.onPrimary} />
          </Surface>
          <Text variant="headlineMedium" style={[styles.headerTitle, { color: theme.colors.onPrimaryContainer }]}>
            Create New Book
          </Text>
          <Text variant="bodyLarge" style={[styles.headerSubtitle, { color: theme.colors.onPrimaryContainer }]}>
            Organize your expenses with a new book
          </Text>
        </View>
      </Surface>

      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          
          {/* Form Section */}
          <Surface style={[styles.formCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.formContent}>
              
              <View style={styles.formSection}>
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                  Book Information
                </Text>
                <Text variant="bodyMedium" style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
                  Give your book a descriptive name to easily identify it later
                </Text>
              </View>

              <View style={styles.inputSection}>
                <TextInput
                  label="Book Name"
                  value={name}
                  onChangeText={handleNameChange}
                  mode="outlined"
                  style={styles.input}
                  placeholder="e.g., Monthly Expenses, Vacation 2025, Business"
                  maxLength={50}
                  autoFocus
                  error={!!nameError}
                  right={
                    <TextInput.Affix 
                      text={`${name.length}/50`} 
                      textStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}
                    />
                  }
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                  textColor={theme.colors.onSurface}
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                />
                {nameError ? (
                  <HelperText type="error" visible={true}>
                    {nameError}
                  </HelperText>
                ) : (
                  <HelperText type="info" visible={true}>
                    Choose a name that helps you identify this book's purpose
                  </HelperText>
                )}
              </View>

              <Divider style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

              <View style={styles.inputSection}>
                <TextInput
                  label="Description (Optional)"
                  value={description}
                  onChangeText={setDescription}
                  mode="outlined"
                  style={styles.input}
                  placeholder="Add more details about this book..."
                  maxLength={200}
                  multiline
                  numberOfLines={3}
                  right={
                    <TextInput.Affix 
                      text={`${description.length}/200`} 
                      textStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}
                    />
                  }
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                  textColor={theme.colors.onSurface}
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                />
                <HelperText type="info" visible={true}>
                  Describe what expenses you'll track in this book
                </HelperText>
              </View>

              <Divider style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

              <View style={styles.inputSection}>
                <CurrencyPicker
                  selectedCurrency={currency}
                  onCurrencySelect={(selectedCurrency) => setCurrency(selectedCurrency.code)}
                  label="Currency (Required)"
                  showFlag={true}
                  style={styles.currencyPicker}
                />
                <HelperText type="info" visible={true}>
                  All entries in this book will use this currency. Choose carefully - this determines your book's base currency.
                </HelperText>

                {/* Exchange Rate Display - Only show if book currency differs from user's default */}
                {currency && currency !== userDefaultCurrency && (
                  <Surface style={[styles.ratesSection, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
                    <Pressable onPress={() => setShowRates(!showRates)} style={styles.ratesToggle}>
                      <View style={styles.ratesToggleContent}>
                        <View style={styles.ratesToggleLeft}>
                          <MaterialIcons name="trending-up" size={18} color={theme.colors.primary} />
                          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant, marginLeft: spacing.xs }}>
                            View Exchange Rate
                          </Text>
                        </View>
                        <MaterialIcons 
                          name={showRates ? "expand-less" : "expand-more"} 
                          size={24} 
                          color={theme.colors.onSurfaceVariant} 
                        />
                      </View>
                    </Pressable>
                    
                    {showRates && (
                      <View style={styles.ratesContent}>
                        {loadingRates ? (
                          <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', padding: spacing.md }}>
                            Loading rate...
                          </Text>
                        ) : lockedExchangeRate ? (
                          <View style={styles.rateDisplay}>
                            {!isEditingRate ? (
                              <>
                                <View style={styles.rateItem}>
                                  <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 14 }}>
                                    1 {currency} =
                                  </Text>
                                  <Text style={{ color: theme.colors.onSurface, fontSize: 18, fontWeight: '600' }}>
                                    {lockedExchangeRate.toFixed(6)} {userDefaultCurrency}
                                  </Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm }}>
                                  <Button 
                                    mode="outlined" 
                                    icon="pencil"
                                    onPress={() => setIsEditingRate(true)}
                                    compact
                                  >
                                    Edit Rate
                                  </Button>
                                  <Button 
                                    mode="text" 
                                    icon="refresh"
                                    onPress={() => {
                                      if (exchangeRates && exchangeRates[userDefaultCurrency]) {
                                        const apiRate = exchangeRates[userDefaultCurrency];
                                        setLockedExchangeRate(apiRate);
                                        setCustomRate(apiRate.toFixed(6));
                                      }
                                    }}
                                    compact
                                  >
                                    Reset to API
                                  </Button>
                                </View>
                              </>
                            ) : (
                              <>
                                <TextInput
                                  mode="outlined"
                                  label={`Exchange Rate (1 ${currency} = ? ${userDefaultCurrency})`}
                                  value={customRate}
                                  onChangeText={setCustomRate}
                                  keyboardType="decimal-pad"
                                  dense
                                  style={{ marginBottom: spacing.sm }}
                                />
                                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                                  <Button 
                                    mode="outlined" 
                                    onPress={() => {
                                      setIsEditingRate(false);
                                      setCustomRate(lockedExchangeRate.toFixed(6));
                                    }}
                                    compact
                                    style={{ flex: 1 }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    mode="contained" 
                                    onPress={() => {
                                      const newRate = parseFloat(customRate);
                                      if (!isNaN(newRate) && newRate > 0) {
                                        setLockedExchangeRate(newRate);
                                        setIsEditingRate(false);
                                      } else {
                                        Alert.alert('Invalid Rate', 'Please enter a valid positive number');
                                      }
                                    }}
                                    compact
                                    style={{ flex: 1 }}
                                  >
                                    Save
                                  </Button>
                                </View>
                              </>
                            )}
                            <HelperText type="info" visible={true} style={{ fontSize: 11, marginTop: spacing.xs }}>
                              This rate will be locked at book creation and used for all conversions to {userDefaultCurrency}. You can change it later.
                            </HelperText>
                          </View>
                        ) : (
                          <Text style={{ color: theme.colors.error, textAlign: 'center', padding: spacing.md }}>
                            Failed to load rate
                          </Text>
                        )}
                      </View>
                    )}
                  </Surface>
                )}
                
                {/* Show helpful message if book currency matches user's default */}
                {currency && currency === userDefaultCurrency && (
                  <HelperText type="info" visible={true}>
                    This book uses your default currency ({userDefaultCurrency}), so no conversion is needed.
                  </HelperText>
                )}
              </View>

            </View>
          </Surface>

          {/* Preview Section */}
          <Surface style={[styles.previewCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.previewContent}>
              <Text variant="titleMedium" style={[styles.previewTitle, { color: theme.colors.onSurface }]}>
                Preview
              </Text>
              <View style={styles.previewBook}>
                <View style={styles.previewHeader}>
                  <Surface style={[styles.previewIcon, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
                    <MaterialIcons name="book" size={20} color={theme.colors.onPrimaryContainer} />
                  </Surface>
                  <View style={styles.previewInfo}>
                    <Text variant="titleMedium" style={[styles.previewName, { color: theme.colors.onSurface }]}>
                      {name || 'Book Name'}
                    </Text>
                    {description && (
                      <Text variant="bodySmall" style={[styles.previewDescription, { color: theme.colors.onSurfaceVariant }]}>
                        {description}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </Surface>

        </ScrollView>

        {/* Action Buttons */}
        <Surface style={[styles.actionBar, { backgroundColor: theme.colors.surface }]} elevation={3}>
          <View style={styles.actionButtons}>
            <Button
              mode="outlined"
              onPress={handleCancel}
              style={[styles.cancelButton, { borderColor: theme.colors.outline }]}
              labelStyle={{ color: theme.colors.onSurface }}
              contentStyle={styles.buttonContent}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleCreateBook}
              style={[styles.createButton, { backgroundColor: isFormValid ? theme.colors.primary : theme.colors.surfaceVariant }]}
              labelStyle={{ color: isFormValid ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}
              contentStyle={styles.buttonContent}
              loading={isLoading}
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Book'}
            </Button>
          </View>
        </Surface>

      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    paddingTop: spacing.xxl + 20,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontWeight: '600',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  headerSubtitle: {
    opacity: 0.8,
    textAlign: 'center',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  formCard: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  formContent: {
    padding: spacing.lg,
  },
  formSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    opacity: 0.8,
    lineHeight: 20,
  },
  inputSection: {
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: 'transparent',
  },
  divider: {
    marginVertical: spacing.lg,
    height: 1,
  },
  previewCard: {
    borderRadius: borderRadius.md,
  },
  previewContent: {
    padding: spacing.lg,
  },
  previewTitle: {
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  previewBook: {
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderStyle: 'dashed',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontWeight: '600',
    opacity: 0.8,
  },
  previewDescription: {
    marginTop: spacing.xs / 2,
    opacity: 0.6,
  },
  actionBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopLeftRadius: borderRadius.md,
    borderTopRightRadius: borderRadius.md,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    borderRadius: borderRadius.lg,
  },
  createButton: {
    flex: 2,
    borderRadius: borderRadius.lg,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  currencyPicker: {
    marginVertical: 0,
  },
  // Exchange rates styles
  ratesSection: {
    marginTop: spacing.md,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  ratesToggle: {
    padding: spacing.md,
  },
  ratesToggleContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratesToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratesContent: {
    padding: spacing.md,
  },
  rateDisplay: {
    alignItems: 'center',
  },
  rateItem: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    padding: spacing.md,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
    width: '100%',
  },
});

export default AddBookScreen;