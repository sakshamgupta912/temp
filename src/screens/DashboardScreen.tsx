// Dashboard screen - main overview of all books with Material Design
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity
} from 'react-native';
import { 
  Card, 
  Title, 
  Text, 
  FAB, 
  Button, 
  Surface, 
  Divider,
  useTheme 
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';

import { Book, BookSummary } from '../models/types';
import { useAuth } from '../contexts/AuthContext';
import asyncStorageService from '../services/asyncStorage';
import { RootStackParamList } from '../navigation/Navigation';
import { spacing, borderRadius, elevation } from '../theme/materialTheme';
import { useCurrency } from '../hooks/useCurrency';
import currencyService from '../services/currencyService';
import preferencesService from '../services/preferences';
import currencyUtils from '../utils/currencyUtils';
import { SyncStatusBanner } from '../components/SyncStatusBanner';

type DashboardNavigationProp = StackNavigationProp<RootStackParamList>;

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<DashboardNavigationProp>();
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [bookSummaries, setBookSummaries] = useState<BookSummary[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const theme = useTheme();
  const { width } = Dimensions.get('window');
  
  // Currency formatting for dashboard totals (uses user display currency)
  const { formatAmount, formatAmountSync, userDisplayCurrency } = useCurrency();

  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const userBooks = await asyncStorageService.getBooks(user.id);
      setBooks(userBooks);

      // Get user's default currency
      const userDefaultCurrency = await currencyUtils.getUserDefaultCurrency();
      console.log(`📊 Dashboard: Aggregating ${userBooks.length} books in ${userDefaultCurrency} (using normalized amounts)`);

      // PERFORMANCE: Calculate summaries using normalized amounts (instant)
      const summaries: BookSummary[] = [];
      let totalInUserCurrency = 0;

      for (const book of userBooks) {
        const entries = await asyncStorageService.getEntries(book.id);
        console.log(`📖 Book "${book.name}" (${book.currency}): ${entries.length} entries`);
        
        // Get book's current locked rate to check consistency
        const bookLockedRate = book.lockedExchangeRate;
        const isBookRateLocked = bookLockedRate && book.targetCurrency === userDefaultCurrency;
        
        // PERFORMANCE: Use normalizedAmount for instant aggregation
        let totalIncome = 0;
        let totalExpenses = 0;
        
        for (const entry of entries) {
          let amount = entry.amount;
          
          // Check if normalized amount is valid and uses correct rate
          const hasNormalizedAmount = entry.normalizedAmount !== undefined && 
                                      entry.normalizedCurrency === userDefaultCurrency;
          
          // FIX: If book has locked rate, verify normalized amount uses the locked rate
          if (hasNormalizedAmount && isBookRateLocked && entry.conversionRate !== bookLockedRate) {
            console.log(`  ⚠️ Rate mismatch! Entry has rate ${entry.conversionRate}, but book locked rate is ${bookLockedRate}. Recalculating...`);
            // Recalculate with correct locked rate
            amount = entry.amount * bookLockedRate;
            console.log(`  🔄 Recalculated: ${entry.amount} ${entry.currency} × ${bookLockedRate} = ${amount} ${userDefaultCurrency}`);
          } else if (hasNormalizedAmount && entry.normalizedAmount !== undefined) {
            // Use normalized amount (FAST path)
            amount = entry.normalizedAmount;
            console.log(`  ✅ Using normalized: ${entry.amount} ${entry.currency} → ${amount} ${userDefaultCurrency} (rate: ${entry.conversionRate || 'N/A'})`);
          } else if (entry.currency !== userDefaultCurrency) {
            // Fallback: convert on-the-fly for old entries without normalized amount
            console.log(`  ⚠️ No normalized amount, converting: ${entry.amount} ${entry.currency} → ${userDefaultCurrency}`);
            const rate = await currencyService.getExchangeRate(
              entry.currency,
              userDefaultCurrency,
              entry.bookId
            );
            if (rate) {
              amount = entry.amount * rate;
              console.log(`  💱 Converted: ${entry.amount} × ${rate} = ${amount} ${userDefaultCurrency}`);
            }
          } else {
            console.log(`  ℹ️ Same currency, no conversion: ${entry.amount} ${entry.currency}`);
          }
          
          if (amount >= 0) {
            totalIncome += amount;
          } else {
            totalExpenses += Math.abs(amount);
          }
        }
        
        const netBalance = totalIncome - totalExpenses;
        
        console.log(`  Income: ${totalIncome} ${userDefaultCurrency}`);
        console.log(`  Expenses: ${totalExpenses} ${userDefaultCurrency}`);
        console.log(`  Balance: ${netBalance} ${userDefaultCurrency}`);
        
        summaries.push({
          bookId: book.id,
          bookCurrency: book.currency,
          totalIncome,
          totalExpenses,
          netBalance,
          entryCount: entries.length
        });
        
        totalInUserCurrency += netBalance;
      }

      console.log(`✅ Dashboard: Total balance: ${totalInUserCurrency} ${userDefaultCurrency} (instant calculation)`);
      setBookSummaries(summaries);
      setTotalBalance(totalInUserCurrency);
    } catch (error) {
      console.error('❌ Dashboard: Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  }, [loadDashboardData]);

  const navigateToBook = useCallback((book: Book) => {
    navigation.navigate('BookDetail', { 
      bookId: book.id, 
      bookName: book.name 
    });
  }, [navigation]);

  const navigateToAddBook = useCallback(() => {
    navigation.navigate('AddBook');
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  // Format currency for display (amounts are in user's default currency)
  const [formattedAmounts, setFormattedAmounts] = useState<{[key: string]: string}>({});

  useEffect(() => {
    const formatAllAmounts = async () => {
      // Get user's default currency to ensure proper symbol display
      const userDefaultCurrency = await currencyUtils.getUserDefaultCurrency();
      
      const amounts: {[key: string]: string} = {};
      // Explicitly pass currency to ensure correct symbol
      amounts.totalBalance = await formatAmount(Math.abs(totalBalance), userDefaultCurrency);
      
      for (const summary of bookSummaries) {
        amounts[`balance_${summary.bookId}`] = await formatAmount(Math.abs(summary.netBalance), userDefaultCurrency);
        amounts[`income_${summary.bookId}`] = await formatAmount(summary.totalIncome, userDefaultCurrency);
        amounts[`expenses_${summary.bookId}`] = await formatAmount(summary.totalExpenses, userDefaultCurrency);
      }
      
      setFormattedAmounts(amounts);
    };
    
    formatAllAmounts();
  }, [totalBalance, bookSummaries, formatAmount]);

  const getBalanceColor = useCallback((balance: number) => {
    return balance >= 0 ? theme.colors.primary : theme.colors.error;
  }, [theme.colors.primary, theme.colors.error]);

  // Memoize expensive computations
  const sortedBooks = useMemo(() => {
    return books.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [books]);

  const totalBalanceColor = useMemo(() => {
    return getBalanceColor(totalBalance);
  }, [totalBalance, getBalanceColor]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      
      {/* Sync Status Banner */}
      <SyncStatusBanner />
      
      {/* Header Section */}
      <Surface style={[styles.headerSection, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
        <View style={styles.headerContent}>
          <Text variant="headlineMedium" style={[styles.greeting, { color: theme.colors.onPrimaryContainer }]}>
            Welcome back!
          </Text>
          <Text variant="bodyLarge" style={[styles.subGreeting, { color: theme.colors.onPrimaryContainer }]}>
            Here's your financial overview
          </Text>
        </View>
      </Surface>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        
        {/* Balance Overview Cards */}
        <View style={styles.overviewSection}>
          <Surface style={[styles.balanceCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <View style={styles.balanceContent}>
              <View style={styles.balanceHeader}>
                <MaterialIcons name="account-balance-wallet" size={24} color={theme.colors.primary} />
                <Text variant="titleMedium" style={[styles.balanceLabel, { color: theme.colors.onSurface }]}>
                  Total Balance
                </Text>
              </View>
              <Text variant="headlineLarge" style={[styles.balanceAmount, { color: getBalanceColor(totalBalance) }]}>
                {formattedAmounts.totalBalance || '...'}
              </Text>
              <Text variant="bodyMedium" style={[styles.balanceSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Across {books.length} book{books.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </Surface>
        </View>

        {/* Books Section */}
        <View style={styles.booksSection}>
          <View style={styles.sectionHeader}>
            <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
              Your Books
            </Text>
            {books.length > 0 && (
              <Button
                mode="text"
                onPress={navigateToAddBook}
                labelStyle={{ color: theme.colors.primary }}
                contentStyle={styles.addButtonContent}
              >
                Add New
              </Button>
            )}
          </View>

          {books.length === 0 ? (
            <Surface style={[styles.emptyState, { backgroundColor: theme.colors.surface }]} elevation={1}>
              <View style={styles.emptyContent}>
                <Surface style={[styles.emptyIconContainer, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
                  <MaterialIcons name="book" size={48} color={theme.colors.onSurfaceVariant} />
                </Surface>
                <Text variant="headlineSmall" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                  No Books Yet
                </Text>
                <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                  Create your first expense book to start tracking your finances
                </Text>
                <Button 
                  mode="contained" 
                  onPress={navigateToAddBook}
                  style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]}
                  labelStyle={{ color: theme.colors.onPrimary }}
                  contentStyle={styles.emptyButtonContent}
                >
                  Create First Book
                </Button>
              </View>
            </Surface>
          ) : (
            <View style={styles.booksList}>
              {books.map((book) => {
                const summary = bookSummaries.find(s => s.bookId === book.id);
                if (!summary) {
                  console.log(`Dashboard: No summary found for book "${book.name}" (${book.id})`);
                }
                return (
                  <TouchableOpacity
                    key={book.id} 
                    onPress={() => navigateToBook(book)}
                    activeOpacity={0.7}
                  >
                    <Surface style={[styles.bookCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                      <View style={styles.bookContent}>
                        <View style={styles.bookHeader}>
                          <View style={styles.bookIconContainer}>
                            <Surface style={[styles.bookIcon, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
                              <MaterialIcons name="book" size={20} color={theme.colors.onPrimaryContainer} />
                            </Surface>
                          </View>
                          <View style={styles.bookInfo}>
                            <Text variant="titleMedium" style={[styles.bookTitle, { color: theme.colors.onSurface }]}>
                              {book.name}
                            </Text>
                            {book.description && (
                              <Text variant="bodySmall" style={[styles.bookDescription, { color: theme.colors.onSurfaceVariant }]}>
                                {book.description}
                              </Text>
                            )}
                          </View>
                          <View style={styles.bookBalance}>
                            <Text variant="titleLarge" style={[styles.bookAmount, { color: getBalanceColor(summary?.netBalance || 0) }]}>
                              {summary ? (formattedAmounts[`balance_${summary.bookId}`] || '...') : '...'}
                            </Text>
                            <Text variant="bodySmall" style={[styles.bookBalanceLabel, { color: theme.colors.onSurfaceVariant }]}>
                              Net Balance
                            </Text>
                          </View>
                        </View>

                        {summary && (
                          <>
                            <Divider style={[styles.bookDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                            <View style={styles.bookStats}>
                              <View style={styles.statItem}>
                                <MaterialIcons name="trending-up" size={16} color={theme.colors.primary} />
                                <Text variant="bodySmall" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                                  Income
                                </Text>
                                <Text variant="labelLarge" style={[styles.statValue, { color: theme.colors.primary }]} numberOfLines={1} ellipsizeMode="tail">
                                  {formattedAmounts[`income_${summary.bookId}`] || '...'}
                                </Text>
                              </View>
                              <View style={styles.statItem}>
                                <MaterialIcons name="trending-down" size={16} color={theme.colors.error} />
                                <Text variant="bodySmall" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                                  Expenses
                                </Text>
                                <Text variant="labelLarge" style={[styles.statValue, { color: theme.colors.error }]} numberOfLines={1} ellipsizeMode="tail">
                                  {formattedAmounts[`expenses_${summary.bookId}`] || '...'}
                                </Text>
                              </View>
                              <View style={styles.statItem}>
                                <MaterialIcons name="receipt" size={16} color={theme.colors.onSurfaceVariant} />
                                <Text variant="bodySmall" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                                  Entries
                                </Text>
                                <Text variant="labelLarge" style={[styles.statValue, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                                  {summary?.entryCount || 0}
                                </Text>
                              </View>
                            </View>
                          </>
                        )}
                      </View>
                    </Surface>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={navigateToAddBook}
        color={theme.colors.onPrimary}
        size="medium"
      />
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
  greeting: {
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  subGreeting: {
    opacity: 0.8,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl + 60, // Space for FAB
  },
  overviewSection: {
    marginBottom: spacing.lg,
  },
  balanceCard: {
    borderRadius: borderRadius.md,
    padding: spacing.lg,
  },
  balanceContent: {
    alignItems: 'center',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  balanceLabel: {
    marginLeft: spacing.sm,
    fontWeight: '600',
  },
  balanceAmount: {
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  balanceSubtitle: {
    textAlign: 'center',
  },
  booksSection: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  addButtonContent: {
    paddingVertical: spacing.xs,
  },
  emptyState: {
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyContent: {
    alignItems: 'center',
    maxWidth: 280,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    marginBottom: spacing.sm,
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  emptyButton: {
    borderRadius: borderRadius.lg,
  },
  emptyButtonContent: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  booksList: {
    gap: spacing.md,
  },
  bookCard: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  bookContent: {
    padding: spacing.md,
  },
  bookHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bookIconContainer: {
    marginRight: spacing.md,
  },
  bookIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  bookTitle: {
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
  },
  bookDescription: {
    opacity: 0.7,
  },
  bookBalance: {
    alignItems: 'flex-end',
  },
  bookAmount: {
    fontWeight: '700',
    marginBottom: spacing.xs / 2,
  },
  bookBalanceLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  bookDivider: {
    marginVertical: spacing.md,
    height: 1,
  },
  bookStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minWidth: 0, // Allow flex items to shrink below content size
  },
  statLabel: {
    marginLeft: spacing.xs,
    marginRight: 2,
    fontSize: 10,
    flexShrink: 0, // Don't shrink labels
  },
  statValue: {
    fontWeight: '600',
    fontSize: 11,
    flexShrink: 1, // Allow values to shrink if needed
  },
  fab: {
    position: 'absolute',
    margin: spacing.lg,
    right: 0,
    bottom: 0,
    borderRadius: borderRadius.md,
  },
});

export default memo(DashboardScreen);