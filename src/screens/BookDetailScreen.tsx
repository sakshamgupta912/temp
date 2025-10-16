// Book Detail screen - Material Design view showing entries for a specific book
import React, { useState, useEffect, useCallback, useMemo, memo, useRef, useLayoutEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  RefreshControl, 
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView
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
  Button,
  Portal,
  Dialog,
  TextInput,
  List,
  TouchableRipple
} from 'react-native-paper';
import { RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/Navigation';
import { Entry, PaymentMode, Category } from '../models/types';
import asyncStorageService from '../services/asyncStorage';
import { dataCacheService } from '../services/dataCache';
import { spacing, borderRadius } from '../theme/materialTheme';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../contexts/AuthContext';
import currencyUtils from '../utils/currencyUtils';
import currencyService from '../services/currencyService';
import { EntryDebugger } from '../components/EntryDebugger';
import { ExchangeRateEditor } from '../components/ExchangeRateEditor';
import preferencesService from '../services/preferences';
import AsyncStorage from '@react-native-async-storage/async-storage';

type BookDetailRouteProp = RouteProp<RootStackParamList, 'BookDetail'>;
type BookDetailNavigationProp = StackNavigationProp<RootStackParamList, 'BookDetail'>;

interface Props {
  route: BookDetailRouteProp;
}

const BookDetailScreen: React.FC<Props> = ({ route }) => {
  const { bookId, bookName } = route.params;
  const navigation = useNavigation<BookDetailNavigationProp>();
  const theme = useTheme();
  const { user, syncNow } = useAuth();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
  
  // Developer mode state
  const [developerMode, setDeveloperMode] = useState(false);
  
  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [showBookSelectionDialog, setShowBookSelectionDialog] = useState(false);
  const [showCurrencyConversionDialog, setShowCurrencyConversionDialog] = useState(false);
  const [bulkOperation, setBulkOperation] = useState<'move' | 'copy' | null>(null);
  const [targetBook, setTargetBook] = useState<{id: string, name: string, currency: string} | null>(null);
  const [conversionRate, setConversionRate] = useState<number>(1);
  const [books, setBooks] = useState<any[]>([]);
  
  // Ref to prevent immediate dismissal after opening
  const menuOpenTime = useRef<number>(0);

  // Load developer mode setting
  useEffect(() => {
    const loadDeveloperMode = async () => {
      try {
        const value = await AsyncStorage.getItem('developer_mode');
        if (value !== null) {
          setDeveloperMode(value === 'true');
        }
      } catch (error) {
        console.error('Error loading developer mode:', error);
      }
    };
    loadDeveloperMode();
  }, []);

  const loadEntries = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('BookDetail: Loading entries for book:', bookId);
      
      // Load book details to get its currency
      if (!user) {
        console.warn('BookDetail: No user found');
        return;
      }
      
      const allBooks = await asyncStorageService.getBooks(user.id);
      setBooks(allBooks); // Store for bulk operations
      const currentBook = allBooks.find(b => b.id === bookId);
      const currency = currentBook?.currency || 'USD';
      setBookCurrency(currency);
      console.log(`BookDetail: Book "${bookName}" uses currency: ${currency}`);
      
      // Load user's default currency
      const prefs = await preferencesService.getPreferences();
      setUserDefaultCurrency(prefs.currency);
      
      // Load categories for display
      const userCategories = await asyncStorageService.getCategories(user.id);
      setCategories(userCategories);
      console.log('BookDetail: Categories loaded:', userCategories.length);
      
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

  // Add edit button to header
  const handleArchiveBook = useCallback(async () => {
    try {
      const currentBook = books.find(b => b.id === bookId);
      if (!currentBook) return;

      const isArchived = currentBook.archived === true;
      const action = isArchived ? 'unarchive' : 'archive';
      
      Alert.alert(
        isArchived ? 'Unarchive Book?' : 'Archive Book?',
        isArchived 
          ? `"${bookName}" will be visible again and available for AI classification.`
          : `"${bookName}" will be hidden from the main list and AI won't classify entries into it. You can unarchive it later.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: isArchived ? 'Unarchive' : 'Archive',
            style: isArchived ? 'default' : 'destructive',
            onPress: async () => {
              try {
                await asyncStorageService.updateBook(bookId, {
                  archived: !isArchived,
                  archivedAt: isArchived ? undefined : new Date(),
                });
                Alert.alert('Success', `Book ${action}d successfully`);
                navigation.goBack();
              } catch (error) {
                console.error(`Error ${action}ing book:`, error);
                Alert.alert('Error', `Failed to ${action} book`);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error handling archive:', error);
    }
  }, [bookId, bookName, books, navigation]);

  useLayoutEffect(() => {
    const currentBook = books.find(b => b.id === bookId);
    const isArchived = currentBook?.archived === true;

    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row' }}>
          <IconButton
            icon={isArchived ? 'package-up' : 'package-down'}
            size={20}
            onPress={handleArchiveBook}
            iconColor={theme.colors.onSurface}
          />
          <IconButton
            icon="pencil"
            size={20}
            onPress={() => {
              navigation.navigate('EditBook', { bookId });
            }}
            iconColor={theme.colors.onSurface}
          />
        </View>
      ),
    });
  }, [navigation, bookId, books, handleArchiveBook, theme.colors.onSurface]);

  // Load entries when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Sync with Firebase first to get latest data
      console.log('🔄 Pull-to-refresh: Syncing with Firebase...');
      const syncResult = await syncNow(true); // Manual sync
      if (syncResult.success) {
        console.log('✅ Pull-to-refresh: Sync successful');
      } else {
        console.warn('⚠️ Pull-to-refresh: Sync failed -', syncResult.message);
      }
      // Then reload entries (from local storage with fresh synced data)
      await loadEntries();
    } catch (error) {
      console.error('❌ Pull-to-refresh: Error -', error);
      // Still reload local data even if sync fails
      await loadEntries();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadEntries, syncNow]);

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
    // CRITICAL: Check if already loading (prevent double-delete race condition)
    if (isLoading) {
      console.log('⏭️ BookDetail: Already processing, skipping duplicate delete');
      return;
    }
    
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

  // ==================== BULK SELECTION FUNCTIONS ====================

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedEntries(new Set());
  };

  const toggleEntrySelection = (entryId: string) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId);
    } else {
      newSelected.add(entryId);
    }
    setSelectedEntries(newSelected);
  };

  const selectAllEntries = () => {
    const allIds = new Set(entries.map(e => e.id));
    setSelectedEntries(allIds);
  };

  const deselectAllEntries = () => {
    setSelectedEntries(new Set());
  };

  const handleBulkMove = () => {
    if (selectedEntries.size === 0) {
      Alert.alert('No Selection', 'Please select entries to move');
      return;
    }
    setBulkOperation('move');
    setShowBookSelectionDialog(true);
  };

  const handleBulkCopy = () => {
    if (selectedEntries.size === 0) {
      Alert.alert('No Selection', 'Please select entries to copy');
      return;
    }
    setBulkOperation('copy');
    setShowBookSelectionDialog(true);
  };

  const handleBulkDelete = () => {
    if (selectedEntries.size === 0) {
      Alert.alert('No Selection', 'Please select entries to delete');
      return;
    }

    Alert.alert(
      'Delete Entries',
      `Are you sure you want to delete ${selectedEntries.size} ${selectedEntries.size === 1 ? 'entry' : 'entries'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const entryId of selectedEntries) {
                await asyncStorageService.deleteEntry(entryId);
              }
              Alert.alert('Success', `${selectedEntries.size} ${selectedEntries.size === 1 ? 'entry' : 'entries'} deleted`);
              setSelectionMode(false);
              setSelectedEntries(new Set());
              await loadEntries();
            } catch (error) {
              console.error('Error deleting entries:', error);
              Alert.alert('Error', 'Failed to delete entries');
            }
          },
        },
      ]
    );
  };

  const onBookSelected = async (book: any) => {
    setTargetBook(book);

    // Check if currency conversion is needed
    if (book.currency !== bookCurrency) {
      // Get exchange rate
      try {
        const rate = await currencyService.getExchangeRate(bookCurrency, book.currency);
        setConversionRate(rate || 1);
        setShowCurrencyConversionDialog(true);
      } catch (error) {
        console.error('Error getting exchange rate:', error);
        Alert.alert('Error', 'Could not fetch exchange rate. Using 1:1 conversion.');
        setConversionRate(1);
        setShowCurrencyConversionDialog(true);
      }
    } else {
      // Same currency, proceed directly
      await executeBulkOperation(book, 1);
    }
  };

  const executeBulkOperation = async (targetBookData: any, rate: number) => {
    try {
      const entriesToProcess = entries.filter(e => selectedEntries.has(e.id));
      
      if (entriesToProcess.length === 0) {
        Alert.alert('Error', 'No entries to process');
        return;
      }

      console.log(`Processing ${entriesToProcess.length} entries with rate ${rate}`);
      
      for (const entry of entriesToProcess) {
        if (bulkOperation === 'move') {
          // Move: Update bookId and currency, apply conversion rate
          const oldBookId = entry.bookId; // Store old bookId before update
          const updatedEntry = {
            ...entry,
            bookId: targetBookData.id,
            currency: targetBookData.currency,
            amount: entry.amount * rate,
          };
          console.log(`Moving entry ${entry.id} from book ${oldBookId} to book ${targetBookData.name} (${targetBookData.id})`);
          await asyncStorageService.updateEntry(entry.id, updatedEntry);
          
          // CRITICAL: Invalidate cache for both source and target books
          await dataCacheService.invalidatePattern(`entries:bookId:${oldBookId}`);
          await dataCacheService.invalidatePattern(`entries:bookId:${targetBookData.id}`);
        } else if (bulkOperation === 'copy') {
          // Copy: Create new entry with new ID
          const newEntry = {
            ...entry,
            bookId: targetBookData.id,
            currency: targetBookData.currency,
            amount: entry.amount * rate,
            userId: user!.id,
          };
          delete (newEntry as any).id;
          delete (newEntry as any).createdAt;
          delete (newEntry as any).updatedAt;
          console.log(`Copying entry to book ${targetBookData.name} (${targetBookData.id})`);
          await asyncStorageService.createEntry(newEntry);
          
          // Invalidate target book cache
          await dataCacheService.invalidatePattern(`entries:bookId:${targetBookData.id}`);
        }
      }

      const operation = bulkOperation === 'move' ? 'moved' : 'copied';
      Alert.alert('Success', `${selectedEntries.size} ${selectedEntries.size === 1 ? 'entry' : 'entries'} ${operation} to ${targetBookData.name}`);
      
      // Clean up state
      setSelectionMode(false);
      setSelectedEntries(new Set());
      setBulkOperation(null);
      setTargetBook(null);
      setShowBookSelectionDialog(false);
      setShowCurrencyConversionDialog(false);
      
      // Reload entries
      await loadEntries();
    } catch (error) {
      console.error('Error executing bulk operation:', error);
      Alert.alert('Error', 'Failed to complete operation');
    }
  };

  // ==================== END BULK SELECTION FUNCTIONS ====================

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

  // Helper function to get category name from category ID
  const getCategoryName = useCallback((categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || categoryId; // Fallback to ID if not found
  }, [categories]);

  const renderEntry = ({ item: entry }: { item: Entry }) => {
    const isIncome = entry.amount > 0;
    const categoryName = getCategoryName(entry.category);
    const description = entry.party ? 
      `${categoryName} - ${entry.party}` : 
      categoryName;
    const isSelected = selectedEntries.has(entry.id);

    return (
      <Pressable
        onLongPress={() => {
          if (!selectionMode) {
            setSelectionMode(true);
            toggleEntrySelection(entry.id);
          }
        }}
        onPress={() => {
          if (selectionMode) {
            toggleEntrySelection(entry.id);
          }
        }}
      >
        <Card 
          style={[
            styles.entryCard,
            { 
              backgroundColor: isSelected 
                ? theme.colors.primaryContainer 
                : theme.colors.surface 
            }
          ]} 
          elevation={isSelected ? 3 : 1}
        >
          <Card.Content style={styles.entryContent}>
            <View style={styles.entryHeader}>
              {selectionMode && (
                <View style={styles.checkboxContainer}>
                  <IconButton
                    icon={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                    size={24}
                    iconColor={isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    onPress={() => toggleEntrySelection(entry.id)}
                    style={{ margin: 0 }}
                  />
                </View>
              )}
              <View style={[styles.entryMainInfo, { flex: 1 }]}>
                <Text style={[styles.entryAmount, {
                  color: isIncome ? theme.colors.primary : theme.colors.error
                }]}>
                  <EntryAmountText entry={entry} bookCurrency={bookCurrency} />
                </Text>
                <Text style={[styles.entryDescription, { color: theme.colors.onSurface }]}>
                  {description}
              </Text>
            </View>
            
            {!selectionMode && (
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
              <Divider />
              <Menu.Item
                onPress={() => {
                  console.log(`[BookDetailScreen Entry ${entry.id.slice(-4)}] Menu.Item Move pressed`);
                  setMenuVisible(null);
                  setSelectedEntries(new Set([entry.id]));
                  setBulkOperation('move');
                  setShowBookSelectionDialog(true);
                }}
                title="Move to..."
                leadingIcon="folder-move"
              />
              <Menu.Item
                onPress={() => {
                  console.log(`[BookDetailScreen Entry ${entry.id.slice(-4)}] Menu.Item Copy pressed`);
                  setMenuVisible(null);
                  setSelectedEntries(new Set([entry.id]));
                  setBulkOperation('copy');
                  setShowBookSelectionDialog(true);
                }}
                title="Copy to..."
                leadingIcon="content-copy"
              />
              <Divider />
              <Menu.Item
                onPress={() => {
                  console.log(`[BookDetailScreen Entry ${entry.id.slice(-4)}] Menu.Item Delete pressed`);
                  handleDeleteEntry(entry.id, description);
                }}
                title="Delete"
                leadingIcon="delete"
              />
            </Menu>
            )}
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
      </Pressable>
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

      {/* Debug Component - Only visible when developer mode is enabled */}
      {developerMode && <EntryDebugger />}

      {/* Selection Mode Toolbar - Clean Material Design 3 */}
      {selectionMode && (
        <Surface style={styles.selectionToolbar} elevation={3}>
          <View style={styles.toolbarLeft}>
            <IconButton 
              icon="close" 
              onPress={toggleSelectionMode}
              size={24}
            />
            <Text style={[styles.selectionCount, { color: theme.colors.onSurface }]}>
              {selectedEntries.size} selected
            </Text>
          </View>
          <View style={styles.toolbarRight}>
            <IconButton 
              icon="select-all" 
              onPress={selectAllEntries}
              size={24}
              disabled={selectedEntries.size === entries.length}
            />
            <IconButton 
              icon="folder-move" 
              onPress={handleBulkMove}
              size={24}
              disabled={selectedEntries.size === 0}
            />
            <IconButton 
              icon="content-copy" 
              onPress={handleBulkCopy}
              size={24}
              disabled={selectedEntries.size === 0}
            />
            <IconButton 
              icon="delete" 
              onPress={handleBulkDelete}
              size={24}
              disabled={selectedEntries.size === 0}
              iconColor={selectedEntries.size > 0 ? theme.colors.error : undefined}
            />
          </View>
        </Surface>
      )}

      {/* Book Selection Dialog */}
      <Portal>
        <Dialog 
          visible={showBookSelectionDialog} 
          onDismiss={() => setShowBookSelectionDialog(false)}
        >
          <Dialog.Title>Select Target Book</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView>
              {books
                .filter(b => b.id !== bookId && !b.deleted && !b.archived)
                .map((book) => (
                  <TouchableRipple
                    key={book.id}
                    onPress={() => {
                      setShowBookSelectionDialog(false);
                      onBookSelected(book);
                    }}
                  >
                    <List.Item
                      title={book.name}
                      description={`Currency: ${book.currency}`}
                      left={(props) => <List.Icon {...props} icon="book" />}
                    />
                  </TouchableRipple>
                ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowBookSelectionDialog(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Currency Conversion Dialog */}
      <Portal>
        <Dialog 
          visible={showCurrencyConversionDialog} 
          onDismiss={() => setShowCurrencyConversionDialog(false)}
        >
          <Dialog.Title>Currency Conversion</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
              Converting {selectedEntries.size} {selectedEntries.size === 1 ? 'entry' : 'entries'} from {bookCurrency} to {targetBook?.currency}
            </Text>
            <TextInput
              label="Exchange Rate"
              value={conversionRate.toString()}
              onChangeText={(text) => {
                const rate = parseFloat(text);
                if (!isNaN(rate) && rate > 0) {
                  setConversionRate(rate);
                }
              }}
              keyboardType="decimal-pad"
              mode="outlined"
              style={{ marginBottom: 16 }}
            />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Preview: {bookCurrency} 100 = {targetBook?.currency} {(100 * conversionRate).toFixed(2)}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCurrencyConversionDialog(false)}>Cancel</Button>
            <Button 
              onPress={() => {
                setShowCurrencyConversionDialog(false);
                executeBulkOperation(targetBook!, conversionRate);
              }}
            >
              Confirm
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
  selectionToolbar: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: '600',
  },
  checkboxContainer: {
    marginRight: 8,
    justifyContent: 'center',
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