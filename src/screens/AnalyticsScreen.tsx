// Analytics screen - comprehensive financial insights with Material Design charts
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  Dimensions 
} from 'react-native';
import { 
  Card, 
  Title, 
  Text, 
  Surface,
  useTheme,
  SegmentedButtons,
  Chip,
  IconButton
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

import { Entry, Book, Category } from '../models/types';
import asyncStorageService from '../services/asyncStorage';
import { useAuth } from '../contexts/AuthContext';
import { spacing, borderRadius } from '../theme/materialTheme';
import currencyUtils from '../utils/currencyUtils';
import currencyService from '../services/currencyService';
import { 
  TrendChart, 
  CategoryChart, 
  BarChart 
} from '../components/Charts';
import {
  processMonthlyTrends,
  processWeeklyTrends,
  processCategoryData,
  getFinancialInsights,
  formatCurrency,
  formatPercentage,
  FinancialInsights
} from '../utils/chartUtils';
import { SyncStatusBanner } from '../components/SyncStatusBanner';

const { width: screenWidth } = Dimensions.get('window');

const AnalyticsScreen: React.FC = () => {
  const theme = useTheme();
  const { user, syncNow } = useAuth();

  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [selectedBook, setSelectedBook] = useState<string>('all');
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly'>('monthly');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [insights, setInsights] = useState<FinancialInsights | null>(null);
  const [userCurrency, setUserCurrency] = useState<string>('USD');

  const loadAnalyticsData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (!user) {
        console.log('Analytics: No user found, cannot load data');
        setIsLoading(false);
        return;
      }
      
      console.log('Analytics: Loading data for user:', user.id);
      
      // Load all books and categories for the user
      const allBooks = await asyncStorageService.getBooks(user.id);
      console.log('Analytics: Books loaded:', allBooks.length);
      setBooks(allBooks);
      
      const allCategories = await asyncStorageService.getCategories(user.id);
      console.log('Analytics: Categories loaded:', allCategories.length);
      setCategories(allCategories);
      
      // Get user's default currency
      const userDefaultCurrency = await currencyUtils.getUserDefaultCurrency();
      setUserCurrency(userDefaultCurrency);
      console.log(`📊 Analytics: Using normalized amounts in ${userDefaultCurrency}`);
      
      // PERFORMANCE: Load all entries and use pre-converted normalizedAmount
      const allEntriesData: Entry[] = [];
      for (const book of allBooks) {
        const bookEntries = await asyncStorageService.getEntries(book.id);
        
        // Get book's locked rate for consistency check
        const bookLockedRate = book.lockedExchangeRate;
        const isBookRateLocked = bookLockedRate && book.targetCurrency === userDefaultCurrency;
        
        // Use normalizedAmount for instant analytics (no conversion loop!)
        for (const entry of bookEntries) {
          let convertedAmount = entry.amount;
          
          // Check if normalized amount exists and uses correct rate
          const hasNormalizedAmount = entry.normalizedAmount !== undefined && 
                                      entry.normalizedCurrency === userDefaultCurrency;
          
          // FIX: If book has locked rate, verify normalized amount uses the locked rate
          if (hasNormalizedAmount && isBookRateLocked && entry.conversionRate !== bookLockedRate) {
            // Recalculate with correct locked rate
            convertedAmount = entry.amount * bookLockedRate;
            console.log(`  🔄 Analytics recalc: ${entry.amount} ${entry.currency} × ${bookLockedRate} = ${convertedAmount} ${userDefaultCurrency}`);
          } else if (hasNormalizedAmount && entry.normalizedAmount !== undefined) {
            // Use normalized amount (FAST path)
            convertedAmount = entry.normalizedAmount;
          } else if (entry.currency !== userDefaultCurrency) {
            // Fallback for old entries without normalized amount
            const rate = await currencyService.getExchangeRate(
              entry.currency,
              userDefaultCurrency,
              entry.bookId
            );
            
            if (rate) {
              convertedAmount = entry.amount * rate;
            }
          }
          
          allEntriesData.push({
            ...entry,
            amount: convertedAmount,
            currency: userDefaultCurrency
          });
        }
      }
      
      console.log(`✅ Analytics: Loaded ${allEntriesData.length} entries (instant with normalized amounts)`);
      setAllEntries(allEntriesData);
      
      // Calculate insights
      const filteredEntries = getFilteredEntries(allEntriesData, selectedBook);
      const financialInsights = getFinancialInsights(filteredEntries, allCategories);
      setInsights(financialInsights);
      
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadAnalyticsData();
      }
    }, [user, loadAnalyticsData])
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
      // Then reload analytics data (from local storage with fresh synced data)
      await loadAnalyticsData();
    } catch (error) {
      console.error('❌ Pull-to-refresh: Error -', error);
      // Still reload local data even if sync fails
      await loadAnalyticsData();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAnalyticsData, syncNow]);

  const getFilteredEntries = useCallback((entries: Entry[], bookId: string): Entry[] => {
    if (bookId === 'all') {
      return entries;
    }
    return entries.filter(entry => entry.bookId === bookId);
  }, []);

  // Memoize filtered entries for performance
  const filteredEntries = useMemo(() => {
    return getFilteredEntries(allEntries, selectedBook);
  }, [allEntries, selectedBook, getFilteredEntries]);

  // Memoize expensive chart data processing
  const trendData = useMemo(() => {
    return timeframe === 'monthly' 
      ? processMonthlyTrends(filteredEntries, 6)
      : processWeeklyTrends(filteredEntries, 8);
  }, [filteredEntries, timeframe]);

  const categoryData = useMemo(() => {
    return processCategoryData(filteredEntries, categories);
  }, [filteredEntries, categories]);

  // Update insights when filters change
  useEffect(() => {
    const financialInsights = getFinancialInsights(filteredEntries, categories);
    setInsights(financialInsights);
  }, [filteredEntries, categories]);

  const renderInsightsCard = useCallback(() => {
    if (!insights) return null;

    // Show empty state if no entries (check insights totals)
    if (insights.totalIncome === 0 && insights.totalExpenses === 0) {
      return (
        <Card style={[styles.insightsCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Card.Content>
            <View style={styles.emptyStateContainer}>
              <MaterialIcons name="info-outline" size={64} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.emptyStateTitle, { color: theme.colors.onSurface }]}>
                No Transactions Yet
              </Text>
              <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                Add some entries to see your financial analytics
              </Text>
            </View>
          </Card.Content>
        </Card>
      );
    }

    return (
      <Card style={[styles.insightsCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <Card.Content>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Financial Overview
            </Title>
            <Chip mode="outlined" compact icon="info">
              All in {userCurrency}
            </Chip>
          </View>
          
          <View style={styles.insightsGrid}>
            <View style={styles.insightItem}>
              <Surface style={[styles.insightIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                <MaterialIcons name="trending-up" size={24} color={theme.colors.onPrimaryContainer} />
              </Surface>
              <Text style={[styles.insightLabel, { color: theme.colors.onSurfaceVariant }]}>
                Total Income
              </Text>
              <Text style={[styles.insightValue, { color: theme.colors.primary }]}>
                {formatCurrency(insights.totalIncome, userCurrency)}
              </Text>
            </View>

            <View style={styles.insightItem}>
              <Surface style={[styles.insightIcon, { backgroundColor: theme.colors.errorContainer }]}>
                <MaterialIcons name="trending-down" size={24} color={theme.colors.onErrorContainer} />
              </Surface>
              <Text style={[styles.insightLabel, { color: theme.colors.onSurfaceVariant }]}>
                Total Expenses
              </Text>
              <Text style={[styles.insightValue, { color: theme.colors.error }]}>
                {formatCurrency(insights.totalExpenses, userCurrency)}
              </Text>
            </View>

            <View style={styles.insightItem}>
              <Surface style={[
                styles.insightIcon, 
                { backgroundColor: insights.netSavings >= 0 ? theme.colors.primaryContainer : theme.colors.errorContainer }
              ]}>
                <MaterialIcons 
                  name="account-balance-wallet" 
                  size={24} 
                  color={insights.netSavings >= 0 ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer} 
                />
              </Surface>
              <Text style={[styles.insightLabel, { color: theme.colors.onSurfaceVariant }]}>
                Net Savings
              </Text>
              <Text style={[
                styles.insightValue, 
                { color: insights.netSavings >= 0 ? theme.colors.primary : theme.colors.error }
              ]}>
                {formatCurrency(insights.netSavings, userCurrency)}
              </Text>
            </View>

            <View style={styles.insightItem}>
              <Surface style={[styles.insightIcon, { backgroundColor: theme.colors.tertiaryContainer }]}>
                <MaterialIcons name="insights" size={24} color={theme.colors.onTertiaryContainer} />
              </Surface>
              <Text style={[styles.insightLabel, { color: theme.colors.onSurfaceVariant }]}>
                Savings Rate
              </Text>
              <Text style={[styles.insightValue, { color: theme.colors.tertiary }]}>
                {formatPercentage(insights.savingsRate)}
              </Text>
            </View>
          </View>

          {/* Additional insights */}
          <View style={styles.additionalInsights}>
            <View style={styles.additionalInsightRow}>
              <Text style={[styles.additionalInsightLabel, { color: theme.colors.onSurfaceVariant }]}>
                Daily Average Spending:
              </Text>
              <Text style={[styles.additionalInsightValue, { color: theme.colors.onSurface }]}>
                {formatCurrency(insights.avgDailyExpense, userCurrency)}
              </Text>
            </View>
            
            {insights.topExpenseCategory && (
              <>
                <View style={styles.additionalInsightRow}>
                  <Text style={[styles.additionalInsightLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Top Expense Category:
                  </Text>
                  <Chip mode="outlined" compact style={{ flexShrink: 1 }}>
                    {insights.topExpenseCategory}
                  </Chip>
                </View>
                <View style={styles.additionalInsightRow}>
                  <Text style={[styles.additionalInsightLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Amount in Category:
                  </Text>
                  <Text style={[styles.additionalInsightValue, { color: theme.colors.onSurface }]}>
                    {formatCurrency(insights.topExpenseCategoryAmount, userCurrency)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  }, [insights, theme]);

  const renderBookFilter = useCallback(() => {
    if (books.length <= 1) return null;

    return (
      <Card style={[styles.filterCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Card.Content>
          <Text style={[styles.filterTitle, { color: theme.colors.onSurface }]}>
            Filter by Book
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bookFilters}>
            <Chip
              selected={selectedBook === 'all'}
              onPress={() => setSelectedBook('all')}
              style={styles.bookFilterChip}
            >
              All Books
            </Chip>
            {books.map(book => (
              <Chip
                key={book.id}
                selected={selectedBook === book.id}
                onPress={() => setSelectedBook(book.id)}
                style={styles.bookFilterChip}
              >
                {book.name}
              </Chip>
            ))}
          </ScrollView>
        </Card.Content>
      </Card>
    );
  }, [books, selectedBook, theme]);

  // Show loading indicator on first load
  if (isLoading && allEntries.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <SyncStatusBanner />
        <Surface style={[styles.header, { backgroundColor: theme.colors.primary }]} elevation={2}>
          <Title style={[styles.headerTitle, { color: theme.colors.onPrimary }]}>
            Financial Analytics
          </Title>
        </Surface>
        <View style={styles.loadingContainer}>
          <Surface style={[styles.loadingCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <MaterialIcons name="analytics" size={64} color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>
              Loading analytics data...
            </Text>
            <Text style={[styles.loadingSubtext, { color: theme.colors.onSurfaceVariant }]}>
              Processing your financial data
            </Text>
          </Surface>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Sync Status Banner */}
      <SyncStatusBanner />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Surface style={[styles.header, { backgroundColor: theme.colors.primary }]} elevation={2}>
          <Title style={[styles.headerTitle, { color: theme.colors.onPrimary }]}>
            Financial Analytics
          </Title>
          <Text style={[styles.headerSubtitle, { color: theme.colors.onPrimary }]}>
            Insights into your financial patterns
          </Text>
        </Surface>

        <View style={styles.content}>
          {/* Book Filter */}
          {renderBookFilter()}

          {/* Financial Insights */}
          {renderInsightsCard()}

          {/* Timeframe Toggle */}
          <Card style={[styles.timeframeCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Card.Content>
              <SegmentedButtons
                value={timeframe}
                onValueChange={(value) => setTimeframe(value as 'weekly' | 'monthly')}
                buttons={[
                  { value: 'weekly', label: 'Weekly', icon: 'calendar-week' },
                  { value: 'monthly', label: 'Monthly', icon: 'calendar-month' }
                ]}
              />
            </Card.Content>
          </Card>

          {/* Trend Charts - Only show if there's data */}
          {filteredEntries.length > 0 && (
            <>
            {/* Category Breakdown */}
              <CategoryChart
                title="Expense Categories"
                subtitle="Where your money is going"
                data={categoryData}
                showPercentages={true}
              />
              <TrendChart
                title={`${timeframe === 'monthly' ? 'Monthly' : 'Weekly'} Income vs Expenses`}
                subtitle="Track your financial flow over time"
                data={trendData}
                showIncome={true}
                showExpense={true}
              />
              
              <BarChart
                title={`${timeframe === 'monthly' ? 'Monthly' : 'Weekly'} Net Balance`}
                subtitle="Your savings or deficit by period"
                data={trendData}
                dataKey="balance"
                color={theme.colors.tertiary}
              />

              

              {/* Expense Breakdown Bar Chart */}
              <BarChart
                title="Category Spending"
                subtitle="Compare spending across categories"
                data={categoryData.slice(0, 6).map(cat => ({
                  date: cat.category,
                  income: 0,
                  expense: cat.amount,
                  balance: 0
                }))}
                dataKey="expense"
                color={theme.colors.error}
              />
            </>
          )}
        </View>
      </ScrollView>
    </View>
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
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.9,
  },
  content: {
    padding: spacing.md,
    paddingTop: 0,
  },
  filterCard: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  bookFilters: {
    flexDirection: 'row',
  },
  bookFilterChip: {
    marginRight: spacing.sm,
  },
  insightsCard: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.sm, // Add gap for better spacing
  },
  insightItem: {
    width: '47%', // Changed from 48% to 47% for better fit
    alignItems: 'center',
    marginBottom: spacing.md,
    padding: spacing.xs, // Add padding inside each item
  },
  insightIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  insightLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  insightValue: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  additionalInsights: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  additionalInsightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  additionalInsightLabel: {
    fontSize: 14,
    flex: 1,
  },
  additionalInsightValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeframeCard: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  loadingSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default memo(AnalyticsScreen);