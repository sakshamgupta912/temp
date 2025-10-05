// Dashboard screen - main overview of all books
import React, { useState, useEffect, useCallback } from 'react';
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

  const loadDashboardData = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const userBooks = await asyncStorageService.getBooks(user.id);
      setBooks(userBooks);

      // Calculate summaries for each book
      const summaries: BookSummary[] = [];
      let total = 0;

      for (const book of userBooks) {
        const entries = await asyncStorageService.getEntries(book.id);
        const income = entries.filter((e: any) => e.amount > 0).reduce((sum: number, e: any) => sum + e.amount, 0);
        const expenses = entries.filter((e: any) => e.amount < 0).reduce((sum: number, e: any) => sum + Math.abs(e.amount), 0);
        const netBalance = income - expenses;
        
        summaries.push({
          bookId: book.id,
          totalIncome: income,
          totalExpenses: expenses,
          netBalance,
          entryCount: entries.length
        });
        
        total += netBalance;
      }

      setBookSummaries(summaries);
      setTotalBalance(total);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  };

  const navigateToBook = (book: Book) => {
    navigation.navigate('BookDetail', { 
      bookId: book.id, 
      bookName: book.name 
    });
  };

  const navigateToAddBook = () => {
    navigation.navigate('AddBook');
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [user])
  );

  const formatCurrency = (amount: number) => {
    return `₹${Math.abs(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2 
    })}`;
  };

  const getBalanceColor = (balance: number) => {
    return balance >= 0 ? '#4CAF50' : '#F44336';
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Total Balance Card */}
        <Card style={styles.totalCard}>
          <Card.Content>
            <Title style={styles.totalTitle}>Total Balance</Title>
            <Text style={[styles.totalAmount, { color: getBalanceColor(totalBalance) }]}>
              {formatCurrency(totalBalance)}
            </Text>
            <Text variant="bodyMedium" style={styles.totalSubtitle}>
              Across {books.length} book{books.length !== 1 ? 's' : ''}
            </Text>
          </Card.Content>
        </Card>

        {/* Books List */}
        {books.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <MaterialIcons name="book" size={64} color="#ccc" />
              <Title style={styles.emptyTitle}>No Books Yet</Title>
              <Text variant="bodyMedium" style={styles.emptyText}>
                Create your first expense book to start tracking your finances
              </Text>
              <Button 
                mode="contained" 
                onPress={navigateToAddBook}
                style={styles.emptyButton}
              >
                Add First Book
              </Button>
            </Card.Content>
          </Card>
        ) : (
          books.map((book) => {
            const summary = bookSummaries.find(s => s.bookId === book.id);
            return (
              <TouchableOpacity 
                key={book.id} 
                onPress={() => navigateToBook(book)}
              >
                <Card style={styles.bookCard}>
                  <Card.Content>
                    <View style={styles.bookHeader}>
                      <View style={styles.bookInfo}>
                        <Title style={styles.bookTitle}>{book.name}</Title>
                        {book.description && (
                          <Text variant="bodySmall" style={styles.bookDescription}>
                            {book.description}
                          </Text>
                        )}
                      </View>
                      <View style={styles.bookBalance}>
                        <Text style={[
                          styles.bookAmount,
                          { color: getBalanceColor(summary?.netBalance || 0) }
                        ]}>
                          {formatCurrency(summary?.netBalance || 0)}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.bookStats}>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                          {formatCurrency(summary?.totalIncome || 0)}
                        </Text>
                        <Text style={styles.statLabel}>Income</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                          {formatCurrency(summary?.totalExpenses || 0)}
                        </Text>
                        <Text style={styles.statLabel}>Expenses</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                          {summary?.entryCount || 0}
                        </Text>
                        <Text style={styles.statLabel}>Entries</Text>
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <FAB
        style={styles.fab}
        icon="plus"
        onPress={navigateToAddBook}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  totalCard: {
    marginBottom: 16,
    elevation: 4,
    backgroundColor: '#2196F3',
  },
  totalTitle: {
    color: 'white',
    fontSize: 18,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  totalSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  emptyCard: {
    marginTop: 50,
    elevation: 2,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    marginTop: 16,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginBottom: 20,
  },
  emptyButton: {
    marginTop: 10,
  },
  bookCard: {
    marginBottom: 12,
    elevation: 2,
  },
  bookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bookInfo: {
    flex: 1,
    marginRight: 16,
  },
  bookTitle: {
    fontSize: 18,
    marginBottom: 4,
  },
  bookDescription: {
    color: '#666',
    fontSize: 14,
  },
  bookBalance: {
    alignItems: 'flex-end',
  },
  bookAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  bookStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
  },
});

export default DashboardScreen;