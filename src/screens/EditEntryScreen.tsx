// Edit Entry screen - Material Design form to edit existing entries with delete functionality
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
  Divider,
  FAB
} from 'react-native-paper';
import { RouteProp, useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RootStackParamList } from '../navigation/Navigation';
import { Entry, PaymentMode, Category } from '../models/types';
import asyncStorageService from '../services/asyncStorage';
import { useAuth } from '../contexts/AuthContext';
import { spacing, borderRadius } from '../theme/materialTheme';
import CategoryPicker from '../components/CategoryPicker';
import { CurrencyPicker } from '../components/CurrencyPicker';
import currencyUtils from '../utils/currencyUtils';
import currencyService from '../services/currencyService';
import preferencesService from '../services/preferences';

type EditEntryRouteProp = RouteProp<RootStackParamList, 'EditEntry'>;

interface Props {
  route: EditEntryRouteProp;
}

const EditEntryScreen: React.FC<Props> = ({ route }) => {
  const { entryId } = route.params;
  const navigation = useNavigation();
  const theme = useTheme();
  const { user } = useAuth();

  // Form state
  const [originalEntry, setOriginalEntry] = useState<Entry | null>(null);
  const [amount, setAmount] = useState('');
  const [entryType, setEntryType] = useState<'income' | 'expense'>('expense');
  const [date, setDate] = useState(new Date());
  const [party, setParty] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.CASH);
  const [remarks, setRemarks] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEntry, setIsLoadingEntry] = useState(true);
  
  // NEW: Book and currency state (entries inherit book's currency - READ ONLY)
  const [bookCurrency, setBookCurrency] = useState<string>('USD');
  const [bookName, setBookName] = useState<string>('');

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
      loadData();
    }
  }, [entryId, user]);

  const loadData = async () => {
    try {
      setIsLoadingEntry(true);
      await loadEntry();
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load entry data');
      navigation.goBack();
    } finally {
      setIsLoadingEntry(false);
    }
  };

  const loadEntry = async () => {
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('EditEntry: Loading entry with ID:', entryId, 'for user:', user.id);
      
      // Use the new direct getEntry method
      const entry = await asyncStorageService.getEntry(entryId);
      
      if (entry) {
        console.log('EditEntry: Found entry with userId:', entry.userId, 'current user:', user.id);
        
        // Verify the entry belongs to the current user
        if (entry.userId !== user.id) {
          console.error('EditEntry: Entry does not belong to current user - Entry userId:', entry.userId, 'Current user:', user.id);
          Alert.alert('Access Denied', 'This entry does not belong to your account.');
          navigation.goBack();
          return;
        }
        
        console.log('EditEntry: Successfully loaded entry:', { 
          id: entry.id, 
          amount: entry.amount, 
          category: entry.category,
          bookId: entry.bookId 
        });
        setOriginalEntry(entry);
        populateForm(entry);
        return;
      }
      
      console.error('EditEntry: Entry not found with ID:', entryId);
      Alert.alert('Error', `Entry with ID ${entryId} not found. It may have been deleted.`, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
      return;
    } catch (error) {
      console.error('Error loading entry:', error);
      throw error;
    }
  };

  const populateForm = async (entry: Entry) => {
    setAmount(Math.abs(entry.amount).toString());
    setEntryType(entry.amount >= 0 ? 'income' : 'expense');
    setDate(entry.date);
    setParty(entry.party || '');
    setSelectedCategory(entry.category);
    setPaymentMode(entry.paymentMode);
    setRemarks(entry.remarks || '');
    
    // NEW: Load book details to get currency (read-only)
    try {
      const books = await asyncStorageService.getBooks(user!.id);
      const currentBook = books.find(b => b.id === entry.bookId);
      
      if (currentBook) {
        setBookCurrency(currentBook.currency);
        setBookName(currentBook.name);
        console.log(`EditEntry: Book "${currentBook.name}" uses currency: ${currentBook.currency}`);
      } else {
        console.warn('EditEntry: Book not found, using entry currency:', entry.currency);
        setBookCurrency(entry.currency || 'USD');
      }
    } catch (error) {
      console.error('Error loading book details:', error);
      setBookCurrency(entry.currency || 'USD');
    }
  };

  // Categories are now handled by the CategoryPicker component

  // Category creation is now handled in CategoryManagementScreen via CategoryPicker

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }

    if (!selectedCategory) {
      newErrors.category = 'Please select a category';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async () => {
    // Dismiss keyboard first
    Keyboard.dismiss();
    
    if (!validateForm() || !originalEntry) {
      return;
    }

    setIsLoading(true);
    try {
      const entryAmount = parseFloat(amount);
      const finalAmount = entryType === 'income' ? entryAmount : -entryAmount;

      // PERFORMANCE: Recalculate normalized amount if amount changed
      const userCurrency = await preferencesService.getCurrency();
      const userDefaultCurrency = userCurrency.code;
      
      let normalizedAmount = finalAmount;
      let conversionRate = 1.0;
      
      if (originalEntry.currency !== userDefaultCurrency) {
        // Get exchange rate (uses book locked rate if available)
        const rate = await currencyService.getExchangeRate(
          originalEntry.currency, 
          userDefaultCurrency, 
          originalEntry.bookId
        );
        if (rate !== null) {
          conversionRate = rate;
          normalizedAmount = finalAmount * rate;
          console.log(`💱 Recalculated normalized amount: ${finalAmount} ${originalEntry.currency} × ${rate} = ${normalizedAmount} ${userDefaultCurrency}`);
        } else {
          console.warn(`⚠️ Could not get rate for ${originalEntry.currency} → ${userDefaultCurrency}, using original amount`);
          normalizedAmount = finalAmount;
        }
      }

      const updates: Partial<Entry> = {
        amount: finalAmount,
        date,
        party: party.trim() || undefined,
        category: selectedCategory,
        paymentMode,
        remarks: remarks.trim() || undefined,
        normalizedAmount, // Update normalized amount
        normalizedCurrency: userDefaultCurrency, // Keep user default currency
        conversionRate, // Update conversion rate
      };

      await asyncStorageService.updateEntry(originalEntry.id, updates);
      
      Alert.alert(
        'Success',
        'Entry updated successfully!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error updating entry:', error);
      Alert.alert('Error', 'Failed to update entry. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!originalEntry) return;

    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this entry? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await asyncStorageService.deleteEntry(originalEntry.id);
              Alert.alert(
                'Success',
                'Entry deleted successfully!',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (error) {
              console.error('Error deleting entry:', error);
              Alert.alert('Error', 'Failed to delete entry. Please try again.');
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const paymentModeOptions = [
    { value: PaymentMode.CASH, label: 'Cash', icon: 'cash' },
    { value: PaymentMode.UPI, label: 'UPI', icon: 'cellphone' },
    { value: PaymentMode.CARD, label: 'Card', icon: 'credit-card' },
    { value: PaymentMode.NET_BANKING, label: 'Net Banking', icon: 'bank' },
    { value: PaymentMode.CHEQUE, label: 'Cheque', icon: 'checkbook' },
    { value: PaymentMode.OTHER, label: 'Other', icon: 'dots-horizontal' }
  ];

  if (isLoadingEntry) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <Surface style={[styles.loadingCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>
            Loading entry...
          </Text>
        </Surface>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Surface style={[styles.header, { backgroundColor: theme.colors.primary }]} elevation={2}>
          <Title style={[styles.headerTitle, { color: theme.colors.onPrimary }]}>
            Edit Entry
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

            {/* Book Currency Info - Read-only display */}
            <View style={styles.section}>
              <Surface style={styles.currencyInfoCard} elevation={1}>
                <View style={styles.currencyInfoContent}>
                  <Text variant="bodySmall" style={styles.currencyInfoLabel}>
                    Book Currency (Read-only)
                  </Text>
                  <Text variant="titleMedium" style={styles.currencyInfoValue}>
                    {bookCurrency}
                  </Text>
                  <Text variant="bodySmall" style={styles.currencyInfoHelper}>
                    Entry currency cannot be changed - it matches the book's currency
                  </Text>
                </View>
              </Surface>
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
            onPress={handleUpdate}
            loading={isLoading}
            disabled={isLoading}
            style={[styles.button, styles.saveButton]}
          >
            Update Entry
          </Button>
        </View>
      </ScrollView>

      {/* Delete FAB */}
      <FAB
        icon="delete"
        color="white"
        style={[styles.deleteFab, { backgroundColor: theme.colors.error }]}
        onPress={handleDelete}
        disabled={isLoading}
        customSize={56}
      />

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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
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
    paddingBottom: 80, // Space for FAB
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
  deleteFab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  currencyPicker: {
    marginBottom: spacing.sm,
  },
  conversionPreview: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(33, 150, 243, 0.08)',
  },
  conversionContent: {
    gap: spacing.xs,
  },
  conversionLabel: {
    opacity: 0.7,
  },
  conversionAmount: {
    fontWeight: 'bold',
    color: '#2196F3',
  },
  exchangeRate: {
    opacity: 0.6,
    marginTop: spacing.xs,
  },
  // NEW: Book currency info card styles
  currencyInfoCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(103, 58, 183, 0.08)', // Purple tint
    borderWidth: 1,
    borderColor: 'rgba(103, 58, 183, 0.2)',
  },
  currencyInfoContent: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  currencyInfoLabel: {
    opacity: 0.7,
    textAlign: 'center',
  },
  currencyInfoValue: {
    fontWeight: 'bold',
    color: '#673AB7', // Material purple
    fontSize: 20,
  },
  currencyInfoHelper: {
    opacity: 0.6,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
});

export default EditEntryScreen;