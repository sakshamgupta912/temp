// Books screen - list of all books with management options
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Card, Title, Paragraph, FAB, IconButton, Menu } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';

import { Book } from '../models/types';
import { useAuth } from '../contexts/AuthContext';
import asyncStorageService from '../services/asyncStorage';
import { RootStackParamList } from '../navigation/Navigation';

type BooksNavigationProp = StackNavigationProp<RootStackParamList>;

const BooksScreen: React.FC = () => {
  const navigation = useNavigation<BooksNavigationProp>();
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);

  // Reset menu state when screen focuses
  React.useEffect(() => {
    setMenuVisible(null);
  }, [books]);

  const loadBooks = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const userBooks = await asyncStorageService.getBooks(user.id);
      setBooks(userBooks);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBook = async (book: Book) => {
    Alert.alert(
      'Delete Book',
      `Are you sure you want to delete "${book.name}"? This will also delete all entries in this book.`,
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
              Alert.alert('Error', 'Failed to delete book');
            }
          },
        },
      ]
    );
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
      loadBooks();
    }, [user])
  );

  const renderBookItem = ({ item: book }: { item: Book }) => (
    <TouchableOpacity onPress={() => navigateToBook(book)}>
      <Card style={styles.bookCard}>
        <Card.Content>
          <View style={styles.bookHeader}>
            <View style={styles.bookInfo}>
              <Title style={styles.bookTitle}>{book.name}</Title>
              {book.description && (
                <Paragraph style={styles.bookDescription}>
                  {book.description}
                </Paragraph>
              )}
              <Text style={styles.bookDate}>
                Created {book.createdAt.toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.bookActions}>
              <Menu
                visible={menuVisible === book.id}
                onDismiss={() => setMenuVisible(null)}
                anchor={
                  <IconButton
                    icon="dots-vertical"
                    onPress={() => {
                      // Toggle pattern to ensure state change
                      setMenuVisible(null);
                      setTimeout(() => setMenuVisible(book.id), 0);
                    }}
                  />
                }
              >
                <Menu.Item
                  onPress={() => {
                    setMenuVisible(null);
                    navigateToBook(book);
                  }}
                  title="View Details"
                  leadingIcon="eye"
                />
                <Menu.Item
                  onPress={() => {
                    setMenuVisible(null);
                    navigation.navigate('AddEntry', { bookId: book.id });
                  }}
                  title="Add Entry"
                  leadingIcon="plus"
                />
                <Menu.Item
                  onPress={() => {
                    setMenuVisible(null);
                    handleDeleteBook(book);
                  }}
                  title="Delete"
                  leadingIcon="delete"
                />
              </Menu>
            </View>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="book" size={64} color="#ccc" />
      <Title style={styles.emptyTitle}>No Books Yet</Title>
      <Paragraph style={styles.emptyText}>
        Create your first expense book to start tracking your finances
      </Paragraph>
    </View>
  );

  return (
    <View style={styles.container}>
      {books.length === 0 && !isLoading ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={books}
          renderItem={renderBookItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

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
  listContainer: {
    padding: 16,
  },
  bookCard: {
    marginBottom: 12,
    elevation: 2,
  },
  bookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    marginBottom: 8,
  },
  bookDate: {
    fontSize: 12,
    color: '#999',
  },
  bookActions: {
    alignItems: 'flex-end',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    marginTop: 16,
    color: '#666',
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 8,
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
  },
});

export default BooksScreen;