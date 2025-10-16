// AI Transactions Screen - Review and manage AI-predicted transactions
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  Dimensions,
  Pressable,
} from 'react-native';
import {
  Surface,
  Text,
  Button,
  IconButton,
  Chip,
  useTheme,
  ActivityIndicator,
  FAB,
  Dialog,
  Portal,
  TextInput,
  Divider,
  SegmentedButtons,
} from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import aiTransactionService from '../services/aiTransactionService';
import asyncStorageService from '../services/asyncStorage';
import { PendingTransaction, Book, Category, PaymentMode } from '../models/types';
import { spacing, borderRadius } from '../theme/materialTheme';
import { ManualEntryDialog } from '../components/ManualEntryDialog';

const { width } = Dimensions.get('window');

const AITransactionsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const theme = useTheme();

  // State
  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<PendingTransaction | null>(null);
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [manualEntryDialogVisible, setManualEntryDialogVisible] = useState(false);
  
  // Edit form state
  const [editBookId, setEditBookId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPaymentMode, setEditPaymentMode] = useState<PaymentMode>(PaymentMode.UPI);
  
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState({
    totalProcessed: 0,
    autoApproved: 0,
    avgConfidence: 0,
    accuracyRate: 0,
  });

  // Load data
  const loadTransactions = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const [pending, booksData, categoriesData, statistics] = await Promise.all([
        aiTransactionService.getPendingTransactions(user.id),
        asyncStorageService.getBooks(user.id),
        asyncStorageService.getCategories(user.id),
        aiTransactionService.getStatistics(user.id),
      ]);

      setTransactions(pending);
      setBooks(booksData);
      setCategories(categoriesData);
      setStats(statistics);
    } catch (error) {
      console.error('Error loading AI transactions:', error);
      Alert.alert('Error', 'Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadTransactions();
    setIsRefreshing(false);
  }, [loadTransactions]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions])
  );

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (filter === 'all') return true;
    if (filter === 'high') return tx.prediction.overallConfidence.level === 'high';
    if (filter === 'medium') return tx.prediction.overallConfidence.level === 'medium';
    if (filter === 'low') return tx.prediction.overallConfidence.level === 'low';
    return true;
  });

  // Actions
  const handleApprove = async (transaction: PendingTransaction) => {
    if (!user) return;

    try {
      await aiTransactionService.approveTransaction(transaction.id, user.id);
      Alert.alert('Success', 'Transaction approved and entry created!');
      await loadTransactions();
    } catch (error) {
      console.error('Error approving transaction:', error);
      Alert.alert('Error', 'Failed to approve transaction');
    }
  };

  const handleReject = async (transaction: PendingTransaction) => {
    if (!user) return;

    Alert.alert(
      'Reject Transaction',
      'Are you sure you want to reject this transaction? It will be discarded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await aiTransactionService.rejectTransaction(transaction.id, user.id);
              Alert.alert('Success', 'Transaction rejected');
              await loadTransactions();
            } catch (error) {
              console.error('Error rejecting transaction:', error);
              Alert.alert('Error', 'Failed to reject transaction');
            }
          },
        },
      ]
    );
  };

  const openEditDialog = (transaction: PendingTransaction) => {
    setSelectedTransaction(transaction);
    setEditBookId(transaction.prediction.bookId);
    setEditCategoryId(transaction.prediction.categoryId);
    setEditDescription(transaction.prediction.suggestedDescription);
    setEditPaymentMode(transaction.prediction.paymentMode);
    setEditDialogVisible(true);
  };

  const handleEditAndApprove = async () => {
    if (!user || !selectedTransaction) return;

    try {
      const corrections: any = {};
      
      if (editBookId !== selectedTransaction.prediction.bookId) {
        corrections.bookId = editBookId;
      }
      if (editCategoryId !== selectedTransaction.prediction.categoryId) {
        corrections.categoryId = editCategoryId;
      }
      if (editDescription !== selectedTransaction.prediction.suggestedDescription) {
        corrections.description = editDescription;
      }
      if (editPaymentMode !== selectedTransaction.prediction.paymentMode) {
        corrections.paymentMode = editPaymentMode;
      }

      await aiTransactionService.editAndApproveTransaction(
        selectedTransaction.id,
        corrections,
        user.id
      );

      setEditDialogVisible(false);
      Alert.alert('Success', 'Transaction edited and approved!');
      await loadTransactions();
    } catch (error) {
      console.error('Error editing transaction:', error);
      Alert.alert('Error', 'Failed to edit transaction');
    }
  };

  // Get confidence color
  const getConfidenceColor = (level: 'high' | 'medium' | 'low') => {
    if (level === 'high') return theme.colors.tertiary;
    if (level === 'medium') return '#FFA726';
    return theme.colors.error;
  };

  const getConfidenceIcon = (level: 'high' | 'medium' | 'low') => {
    if (level === 'high') return 'check-circle';
    if (level === 'medium') return 'info';
    return 'warning';
  };

  // Render transaction card
  const renderTransactionCard = ({ item: transaction }: { item: PendingTransaction }) => {
    const confidence = transaction.prediction.overallConfidence;
    const confidenceColor = getConfidenceColor(confidence.level);

    return (
      <Surface
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
        elevation={2}
      >
        {/* Confidence Badge */}
        <View style={[styles.confidenceBadge, { backgroundColor: `${confidenceColor}20` }]}>
          <MaterialIcons
            name={getConfidenceIcon(confidence.level)}
            size={16}
            color={confidenceColor}
          />
          <Text style={[styles.confidenceText, { color: confidenceColor }]}>
            {confidence.value}% Confidence
          </Text>
        </View>

        {/* Amount and Merchant */}
        <View style={styles.mainInfo}>
          <Text variant="headlineSmall" style={[styles.amount, { color: theme.colors.onSurface }]}>
            ₹{transaction.rawAmount.toLocaleString('en-IN')}
          </Text>
          <Text variant="bodyLarge" style={[styles.merchant, { color: theme.colors.onSurface }]}>
            {transaction.prediction.detectedMerchant || 'Unknown Merchant'}
          </Text>
        </View>

        {/* Predictions */}
        <View style={styles.predictions}>
          <View style={styles.predictionRow}>
            <MaterialIcons name="book" size={16} color={theme.colors.primary} />
            <Text variant="bodyMedium" style={[styles.predictionText, { color: theme.colors.onSurfaceVariant }]}>
              {transaction.prediction.bookName}
            </Text>
          </View>
          <View style={styles.predictionRow}>
            <MaterialIcons name="category" size={16} color={theme.colors.secondary} />
            <Text variant="bodyMedium" style={[styles.predictionText, { color: theme.colors.onSurfaceVariant }]}>
              {transaction.prediction.categoryName}
            </Text>
          </View>
          <View style={styles.predictionRow}>
            <MaterialIcons name="payment" size={16} color={theme.colors.tertiary} />
            <Text variant="bodyMedium" style={[styles.predictionText, { color: theme.colors.onSurfaceVariant }]}>
              {transaction.prediction.paymentMode.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Date and Source */}
        <View style={styles.metadata}>
          <Chip
            icon="calendar"
            style={styles.chip}
            textStyle={{ fontSize: 11 }}
          >
            {new Date(transaction.transactionDate).toLocaleDateString()}
          </Chip>
          <Chip
            icon="source"
            style={styles.chip}
            textStyle={{ fontSize: 11 }}
          >
            {transaction.source.toUpperCase()}
          </Chip>
        </View>

        <Divider style={styles.divider} />

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={() => handleReject(transaction)}
            style={styles.actionButton}
            icon="close"
            textColor={theme.colors.error}
          >
            Reject
          </Button>
          <Button
            mode="outlined"
            onPress={() => openEditDialog(transaction)}
            style={styles.actionButton}
            icon="edit"
          >
            Edit
          </Button>
          <Button
            mode="contained"
            onPress={() => handleApprove(transaction)}
            style={styles.actionButton}
            icon="check"
          >
            Approve
          </Button>
        </View>
      </Surface>
    );
  };

  // Render statistics header
  const renderHeader = () => (
    <View style={styles.header}>
      <Text variant="headlineMedium" style={[styles.headerTitle, { color: theme.colors.onBackground }]}>
        AI Transactions
      </Text>
      
      {/* Statistics */}
      <View style={styles.statsContainer}>
        <Surface style={[styles.statCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
          <Text variant="headlineSmall" style={{ color: theme.colors.primary }}>
            {transactions.length}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Pending
          </Text>
        </Surface>
        <Surface style={[styles.statCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
          <Text variant="headlineSmall" style={{ color: theme.colors.tertiary }}>
            {stats.avgConfidence}%
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Avg Confidence
          </Text>
        </Surface>
        <Surface style={[styles.statCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
          <Text variant="headlineSmall" style={{ color: theme.colors.secondary }}>
            {stats.accuracyRate}%
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Accuracy
          </Text>
        </Surface>
      </View>

      {/* Filter */}
      <SegmentedButtons
        value={filter}
        onValueChange={(value) => setFilter(value as any)}
        buttons={[
          { value: 'all', label: 'All' },
          { value: 'high', label: 'High' },
          { value: 'medium', label: 'Medium' },
          { value: 'low', label: 'Low' },
        ]}
        style={styles.filterButtons}
      />
    </View>
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Surface style={[styles.emptyState, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <MaterialIcons name="auto-awesome" size={64} color={theme.colors.primary} />
        <Text variant="headlineSmall" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
          No Pending Transactions
        </Text>
        <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          Import transactions via SMS, manual entry, or CSV to get started with AI predictions
        </Text>
        <Button
          mode="contained"
          onPress={() => setManualEntryDialogVisible(true)}
          style={styles.emptyButton}
          icon="plus"
        >
          Add Transaction
        </Button>
      </Surface>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyLarge" style={{ marginTop: spacing.md, color: theme.colors.onBackground }}>
          Loading AI transactions...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={filteredTransactions}
        renderItem={renderTransactionCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      />

      {/* Edit Dialog */}
      <Portal>
        <Dialog visible={editDialogVisible} onDismiss={() => setEditDialogVisible(false)}>
          <Dialog.Title>Edit Transaction</Dialog.Title>
          <Dialog.ScrollArea>
            <View style={styles.dialogContent}>
              {/* Book Picker */}
              <Text variant="labelLarge" style={styles.dialogLabel}>Book</Text>
              {books.map((book) => (
                <Chip
                  key={book.id}
                  selected={editBookId === book.id}
                  onPress={() => setEditBookId(book.id)}
                  style={styles.dialogChip}
                >
                  {book.name}
                </Chip>
              ))}

              <Divider style={styles.dialogDivider} />

              {/* Category Picker */}
              <Text variant="labelLarge" style={styles.dialogLabel}>Category</Text>
              {categories.map((category) => (
                <Chip
                  key={category.id}
                  selected={editCategoryId === category.id}
                  onPress={() => setEditCategoryId(category.id)}
                  style={styles.dialogChip}
                >
                  {category.name}
                </Chip>
              ))}

              <Divider style={styles.dialogDivider} />

              {/* Description */}
              <TextInput
                label="Description"
                value={editDescription}
                onChangeText={setEditDescription}
                mode="outlined"
                style={styles.dialogInput}
              />
            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setEditDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleEditAndApprove}>Approve</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Manual Entry Dialog */}
      <ManualEntryDialog
        visible={manualEntryDialogVisible}
        onDismiss={() => setManualEntryDialogVisible(false)}
        onSubmit={async (data) => {
          if (!user) return;
          await aiTransactionService.parseTransaction(
            {
              amount: data.amount,
              description: data.description,
              date: data.date,
              source: 'manual',
            },
            user.id
          );
          await loadTransactions();
          Alert.alert('Success', 'Transaction added! AI is analyzing it now.');
        }}
      />

      {/* FAB for manual entry */}
      <FAB
        icon="plus"
        label="Add Manually"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => setManualEntryDialogVisible(true)}
        color={theme.colors.onPrimary}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  filterButtons: {
    marginTop: spacing.sm,
  },
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  mainInfo: {
    marginBottom: spacing.md,
  },
  amount: {
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  merchant: {
    fontWeight: '500',
  },
  predictions: {
    marginBottom: spacing.md,
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  predictionText: {
    marginLeft: spacing.sm,
  },
  metadata: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  chip: {
    marginRight: spacing.sm,
    height: 28,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    marginTop: 64,
  },
  emptyState: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 22,
    maxWidth: 280,
  },
  emptyButton: {
    marginTop: spacing.sm,
  },
  dialogContent: {
    paddingHorizontal: spacing.md,
  },
  dialogLabel: {
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  dialogChip: {
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  dialogDivider: {
    marginVertical: spacing.md,
  },
  dialogInput: {
    marginBottom: spacing.sm,
  },
  fab: {
    position: 'absolute',
    margin: spacing.md,
    right: 0,
    bottom: 0,
    borderRadius: borderRadius.md,
  },
});

export default AITransactionsScreen;
