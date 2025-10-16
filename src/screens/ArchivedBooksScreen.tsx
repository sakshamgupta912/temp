// Archived Books screen - View and unarchive books
import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import { 
  Text, 
  Surface,
  IconButton,
  useTheme,
  Appbar,
  Button,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';

import { Book } from '../models/types';
import { useAuth } from '../contexts/AuthContext';
import asyncStorageService from '../services/asyncStorage';
import { RootStackParamList } from '../navigation/Navigation';
import { spacing, borderRadius } from '../theme/materialTheme';

type ArchivedBooksNavigationProp = StackNavigationProp<RootStackParamList>;

const ArchivedBooksScreen: React.FC = () => {
  const navigation = useNavigation<ArchivedBooksNavigationProp>();
  const { user } = useAuth();
  const [archivedBooks, setArchivedBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const theme = useTheme();

  const loadArchivedBooks = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const books = await asyncStorageService.getArchivedBooks(user.id);
      setArchivedBooks(books);
    } catch (error) {
      console.error('Error loading archived books:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadArchivedBooks();
    }, [loadArchivedBooks])
  );

  const handleUnarchiveBook = useCallback(async (book: Book) => {
    Alert.alert(
      'Unarchive Book?',
      `"${book.name}" will be visible again in your books list and available for AI classification.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unarchive',
          onPress: async () => {
            try {
              await asyncStorageService.updateBook(book.id, {
                archived: false,
                archivedAt: undefined,
              });
              Alert.alert('Success', 'Book unarchived successfully');
              await loadArchivedBooks();
            } catch (error) {
              console.error('Error unarchiving book:', error);
              Alert.alert('Error', 'Failed to unarchive book');
            }
          },
        },
      ]
    );
  }, [loadArchivedBooks]);

  const handleViewBook = useCallback((book: Book) => {
    navigation.navigate('BookDetail', { 
      bookId: book.id, 
      bookName: book.name 
    });
  }, [navigation]);

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderArchivedBookItem = ({ item: book }: { item: Book }) => (
    <Surface 
      style={[styles.bookCard, { backgroundColor: theme.colors.surface }]} 
      elevation={1}
    >
      <View style={styles.bookHeader}>
        <View style={styles.bookIconContainer}>
          <MaterialIcons 
            name="archive" 
            size={32} 
            color={theme.colors.onSurfaceVariant} 
          />
        </View>
        <View style={styles.bookInfo}>
          <Text variant="titleMedium" style={[styles.bookName, { color: theme.colors.onSurface }]}>
            {book.name}
          </Text>
          {book.description && (
            <Text 
              variant="bodySmall" 
              style={[styles.bookDescription, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={2}
            >
              {book.description}
            </Text>
          )}
          <View style={styles.bookMeta}>
            <MaterialIcons name="event" size={14} color={theme.colors.onSurfaceVariant} />
            <Text 
              variant="bodySmall" 
              style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}
            >
              Archived {formatDate(book.archivedAt)}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.bookActions}>
        <Button
          mode="outlined"
          onPress={() => handleViewBook(book)}
          style={styles.actionButton}
          icon="eye"
          compact
        >
          View
        </Button>
        <Button
          mode="contained"
          onPress={() => handleUnarchiveBook(book)}
          style={styles.actionButton}
          icon="package-up"
          compact
        >
          Unarchive
        </Button>
      </View>
    </Surface>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Surface style={[styles.emptyState, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Surface style={[styles.emptyIconContainer, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
          <MaterialIcons name="unarchive" size={64} color={theme.colors.onSurfaceVariant} />
        </Surface>
        <Text variant="headlineSmall" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
          No Archived Books
        </Text>
        <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          Books you archive will appear here. Archived books are hidden from the main list and AI won't classify entries into them.
        </Text>
        <Button
          mode="contained"
          onPress={() => navigation.goBack()}
          style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]}
          labelStyle={{ color: theme.colors.onPrimary }}
          contentStyle={styles.emptyButtonContent}
        >
          Go Back
        </Button>
      </Surface>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text variant="bodyMedium" style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
        {archivedBooks.length} archived book{archivedBooks.length !== 1 ? 's' : ''}
      </Text>
      <Text variant="bodySmall" style={[styles.headerHint, { color: theme.colors.onSurfaceVariant }]}>
        Unarchive a book to make it visible again and available for AI classification
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Archived Books" />
      </Appbar.Header>
      
      <FlatList
        data={archivedBooks}
        renderItem={renderArchivedBookItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={archivedBooks.length > 0 ? renderHeader : null}
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
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
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
  },
  headerSubtitle: {
    marginBottom: 4,
  },
  headerHint: {
    opacity: 0.8,
    fontStyle: 'italic',
  },
  bookCard: {
    borderRadius: borderRadius.md,
    padding: 16,
  },
  bookHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bookIconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  bookInfo: {
    flex: 1,
  },
  bookName: {
    fontWeight: '600',
    marginBottom: 4,
  },
  bookDescription: {
    marginBottom: 6,
    lineHeight: 18,
  },
  bookMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    marginLeft: 4,
  },
  bookActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
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
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    paddingHorizontal: 16,
  },
  emptyButtonContent: {
    paddingVertical: 4,
  },
});

export default ArchivedBooksScreen;
