// EntryItem component with comprehensive logging
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, IconButton, Menu, useTheme } from 'react-native-paper';
import { Entry } from '../models/types';

type EntryItemProps = {
  item: Entry;
  onEdit: (item: Entry) => void;
  onDelete: (item: Entry) => void;
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(date));
};

export const EntryItem: React.FC<EntryItemProps> = React.memo(({ item, onEdit, onDelete }) => {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);

  console.log(`[EntryItem ${item.id.slice(-4)}] Rendering, menuVisible:`, menuVisible);

  // Force reset menu state when component remounts
  React.useEffect(() => {
    console.log(`[EntryItem ${item.id.slice(-4)}] 🔄 Component mounted/updated, resetting menu`);
    setMenuVisible(false);
  }, [item.id]);

  const openMenu = () => {
    console.log(`[EntryItem ${item.id.slice(-4)}] 🟢 openMenu called`);
    console.log(`[EntryItem ${item.id.slice(-4)}] Previous menuVisible:`, menuVisible);
    // Force close first, then open to ensure state change
    setMenuVisible(false);
    setTimeout(() => {
      console.log(`[EntryItem ${item.id.slice(-4)}] setMenuVisible(true) called`);
      setMenuVisible(true);
    }, 0);
  };

  const closeMenu = () => {
    console.log(`[EntryItem ${item.id.slice(-4)}] 🔴 closeMenu called`);
    console.log(`[EntryItem ${item.id.slice(-4)}] Previous menuVisible:`, menuVisible);
    setMenuVisible(false);
    console.log(`[EntryItem ${item.id.slice(-4)}] setMenuVisible(false) called`);
  };

  const handleEdit = () => {
    console.log(`[EntryItem ${item.id.slice(-4)}] ✏️ handleEdit called`);
    setMenuVisible(false);
    console.log(`[EntryItem ${item.id.slice(-4)}] Calling onEdit prop`);
    onEdit(item);
  };

  const handleDelete = () => {
    console.log(`[EntryItem ${item.id.slice(-4)}] 🗑️ handleDelete called`);
    setMenuVisible(false);
    console.log(`[EntryItem ${item.id.slice(-4)}] Calling onDelete prop`);
    onDelete(item);
  };

  const isIncome = item.amount >= 0;

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.amount, { color: isIncome ? theme.colors.primary : theme.colors.error }]}>
              {isIncome ? '+' : '-'}${Math.abs(item.amount).toFixed(2)}
            </Text>
            <Text style={styles.category}>{item.category}</Text>
          </View>
          <Menu
            visible={menuVisible}
            onDismiss={() => {
              console.log(`[EntryItem ${item.id.slice(-4)}] ⚠️ Menu onDismiss triggered`);
              closeMenu();
            }}
            anchor={
              <IconButton 
                icon="dots-vertical" 
                onPress={() => {
                  console.log(`[EntryItem ${item.id.slice(-4)}] 👆 IconButton onPress triggered`);
                  openMenu();
                }}
              />
            }
          >
            <Menu.Item 
              onPress={() => {
                console.log(`[EntryItem ${item.id.slice(-4)}] Menu.Item Edit pressed`);
                handleEdit();
              }} 
              title="Edit" 
              leadingIcon="pencil" 
            />
            <Menu.Item 
              onPress={() => {
                console.log(`[EntryItem ${item.id.slice(-4)}] Menu.Item Delete pressed`);
                handleDelete();
              }} 
              title="Delete" 
              leadingIcon="delete" 
            />
          </Menu>
        </View>
        <View style={styles.footer}>
          <Text style={styles.date}>{formatDate(item.date)}</Text>
          <Text style={styles.paymentMethod}>{item.paymentMode}</Text>
        </View>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  amount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  category: {
    fontSize: 16,
    color: '#666',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  paymentMethod: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
  },
});