// Book Detail screen - Material Design view showing entries for a specific book
import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  RefreshControl, 
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Pressable 
} from 'react-native';
import { 
  Card, 
  Title, 
  Text, 
  FAB, 
  Surface,
  useTheme,
  Chip,
  IconButton,
  Menu,
  Divider,
  Button
} from 'react-native-paper';
import { RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/Navigation';
import { Entry, PaymentMode } from '../models/types';
import asyncStorageService from '../services/asyncStorage';
import { spacing, borderRadius } from '../theme/materialTheme';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../contexts/AuthContext';
import currencyUtils from '../utils/currencyUtils';
import { EntryDebugger } from '../components/EntryDebugger';
import { ExchangeRateEditor } from '../components/ExchangeRateEditor';
import preferencesService from '../services/preferences';

type BookDetailRouteProp = RouteProp<RootStackParamList, 'BookDetail'>;
type BookDetailNavigationProp = StackNavigationProp<RootStackParamList, 'BookDetail'>;

interface Props {
  route: BookDetailRouteProp;
}

const BookDetailScreen: React.FC<Props> = ({ route }) => {
  const { bookId, bookName } = route.params;
  const navigation = useNavigation<BookDetailNavigationProp>();
  const theme = useTheme();
  const { user } = useAuth();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [bookCurrency, setBookCurrency] = useState<string>('USD'); // Track book's currency
  const [userDefaultCurrency, setUserDefaultCurrency] = useState<string>('USD'); // User's default currency
  const [showRateEditor, setShowRateEditor] = useState(false);
  const [formattedTotals, setFormattedTotals] = useState<{
    income: string;
    expenses: string;
    balance: string;
  }>({ income: '...', expenses: '...', balance: '...' });
  
  // Ref to prevent immediate dismissal after opening
  const menuOpenTime = useRef<number>(0);

  const loadEntries = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('BookDetail: Loading entries for book:', bookId);
      
      // Load book details to get its currency
      if (!user) {
        console.warn('BookDetail: No user found');
        return;
      }
      
      const books = await asyncStorageService.getBooks(user.id);
      const currentBook = books.find(b => b.id === bookId);
      const currency = currentBook?.currency || 'USD';
      setBookCurrency(currency);
      console.log(`BookDetail: Book "${bookName}" uses currency: ${currency}`);
      
      // Load user's default currency
      const prefs = await preferencesService.getPreferences();
      setUserDefaultCurrency(prefs.currency);
      
      const bookEntries = await asyncStorageService.getEntries(bookId);
      console.log('BookDetail: Entries loaded:', bookEntries.length);
      setEntries(bookEntries);
      
      // Calculate totals
      const income = bookEntries
        .filter(entry => entry.amount > 0)
        .reduce((sum, entry) => sum + entry.amount, 0);
      
      const expenses = Math.abs(
        bookEntries
          .filter(entry => entry.amount < 0)
          .reduce((sum, entry) => sum + entry.amount, 0)
      );

      console.log('BookDetail: Totals calculated - Income:', income, 'Expenses:', expenses);
      setTotalIncome(income);
      setTotalExpenses(expenses);
      
      // Format totals for display in book's currency
      const formattedIncome = await formatAmount(income, currency);
      const formattedExpenses = await formatAmount(expenses, currency);
      const balance = income - expenses;
      const formattedBalance = await formatAmount(Math.abs(balance), currency);
      
      setFormattedTotals({
        income: formattedIncome,
        expenses: formattedExpenses,
        balance: (balance >= 0 ? '+' : '-') + formattedBalance
      });
    } catch (error) {
      console.error('Error loading entries:', error);
      Alert.alert('Error', 'Failed to load entries');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [bookId]);

  // Load entries when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadEntries();
  }, [loadEntries]);

  const handleEditEntry = useCallback((entryId: string) => {
    console.log('BookDetail: Navigating to edit entry with ID:', entryId);
    console.log('BookDetail: Force closing menu before navigation');
    setMenuVisible(null);
    // Give a tiny delay to ensure state updates
    setTimeout(() => {
      navigation.navigate('EditEntry', { entryId });
    }, 50);
  }, [navigation]);

  const navigateToAddEntry = useCallback(() => {
    navigation.navigate('AddEntry', { bookId });
  }, [navigation, bookId]);

  const handleDeleteEntry = async (entryId: string, entryDescription: string) => {
    setMenuVisible(null);
    
    Alert.alert(
      'Delete Entry',
      `Are you sure you want to delete "${entryDescription}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('BookDetail: Deleting entry:', entryId);
              
              // Validate entry ID
              if (!entryId || typeof entryId !== 'string') {
                throw new Error('Invalid entry ID');
              }
              
              // Show loading state if needed (could add a loading state here)
              await asyncStorageService.deleteEntry(entryId);
              console.log('BookDetail: Entry deleted, refreshing list');
              
              // Force refresh the list
              await loadEntries();
              
              // Verify deletion was successful
              const updatedEntries = await asyncStorageService.getEntries(bookId);
              const deletedEntry = updatedEntries.find(entry => entry.id === entryId);
              
              if (deletedEntry) {
                console.warn('BookDetail: Entry still exists after deletion attempt');
                throw new Error('Entry deletion may not have completed properly');
              }
              
              Alert.alert('Success', 'Entry deleted successfully');
            } catch (error) {
              console.error('BookDetail: Error deleting entry:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
              Alert.alert(
                'Delete Failed', 
                `Failed to delete entry: ${errorMessage}`,
                [
                  { text: 'OK' },
                  { 
                    text: 'Retry', 
                    onPress: () => handleDeleteEntry(entryId, entryDescription)
                  }
                ]
              );
            }
          }
        }
      ]
    );
  };

  const getPaymentModeLabel = (mode: PaymentMode) => {
    const modes = {
      [PaymentMode.CASH]: 'Cash',
      [PaymentMode.UPI]: 'UPI',
      [PaymentMode.CARD]: 'Card',
      [PaymentMode.NET_BANKING]: 'Net Banking',
      [PaymentMode.CHEQUE]: 'Cheque',
      [PaymentMode.OTHER]: 'Other'
    };
    return modes[mode];
  };

  const getPaymentModeIcon = (mode: PaymentMode) => {
    const icons = {
      [PaymentMode.CASH]: 'cash',
      [PaymentMode.UPI]: 'cellphone',
      [PaymentMode.CARD]: 'credit-card',
      [PaymentMode.NET_BANKING]: 'bank',
      [PaymentMode.CHEQUE]: 'checkbook',
      [PaymentMode.OTHER]: 'dots-horizontal'
    };
    return icons[mode];
  };

  // Use currency utilities (all amounts are in INR)
  const { formatAmount } = useCurrency();

  // Format entry in the book's currency
  const formatEntryAmount = useCallback(async (entry: Entry) => {
    // Use book's currency for display (all entries in a book should use same currency)
    return await currencyUtils.formatEntryAmount(entry, bookCurrency);
  }, [bookCurrency]);

  // Memoized calculations for summary data
  const summaryData = useMemo(() => {
    const totalIncome = entries.filter(entry => entry.amount > 0)
      .reduce((sum, entry) => sum + entry.amount, 0);
    const totalExpenses = entries.filter(entry => entry.amount < 0)
      .reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
    const netBalance = totalIncome - totalExpenses;
    
    return {
      totalIncome,
      totalExpenses,
      netBalance,
      entryCount: entries.length
    };
  }, [entries]);



  const renderEntry = ({ item: entry }: { item: Entry }) => {
    const isIncome = entry.amount > 0;
    const description = entry.party ? 
      `${entry.category} - ${entry.party}` : 
      entry.category;

    return (
      <Card 
        style={[
          styles.entryCard,
          { backgroundColor: theme.colors.surface }
        ]} 
        elevation={1}
      >
        <Card.Content style={styles.entryContent}>
          <View style={styles.entryHeader}>
            <View style={styles.entryMainInfo}>
              <Text style={[styles.entryAmount, {
                color: isIncome ? theme.colors.primary : theme.colors.error
              }]}>
                <EntryAmountText entry={entry} bookCurrency={bookCurrency} />
              </Text>
              <Text style={[styles.entryDescription, { color: theme.colors.onSurface }]}>
                {description}
              </Text>
            </View>
            
            <Menu
              visible={menuVisible === entry.id}
              onDismiss={() => {
                const timeSinceOpen = Date.now() - menuOpenTime.current;
                console.log(`[BookDetailScreen Entry ${entry.id.slice(-4)}] ⚠️ Menu onDismiss triggered, time since open: ${timeSinceOpen}ms`);
                
                // Ignore dismissals within 300ms of opening to prevent immediate auto-close
                if (timeSinceOpen < 300) {
                  console.log(`[BookDetailScreen Entry ${entry.id.slice(-4)}] ⛔ Ignoring dismiss - too soon after opening`);
                  return;
                }
                
                console.log(`[BookDetailScreen Entry ${entry.id.slice(-4)}] ✅ Allowing dismiss`);
                setMenuVisible(null);
              }}
              anchor={
                <TouchableOpacity
                  onPress={() => {
                    console.log(`[BookDetailScreen Entry ${entry.id.slice(-4)}] 👆 TouchableOpacity onPress triggered`);
                    console.log(`[BookDetailScreen Entry ${entry.id.slice(-4)}] Previous menuVisible:`, menuVisible);
                    
                    // Only open if not already this entry's menu
                    if (menuVisible !== entry.id) {
                      console.log(`[BookDetailScreen Entry ${entry.id.slice(-4)}] Opening menu`);
                      menuOpenTime.current = Date.now();
                      setMenuVisible(entry.id);
                    } else {
                      console.log(`[BookDetailScreen Entry ${entry.id.slice(-4)}] Menu already open, closing`);
                      setMenuVisible(null);
                    }
                  }}
                  activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <IconButton
                    icon="dots-vertical"
                    size={20}
                  />
                </TouchableOpacity>
              }
            >
              <Menu.Item
                onPress={() => {
                  console.log(`[BookDetailScreen Entry ${entry.id.slice(-4)}] Menu.Item Edit pressed`);
                  handleEditEntry(entry.id);
                }}
                title="Edit"
                leadingIcon="pencil"
              />
              <Menu.Item
                onPress={() => {
                  console.log(`[BookDetailScreen Entry ${entry.id.slice(-4)}] Menu.Item Delete pressed`);
                  handleDeleteEntry(entry.id, description);
                }}
                title="Delete"
                leadingIcon="delete"
              />
            </Menu>
          </View>

          <View style={styles.entryDetails}>
            <View style={styles.entryMeta}>
              <Chip 
                icon={getPaymentModeIcon(entry.paymentMode)}
                mode="outlined"
                compact
                style={styles.paymentChip}
              >
                {getPaymentModeLabel(entry.paymentMode)}
              </Chip>
              <Text style={[styles.entryDate, { color: theme.colors.onSurfaceVariant }]}>
                {entry.date.toLocaleDateString('en-IN')}
              </Text>
            </View>
            
            {entry.remarks && (
              <Text style={[styles.entryRemarks, { color: theme.colors.onSurfaceVariant }]}>
                {entry.remarks}
              </Text>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <Surface style={styles.emptyState} elevation={1}>
      <MaterialIcons 
        name="receipt-long" 
        size={64} 
        color={theme.colors.onSurfaceVariant} 
      />
      <Text style={[styles.emptyStateTitle, { color: theme.colors.onSurface }]}>
        No entries yet
      </Text>
      <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
        Start by adding your first income or expense entry
      </Text>
      <Button
        mode="contained"
        onPress={() => navigation.navigate('AddEntry', { bookId })}
        style={styles.emptyStateButton}
        icon="plus"
      >
        Add Entry
      </Button>
    </Surface>
  );

  const netBalance = totalIncome - totalExpenses;

  // Show loading state for initial load
  if (isLoading && entries.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <Surface style={[styles.loadingCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <ActivityIndicator size="large" animating={true} color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>
            Loading entries...
          </Text>
        </Surface>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <Card style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Card.Content style={styles.summaryContent}>
            {/* Currency Header - Only show exchange rate button if currencies differ */}
            {bookCurrency !== userDefaultCurrency ? (
              <Pressable 
                onPress={() => setShowRateEditor(true)}
                style={styles.currencyHeader}
              >
                <View style={styles.currencyInfo}>
                  <MaterialIcons name="account-balance-wallet" size={18} color={theme.colors.primary} />
                  <Text variant="labelLarge" style={[styles.currencyLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Book Currency
                  </Text>
                </View>
                <Chip
                  icon="swap-horiz"
                  mode="flat"
                  style={{ backgroundColor: theme.colors.secondaryContainer }}
                  textStyle={{ color: theme.colors.onSecondaryContainer, fontWeight: '600' }}
                  onPress={() => setShowRateEditor(true)}
                >
                  {bookCurrency}
                </Chip>
              </Pressable>
            ) : (
              <View style={styles.currencyHeader}>
                <View style={styles.currencyInfo}>
                  <MaterialIcons name="account-balance-wallet" size={18} color={theme.colors.primary} />
                  <Text variant="labelLarge" style={[styles.currencyLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Book Currency
                  </Text>
                </View>
                <Chip
                  mode="flat"
                  style={{ backgroundColor: theme.colors.surfaceVariant }}
                  textStyle={{ color: theme.colors.onSurfaceVariant, fontWeight: '600' }}
                >
                  {bookCurrency}
                </Chip>
              </View>
            )}
            
            <Divider style={{ marginVertical: spacing.sm }} />
            
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.colors.onSurface }]}>
                  Income
                </Text>
                <Text style={[styles.summaryAmount, { color: theme.colors.primary }]}>
                  +{formattedTotals.income}
                </Text>
              </View>
              
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.colors.onSurface }]}>
                  Expenses
                </Text>
                <Text style={[styles.summaryAmount, { color: theme.colors.error }]}>
                  -{formattedTotals.expenses}
                </Text>
              </View>
              
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.colors.onSurface }]}>
                  Balance
                </Text>
                <Text style={[
                  styles.summaryAmount, 
                  { color: netBalance >= 0 ? theme.colors.primary : theme.colors.error }
                ]}>
                  {formattedTotals.balance}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </View>

      {/* Exchange Rate Editor Dialog */}
      <ExchangeRateEditor
        visible={showRateEditor}
        onDismiss={() => setShowRateEditor(false)}
        baseCurrency={bookCurrency}
        userDefaultCurrency={userDefaultCurrency}
        bookId={bookId}
        onRateUpdated={() => loadEntries()}
      />

      {/* Entries List */}
      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContainer,
          entries.length === 0 && styles.listContainerEmpty
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />

      {/* Debug Component - Temporary */}
      <EntryDebugger />

      {/* Add Entry FAB */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('AddEntry', { bookId })}
        label="Add Entry"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryContainer: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  summaryCard: {
    borderRadius: borderRadius.md,
  },
  summaryContent: {
    padding: spacing.lg,
  },
  currencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  currencyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  currencyLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100, // Space for FAB
  },
  listContainerEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  entryCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
  },
  entryContent: {
    padding: spacing.md,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  entryMainInfo: {
    flex: 1,
  },
  entryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: spacing.xs / 2,
  },
  entryDescription: {
    fontSize: 16,
    fontWeight: '500',
  },
  entryDetails: {
    gap: spacing.sm,
  },
  entryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentChip: {
    alignSelf: 'flex-start',
  },
  entryDate: {
    fontSize: 14,
  },
  entryRemarks: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  emptyStateButton: {
    marginTop: spacing.md,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    minWidth: 200,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    textAlign: 'center',
  },
});

// Component to handle async entry amount formatting
const EntryAmountText: React.FC<{ entry: Entry; bookCurrency: string }> = ({ entry, bookCurrency }) => {
  const [formattedAmount, setFormattedAmount] = useState('...');
  
  useEffect(() => {
    const formatAmount = async () => {
      try {
        // Format entry in book's currency (overrides entry.currency if different)
        const formatted = await currencyUtils.formatEntryAmount(entry, bookCurrency);
        setFormattedAmount(formatted);
      } catch (error) {
        console.error('Error formatting entry amount:', error);
        setFormattedAmount('Error');
      }
    };
    
    formatAmount();
  }, [entry, bookCurrency]);
  
  return <Text>{formattedAmount}</Text>;
};

export default memo(BookDetailScreen);