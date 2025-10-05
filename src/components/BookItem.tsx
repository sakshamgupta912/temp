// src/components/BookItem.tsx
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { Card, Text, IconButton, Menu, Surface, Divider, Button, useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { Book } from '../models/types';

type BookItemProps = {
  book: Book;
  entryCount: number;
  onNavigate: (book: Book) => void;
  onDelete: (book: Book) => void;
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(date));
};

export const BookItem: React.FC<BookItemProps> = React.memo(({ book, entryCount, onNavigate, onDelete }) => {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);

  console.log(`[BookItem ${book.id.slice(-4)}] Rendering, menuVisible:`, menuVisible);

  // Force reset menu state when component remounts
  React.useEffect(() => {
    console.log(`[BookItem ${book.id.slice(-4)}] 🔄 Component mounted/updated, resetting menu`);
    setMenuVisible(false);
  }, [book.id]);

  const handleCardPress = () => {
    console.log(`[BookItem ${book.id.slice(-4)}] 🟦 handleCardPress called, menuVisible:`, menuVisible);
    if (menuVisible) {
      console.log(`[BookItem ${book.id.slice(-4)}] ⛔ Card press blocked - menu is visible`);
      return;
    }
    console.log(`[BookItem ${book.id.slice(-4)}] 📱 Calling onNavigate`);
    onNavigate(book);
  };

  const openMenu = () => {
    console.log(`[BookItem ${book.id.slice(-4)}] 🟢 openMenu called`);
    console.log(`[BookItem ${book.id.slice(-4)}] Previous menuVisible:`, menuVisible);
    // Force close first, then open to ensure state change
    setMenuVisible(false);
    setTimeout(() => {
      console.log(`[BookItem ${book.id.slice(-4)}] setMenuVisible(true) called`);
      setMenuVisible(true);
    }, 0);
  };

  const closeMenu = () => {
    console.log(`[BookItem ${book.id.slice(-4)}] 🔴 closeMenu called`);
    console.log(`[BookItem ${book.id.slice(-4)}] Previous menuVisible:`, menuVisible);
    setMenuVisible(false);
    console.log(`[BookItem ${book.id.slice(-4)}] setMenuVisible(false) called`);
  };

  const handleEdit = () => {
    console.log(`[BookItem ${book.id.slice(-4)}] ✏️ handleEdit called`);
    setMenuVisible(false);
    Alert.alert('Edit Book', 'Edit book functionality not yet implemented');
  };

  const handleDelete = () => {
    console.log(`[BookItem ${book.id.slice(-4)}] 🗑️ handleDelete called`);
    setMenuVisible(false);
    console.log(`[BookItem ${book.id.slice(-4)}] Calling onDelete prop`);
    onDelete(book);
  };

  const handleViewDetails = () => {
    console.log(`[BookItem ${book.id.slice(-4)}] 👁️ handleViewDetails called`);
    setMenuVisible(false);
    console.log(`[BookItem ${book.id.slice(-4)}] Calling onNavigate from menu`);
    onNavigate(book);
  };

  return (
    <Pressable onPress={() => {
      console.log(`[BookItem ${book.id.slice(-4)}] \ud83d\udc46 Pressable onPress triggered`);
      handleCardPress();
    }}>
      <Surface style={[styles.bookCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={styles.bookContent}>
          <View style={styles.bookHeader}>
            <Surface style={[styles.bookIconContainer, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
              <MaterialIcons name="book" size={24} color={theme.colors.onPrimaryContainer} />
            </Surface>
            
            <View style={styles.bookInfo}>
              <Text variant="titleMedium" style={[styles.bookTitle, { color: theme.colors.onSurface }]}>
                {book.name}
              </Text>
              {book.description && (
                <Text variant="bodySmall" style={[styles.bookDescription, { color: theme.colors.onSurfaceVariant }]}>
                  {book.description}
                </Text>
              )}
              <Text variant="bodySmall" style={[styles.bookDate, { color: theme.colors.onSurfaceVariant }]}>
                Created {formatDate(book.createdAt)}
              </Text>
            </View>

            <Menu
              visible={menuVisible}
              onDismiss={() => {
                console.log(`[BookItem ${book.id.slice(-4)}] ⚠️ Menu onDismiss triggered`);
                closeMenu();
              }}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  size={20}
                  onPress={() => {
                    console.log(`[BookItem ${book.id.slice(-4)}] 👆 IconButton onPress triggered`);
                    openMenu();
                  }}
                  iconColor={theme.colors.onSurfaceVariant}
                />
              }
            >
              <Menu.Item 
                onPress={() => {
                  console.log(`[BookItem ${book.id.slice(-4)}] Menu.Item View Details pressed`);
                  handleViewDetails();
                }} 
                title="View Details" 
                leadingIcon="eye" 
              />
              <Menu.Item 
                onPress={() => {
                  console.log(`[BookItem ${book.id.slice(-4)}] Menu.Item Edit pressed`);
                  handleEdit();
                }} 
                title="Edit Book" 
                leadingIcon="pencil" 
              />
              <Menu.Item 
                onPress={() => {
                  console.log(`[BookItem ${book.id.slice(-4)}] Menu.Item Delete pressed`);
                  handleDelete();
                }} 
                title="Delete" 
                leadingIcon="delete" 
              />
            </Menu>
          </View>

          <Divider style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

          <View style={styles.quickStats}>
            <View style={styles.statItem}>
              <MaterialIcons name="receipt" size={16} color={theme.colors.onSurfaceVariant} />
              <Text variant="bodySmall" style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
                {entryCount || 0} entries
              </Text>
            </View>
            <View style={styles.statItem}>
              <MaterialIcons name="schedule" size={16} color={theme.colors.onSurfaceVariant} />
              <Text variant="bodySmall" style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
                Updated {formatDate(book.updatedAt)}
              </Text>
            </View>
          </View>

          <View style={styles.quickActions}>
            <Button
              mode="text"
              onPress={handleViewDetails}
              contentStyle={styles.quickActionButton}
              labelStyle={[styles.quickActionLabel, { color: theme.colors.primary }]}
            >
              View Book
            </Button>
            <Button
              mode="text"
              onPress={handleViewDetails} // Assuming this should also navigate to the book to add an entry
              contentStyle={styles.quickActionButton}
              labelStyle={[styles.quickActionLabel, { color: theme.colors.primary }]}
            >
              Add Entry
            </Button>
          </View>
        </View>
      </Surface>
    </Pressable>
  );
});

const styles = StyleSheet.create({
    bookCard: {
        borderRadius: 12,
        marginBottom: 16,
      },
      bookContent: {
        padding: 16,
      },
      bookHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
      },
      bookIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
      },
      bookInfo: {
        flex: 1,
        marginRight: 8,
      },
      bookTitle: {
        fontWeight: '600',
        marginBottom: 4,
      },
      bookDescription: {
        marginBottom: 4,
        opacity: 0.8,
      },
      bookDate: {
        opacity: 0.6,
        fontSize: 12,
      },
      divider: {
        marginVertical: 16,
        height: 1,
      },
      quickStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
      },
      statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
      },
      statText: {
        marginLeft: 8,
        fontSize: 12,
      },
      quickActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 8,
      },
      quickActionButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
      },
      quickActionLabel: {
        fontSize: 12,
        fontWeight: '600',
      },
});
