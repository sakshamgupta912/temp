// Add Entry screen - comprehensive Material Design form to create new entries
import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { 
  TextInput, 
  Button, 
  Card, 
  Title, 
  SegmentedButtons, 
  Surface,
  Text,
  Menu,
  useTheme,
  IconButton,
  Chip,
  HelperText,
  Divider
} from 'react-native-paper';
import { RouteProp, useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RootStackParamList } from '../navigation/Navigation';
import { Entry, PaymentMode, Category } from '../models/types';
import asyncStorageService from '../services/asyncStorage';
import { useAuth } from '../contexts/AuthContext';
import { spacing, borderRadius, lightTheme } from '../theme/materialTheme';
import { CurrencyPicker } from '../components/CurrencyPicker';
import CategoryPicker from '../components/CategoryPicker';
import currencyUtils from '../utils/currencyUtils';
import currencyService from '../services/currencyService';
import preferencesService from '../services/preferences';

type AddEntryRouteProp = RouteProp<RootStackParamList, 'AddEntry'>;

interface Props {
  route: AddEntryRouteProp;
}

const AddEntryScreen: React.FC<Props> = ({ route }) => {
  const { bookId } = route.params;
  const navigation = useNavigation();
  const theme = useTheme();
  const { user } = useAuth();

  // Form state
  const [amount, setAmount] = useState('');
  const [entryType, setEntryType] = useState<'income' | 'expense'>('expense');
  const [date, setDate] = useState(new Date());
  const [party, setParty] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.CASH);
  const [remarks, setRemarks] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Currency state
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [userDisplayCurrency, setUserDisplayCurrency] = useState('INR');
  const [convertedAmount, setConvertedAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaymentMenu, setShowPaymentMenu] = useState(false);
  
  // Refs to prevent immediate dismissal after opening
  const paymentMenuOpenTime = useRef<number>(0);

  // Form validation
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (user) {
      // Categories are loaded by CategoryPicker component
      initializeCurrency();
      // Set "Others" as default category
      setSelectedCategory('Others');
    }
  }, [user]);

  const initializeCurrency = async () => {
    try {
      const displayCurr = await currencyUtils.getUserDisplayCurrency();
      setUserDisplayCurrency(displayCurr);
      setSelectedCurrency(displayCurr);
      console.log('AddEntry: Initialized with user display currency:', displayCurr);
    } catch (error) {
      console.error('Error initializing currency:', error);
      setUserDisplayCurrency('INR');
      setSelectedCurrency('INR');
    }
  };

  // Update conversion preview when amount or currency changes
  useEffect(() => {
    updateConversionPreview();
  }, [amount, selectedCurrency]);

  const updateConversionPreview = async () => {
    if (!amount || !selectedCurrency || selectedCurrency === 'INR') {
      setConvertedAmount('');
      setExchangeRate(null);
      return;
    }

    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount)) return;

      const conversion = await currencyUtils.convertToINR(numAmount, selectedCurrency);
      setConvertedAmount(conversion.convertedAmount.toFixed(2));
      setExchangeRate(conversion.exchangeRate);
    } catch (error) {
      console.error('Error updating conversion preview:', error);
      setConvertedAmount('');
      setExchangeRate(null);
    }
  };

  // Categories are now handled by the CategoryPicker component

  // Category creation is now handled in CategoryManagementScreen via CategoryPicker

  const handleCurrencySelect = (currency: any) => {
    setSelectedCurrency(currency.code);
    console.log('AddEntry: Currency changed to:', currency.code);
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!amount || amount.trim() === '') {
      newErrors.amount = 'Please enter an amount';
    } else {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        newErrors.amount = 'Please enter a valid amount greater than 0';
      }
    }

    if (!selectedCategory || selectedCategory.trim() === '') {
      newErrors.category = 'Please select a category';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    // Dismiss keyboard first
    Keyboard.dismiss();
    
    console.log('AddEntry: Form submission started');
    
    if (!validateForm()) {
      console.log('AddEntry: Form validation failed');
      return;
    }

    if (!user) {
      console.log('AddEntry: No user found');
      Alert.alert('Error', 'You must be logged in to add entries');
      return;
    }

    setIsLoading(true);
    try {
      const entryAmount = parseFloat(amount);
      const finalAmount = entryType === 'income' ? entryAmount : -entryAmount;

      console.log('AddEntry: Starting entry creation process', {
        bookId,
        amount: finalAmount,
        currency: selectedCurrency,
        category: selectedCategory,
        userId: user.id
      });

      // Prepare entry with currency conversion
      let entryData;
      try {
        entryData = await currencyUtils.prepareEntryForStorage({
          bookId,
          amount: finalAmount,
          currency: selectedCurrency,
          date,
          party: party.trim() || undefined,
          category: selectedCategory,
          paymentMode,
          remarks: remarks.trim() || undefined,
          userId: user.id
        });
        console.log('AddEntry: Entry data prepared with currency conversion:', entryData);
      } catch (currencyError) {
        console.error('AddEntry: Currency conversion error:', currencyError);
        // Fallback to direct entry creation without currency conversion
        entryData = {
          bookId,
          amount: finalAmount,
          currency: selectedCurrency,
          date,
          party: party.trim() || undefined,
          category: selectedCategory,
          paymentMode,
          remarks: remarks.trim() || undefined,
          userId: user.id
        };
        console.log('AddEntry: Using fallback entry data (no currency conversion):', entryData);
      }

      // Create entry in storage
      try {
        console.log('AddEntry: Attempting to create entry in AsyncStorage...');
        const createdEntry = await asyncStorageService.createEntry(entryData as Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>);
        console.log('AddEntry: Entry created successfully:', createdEntry);
        
        Alert.alert(
          'Success',
          'Entry added successfully!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } catch (storageError) {
        console.error('AddEntry: Storage error:', storageError);
        throw new Error(`Failed to save entry: ${storageError instanceof Error ? storageError.message : 'Unknown storage error'}`);
      }
    } catch (error) {
      console.error('AddEntry: Fatal error creating entry:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to create entry: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const paymentModeOptions = [
    { value: PaymentMode.CASH, label: 'Cash', icon: 'cash' },
    { value: PaymentMode.UPI, label: 'UPI', icon: 'cellphone' },
    { value: PaymentMode.CARD, label: 'Card', icon: 'credit-card' },
    { value: PaymentMode.NET_BANKING, label: 'Net Banking', icon: 'bank' },
    { value: PaymentMode.CHEQUE, label: 'Cheque', icon: 'checkbook' },
    { value: PaymentMode.OTHER, label: 'Other', icon: 'dots-horizontal' }
  ];

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Surface style={[styles.header, { backgroundColor: theme.colors.primary }]} elevation={2}>
          <Title style={[styles.headerTitle, { color: theme.colors.onPrimary }]}>
            Add New Entry
          </Title>
        </Surface>

        <Card style={[styles.formCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Card.Content style={styles.formContent}>
            {/* Entry Type Toggle */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.colors.onSurface }]}>
                Transaction Type
              </Text>
              <SegmentedButtons
                value={entryType}
                onValueChange={(value) => setEntryType(value as 'income' | 'expense')}
                buttons={[
                  { 
                    value: 'income', 
                    label: 'Income',
                    icon: 'trending-up',
                    style: { 
                      backgroundColor: entryType === 'income' ? theme.colors.primary : 'transparent' 
                    }
                  },
                  { 
                    value: 'expense', 
                    label: 'Expense',
                    icon: 'trending-down',
                    style: { 
                      backgroundColor: entryType === 'expense' ? theme.colors.error : 'transparent' 
                    }
                  },
                ]}
                style={styles.segmentedButtons}
              />
            </View>

            <Divider style={styles.divider} />

            {/* Amount Input */}
            <View style={styles.section}>
              <TextInput
                label="Amount *"
                value={amount}
                onChangeText={(text) => {
                  setAmount(text);
                  // Clear error on input change
                  if (errors.amount) {
                    setErrors(prev => ({ ...prev, amount: '' }));
                  }
                }}
                keyboardType="numeric"
                mode="outlined"
                error={!!errors.amount}
                left={<TextInput.Icon icon="cash" />}
                style={styles.input}
                placeholder="0.00"
              />
              <HelperText type="error" visible={!!errors.amount}>
                {errors.amount}
              </HelperText>
            </View>

            {/* Currency Selection */}
            <View style={styles.section}>
              <CurrencyPicker
                selectedCurrency={selectedCurrency}
                onCurrencySelect={handleCurrencySelect}
                label="Currency"
                showFlag={true}
                style={styles.currencyPicker}
              />
              
              {/* Conversion Preview */}
              {selectedCurrency !== 'INR' && convertedAmount && (
                <Surface style={styles.conversionPreview} elevation={1}>
                  <View style={styles.conversionContent}>
                    <Text variant="bodySmall" style={styles.conversionLabel}>
                      Converted to INR:
                    </Text>
                    <Text variant="bodyLarge" style={styles.conversionAmount}>
                      {currencyService.formatCurrency(parseFloat(convertedAmount), 'INR')}
                    </Text>
                    {exchangeRate && (
                      <Text variant="bodySmall" style={styles.exchangeRate}>
                        Rate: 1 {selectedCurrency} = {exchangeRate.toFixed(4)} INR
                      </Text>
                    )}
                  </View>
                </Surface>
              )}
            </View>

            {/* Date Picker */}
            <View style={styles.section}>
              <TextInput
                label="Date"
                value={date.toDateString()}
                onPress={() => setShowDatePicker(true)}
                mode="outlined"
                editable={false}
                right={<TextInput.Icon icon="calendar" onPress={() => setShowDatePicker(true)} />}
                style={styles.input}
              />
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) setDate(selectedDate);
                  }}
                />
              )}
            </View>

            {/* Party Input */}
            <View style={styles.section}>
              <TextInput
                label="Party/Customer (Optional)"
                value={party}
                onChangeText={setParty}
                mode="outlined"
                left={<TextInput.Icon icon="account" />}
                style={styles.input}
              />
            </View>

            {/* Category Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.colors.onSurface }]}>
                Category *
              </Text>
              <Button
                mode="outlined"
                onPress={() => setShowCategoryPicker(true)}
                style={[styles.menuButton, errors.category ? styles.errorBorder : null]}
                contentStyle={styles.menuButtonContent}
                icon="chevron-down"
              >
                {selectedCategory || 'Select Category'}
              </Button>
              <HelperText type="error" visible={!!errors.category}>
                {errors.category}
              </HelperText>
              {!selectedCategory && (
                <View style={{ marginTop: 8 }}>
                  <HelperText type="info" visible={true}>
                    Tap to select a category. Create categories in Settings → Category Management.
                  </HelperText>
                </View>
              )}
            </View>

            {/* Payment Mode Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.colors.onSurface }]}>
                Payment Mode
              </Text>
              <Menu
                visible={showPaymentMenu}
                onDismiss={() => setShowPaymentMenu(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setShowPaymentMenu(true)}
                    style={styles.menuButton}
                    contentStyle={styles.menuButtonContent}
                    icon="chevron-down"
                  >
                    {paymentModeOptions.find(pm => pm.value === paymentMode)?.label}
                  </Button>
                }
              >
                {paymentModeOptions.map((option) => (
                  <Menu.Item
                    key={option.value}
                    onPress={() => {
                      setPaymentMode(option.value);
                      setShowPaymentMenu(false);
                    }}
                    title={option.label}
                    leadingIcon={option.icon}
                  />
                ))}
              </Menu>
            </View>

            {/* Remarks Input */}
            <View style={styles.section}>
              <TextInput
                label="Remarks (Optional)"
                value={remarks}
                onChangeText={setRemarks}
                mode="outlined"
                multiline
                numberOfLines={3}
                left={<TextInput.Icon icon="note-text" />}
                style={styles.input}
              />
            </View>

            {/* Preview Section */}
            {amount && selectedCategory && (
              <Surface style={styles.previewSection} elevation={1}>
                <Text style={[styles.previewTitle, { color: theme.colors.primary }]}>
                  Preview
                </Text>
                <View style={styles.previewRow}>
                  <Chip 
                    icon={entryType === 'income' ? 'trending-up' : 'trending-down'} 
                    mode="outlined"
                    style={[
                      styles.previewChip, 
                      { 
                        backgroundColor: entryType === 'income' 
                          ? theme.colors.primaryContainer 
                          : theme.colors.errorContainer 
                      }
                    ]}
                  >
                    {entryType === 'income' ? '+' : '-'}₹{amount}
                  </Chip>
                  <Text style={{ color: theme.colors.onSurface }}>
                    {selectedCategory} • {date.toLocaleDateString()}
                  </Text>
                </View>
              </Surface>
            )}
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={[styles.button, styles.cancelButton]}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={isLoading}
            disabled={isLoading}
            style={[styles.button, styles.saveButton]}
          >
            Save Entry
          </Button>
        </View>
      </ScrollView>

      {/* Category Picker Modal */}
      <CategoryPicker
        visible={showCategoryPicker}
        selectedCategory={selectedCategory}
        onSelect={(category) => {
          setSelectedCategory(category);
          setShowCategoryPicker(false);
          if (errors.category) {
            setErrors(prev => ({ ...prev, category: '' }));
          }
        }}
        onDismiss={() => setShowCategoryPicker(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  formCard: {
    margin: spacing.md,
    borderRadius: borderRadius.lg,
  },
  formContent: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  input: {
    marginBottom: spacing.xs,
  },
  segmentedButtons: {
    marginTop: spacing.sm,
  },
  divider: {
    marginVertical: spacing.md,
  },
  menuButton: {
    justifyContent: 'flex-start',
    marginTop: spacing.sm,
  },
  menuButtonContent: {
    justifyContent: 'space-between',
    flexDirection: 'row-reverse',
  },
  errorBorder: {
    borderColor: '#B00020', // Material error color
    borderWidth: 2,
  },
  previewSection: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewChip: {
    marginRight: spacing.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
  },
  button: {
    flex: 1,
  },
  cancelButton: {
    marginRight: spacing.sm,
  },
  saveButton: {
    marginLeft: spacing.sm,
  },
  currencyPicker: {
    marginVertical: 0,
  },
  conversionPreview: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
  },
  conversionContent: {
    alignItems: 'center',
  },
  conversionLabel: {
    opacity: 0.7,
  },
  conversionAmount: {
    fontWeight: '600',
    marginVertical: spacing.xs,
  },
  exchangeRate: {
    opacity: 0.6,
    fontSize: 12,
  },
});

export default AddEntryScreen;