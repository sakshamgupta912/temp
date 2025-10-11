// Books screen - list of all books with Material Design
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  Dimensions
} from 'react-native';
import { 
  Text, 
  FAB, 
  Surface,
  Button,
  useTheme 
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';

import { Book } from '../models/types';
import { useAuth } from '../contexts/AuthContext';
import asyncStorageService from '../services/asyncStorage';
import { RootStackParamList } from '../navigation/Navigation';
import { spacing, borderRadius } from '../theme/materialTheme';
import { BookItem } from '../components/BookItem';
import { SyncStatusBanner } from '../components/SyncStatusBanner';

type BooksNavigationProp = StackNavigationProp<RootStackParamList>;

const BooksScreen: React.FC = () => {
  const navigation = useNavigation<BooksNavigationProp>();
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [entryCounts, setEntryCounts] = useState<{ [bookId: string]: number }>({});
  const theme = useTheme();

  const loadBooks = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const userBooks = await asyncStorageService.getBooks(user.id);
      setBooks(userBooks);
      
      const counts: { [bookId: string]: number } = {};
      for (const book of userBooks) {
        try {
          const entries = await asyncStorageService.getEntries(book.id);
          counts[book.id] = entries.length;
        } catch (error) {
          console.error(`Error loading entries for book ${book.id}:`, error);
          counts[book.id] = 0;
        }
      }
      setEntryCounts(counts);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const handleDeleteBook = useCallback(async (book: Book) => {
    Alert.alert(
      'Delete Book',
      `Are you sure you want to delete "${book.name}"? This will also delete all entries in this book (${entryCounts[book.id] || 0} entries).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await asyncStorageService.deleteBook(book.id);
              await loadBooks();
              Alert.alert('Success', 'Book deleted successfully');
            } catch (error) {
              console.error('Error deleting book:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
              Alert.alert('Delete Failed', `Failed to delete book: ${errorMessage}`);
            }
          },
        },
      ]
    );
  }, [entryCounts, loadBooks]);

  const navigateToBook = useCallback((book: Book) => {
    navigation.navigate('BookDetail', { 
      bookId: book.id, 
      bookName: book.name 
    });
  }, [navigation]);

  const handleEditBook = useCallback((book: Book) => {
    navigation.navigate('EditBook', { bookId: book.id });
  }, [navigation]);

  const navigateToAddBook = useCallback(() => {
    navigation.navigate('AddBook');
  }, [navigation]);

  const sortedBooks = useMemo(() => {
    return books.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [books]);

  useFocusEffect(
    useCallback(() => {
      loadBooks();
    }, [loadBooks])
  );

  const renderBookItem = ({ item: book }: { item: Book }) => (
    <BookItem
      book={book}
      entryCount={entryCounts[book.id]}
      onNavigate={navigateToBook}
      onEdit={handleEditBook}
      onDelete={handleDeleteBook}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Surface style={[styles.emptyState, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Surface style={[styles.emptyIconContainer, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
          <MaterialIcons name="library-books" size={64} color={theme.colors.onSurfaceVariant} />
        </Surface>
        <Text variant="headlineSmall" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
          No Books Yet
        </Text>
        <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          Create your first expense book to start organizing your financial transactions
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
      </Surface>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text variant="headlineMedium" style={[styles.headerTitle, { color: theme.colors.onBackground }]}>
        Your Books
      </Text>
      <Text variant="bodyMedium" style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
        {books.length} book{books.length !== 1 ? 's' : ''} total
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Sync Status Banner */}
      <SyncStatusBanner />
      
      <FlatList
        data={sortedBooks}
        renderItem={renderBookItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        refreshing={isLoading}
        onRefresh={loadBooks}
        windowSize={10}
        initialNumToRender={7}
        maxToRenderPerBatch={5}
      />

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={navigateToAddBook}
        color={theme.colors.onPrimary}
        size="medium"
        label="Add Book"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80, // Space for FAB
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  headerSubtitle: {
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    marginTop: 64,
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
    maxWidth: 280,
  },
  emptyButton: {
    borderRadius: 20,
  },
  emptyButtonContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
});

export default BooksScreen;