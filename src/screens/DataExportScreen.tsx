// Data Export screen - export user data in various formats
import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  Platform
} from 'react-native';
import { 
  Card, 
  Title, 
  List, 
  Button,
  useTheme,
  Text,
  Divider,
  Dialog,
  Portal,
  RadioButton,
  Checkbox,
  Surface,
  ProgressBar,
  IconButton
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import * as XLSX from 'xlsx';
import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../navigation/Navigation';
import asyncStorageService from '../services/asyncStorage';
import preferencesService from '../services/preferences';
import { Book, Entry, Category, PaymentMode } from '../models/types';

type DataExportNavigationProp = StackNavigationProp<RootStackParamList>;

interface ExportOptions {
  format: 'JSON' | 'CSV' | 'EXCEL';
  includeBooks: boolean;
  includeEntries: boolean;
  includeCategories: boolean;
  includePreferences: boolean;
  dateRange: 'all' | 'last_month' | 'last_3_months' | 'last_year';
}

const DataExportScreen: React.FC = () => {
  const navigation = useNavigation<DataExportNavigationProp>();
  const { user } = useAuth();
  const theme = useTheme();

  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'EXCEL',
    includeBooks: true,
    includeEntries: true,
    includeCategories: true,
    includePreferences: false,
    dateRange: 'all'
  });
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const [showDateRangeDialog, setShowDateRangeDialog] = useState(false);

  const updateOption = <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) => {
    setExportOptions(prev => ({ ...prev, [key]: value }));
  };

  const getDateRangeFilter = () => {
    const now = new Date();
    const ranges = {
      all: null,
      last_month: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
      last_3_months: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
      last_year: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    };
    return ranges[exportOptions.dateRange];
  };

  const generateCSV = (data: any[]): string => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');
    
    return csvContent;
  };

  const generateExcelWorkbook = async (books: Book[], allCategories: Category[], dateFilter: Date | null) => {
    const workbook = XLSX.utils.book_new();

    // Create a summary sheet
    const summaryData = [
      ['Expense Tracker Export'],
      ['Export Date', new Date().toLocaleDateString()],
      ['Export Time', new Date().toLocaleTimeString()],
      ['Total Books', books.length],
      ['Date Range', getDateRangeLabel()],
      [],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Create a sheet for each book with its entries
    for (const book of books) {
      console.log(`Exporting book: ${book.name}`);
      
      // Get entries for this book
      let entries = await asyncStorageService.getEntries(book.id);
      
      // Filter by date range if specified
      if (dateFilter) {
        entries = entries.filter(entry => entry.date >= dateFilter);
      }

      // Create readable entry data
      const entriesData = entries.map(entry => {
        // Find category name
        const category = allCategories.find(c => c.id === entry.category);
        const categoryName = category ? category.name : entry.category;

        return {
          'Date': entry.date instanceof Date ? entry.date.toLocaleDateString() : new Date(entry.date).toLocaleDateString(),
          'Type': entry.amount >= 0 ? 'Income' : 'Expense',
          'Amount': Math.abs(entry.amount),
          'Currency': entry.currency || book.currency,
          'Category': categoryName,
          'Party': entry.party || '',
          'Payment Mode': entry.paymentMode,
          'Remarks': entry.remarks || '',
        };
      });

      // Add book summary at the top
      const totalIncome = entries.filter(e => e.amount >= 0).reduce((sum, e) => sum + e.amount, 0);
      const totalExpense = entries.filter(e => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0);
      const netBalance = totalIncome - totalExpense;

      const bookData = [
        ['Book Name', book.name],
        ['Description', book.description || ''],
        ['Currency', book.currency],
        ['Total Entries', entries.length],
        ['Total Income', totalIncome.toFixed(2)],
        ['Total Expense', totalExpense.toFixed(2)],
        ['Net Balance', netBalance.toFixed(2)],
        [],
        // Add entries header
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(bookData);
      
      // Append entries data if there are any
      if (entriesData.length > 0) {
        XLSX.utils.sheet_add_json(worksheet, entriesData, { origin: -1, skipHeader: false });
      } else {
        XLSX.utils.sheet_add_aoa(worksheet, [['No entries in this book']], { origin: -1 });
      }

      // Use a safe sheet name (max 31 chars, no special chars)
      const safeSheetName = book.name.substring(0, 28).replace(/[:\\/?*\[\]]/g, '_');
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
    }

    // Add Categories sheet if requested
    if (exportOptions.includeCategories && allCategories.length > 0) {
      const categoriesData = allCategories
        .filter(cat => !cat.deleted)
        .map(cat => ({
          'Category Name': cat.name,
          'Description': cat.description || '',
          'Color': cat.color || '',
          'Icon': cat.icon || '',
        }));
      
      const categoriesSheet = XLSX.utils.json_to_sheet(categoriesData);
      XLSX.utils.book_append_sheet(workbook, categoriesSheet, 'Categories');
    }

    return workbook;
  };

  const exportData = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to export data');
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress(0);

      let totalSteps = 3; // Load books, load categories, generate file
      let currentStep = 0;

      const updateProgress = () => {
        currentStep++;
        setExportProgress(currentStep / totalSteps);
      };

      // Load books
      console.log('Loading books...');
      const books = await asyncStorageService.getBooks(user.id);
      const activeBooks = books.filter(book => !book.deleted);
      updateProgress();

      // Load categories
      console.log('Loading categories...');
      const categories = await asyncStorageService.getCategories(user.id);
      updateProgress();

      const dateFilter = getDateRangeFilter();

      if (exportOptions.format === 'EXCEL') {
        // Generate Excel workbook
        console.log('Generating Excel workbook...');
        const workbook = await generateExcelWorkbook(activeBooks, categories, dateFilter);
        updateProgress();

        // Write to file using new expo-file-system API
        const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
        const fileName = `ExpenseTracker_${new Date().toISOString().split('T')[0]}.xlsx`;
        const file = new File(Paths.document, fileName);

        // Write the base64 content
        await file.write(wbout, { encoding: 'base64' });

        // Share the file
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Export Expense Data',
            UTI: 'com.microsoft.excel.xlsx',
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }

        Alert.alert('Success', 'Excel file exported successfully!');
      } else if (exportOptions.format === 'JSON') {
        // JSON export (original logic)
        const exportData: any = {
          exportInfo: {
            date: new Date().toISOString(),
            user: user.id,
            dateRange: exportOptions.dateRange,
            appVersion: '1.0.0'
          },
          books: activeBooks,
          categories: categories,
        };

        const exportContent = JSON.stringify(exportData, null, 2);
        await Share.share({
          message: exportContent,
          title: 'Expense App Data Export (JSON)',
        });
        updateProgress();

        Alert.alert('Success', 'Data exported successfully as JSON');
      } else {
        // CSV export
        const csvFiles: string[] = [];
        
        if (activeBooks.length > 0) {
          const booksCSV = generateCSV(activeBooks.map((book: Book) => ({
            name: book.name,
            description: book.description || '',
            currency: book.currency,
            created: book.createdAt.toISOString().split('T')[0],
          })));
          csvFiles.push(`--- BOOKS ---\n${booksCSV}`);
        }

        const exportContent = csvFiles.join('\n\n');
        await Share.share({
          message: exportContent,
          title: 'Expense App Data Export (CSV)',
        });
        updateProgress();

        Alert.alert('Success', 'Data exported successfully as CSV');
      }

    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', `Failed to export data: ${error}`);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const getDataSummary = () => {
    const items = [];
    if (exportOptions.includeBooks) items.push('Books');
    if (exportOptions.includeEntries) items.push('Entries');
    if (exportOptions.includeCategories) items.push('Categories');
    if (exportOptions.includePreferences) items.push('Preferences');
    return items.length > 0 ? items.join(', ') : 'Nothing selected';
  };

  const getDateRangeLabel = () => {
    const labels = {
      all: 'All time',
      last_month: 'Last month',
      last_3_months: 'Last 3 months',
      last_year: 'Last year'
    };
    return labels[exportOptions.dateRange];
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView}>
        {/* Export Format */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Export Format</Title>
            <List.Item
              title="Format"
              description={exportOptions.format}
              left={(props) => <List.Icon {...props} icon="file-export" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => setShowFormatDialog(true)}
            />
          </Card.Content>
        </Card>

        {/* Data Selection */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>What to Export</Title>
            <List.Item
              title="Books"
              description="Export all your expense books"
              left={(props) => <List.Icon {...props} icon="book" />}
              right={() => (
                <Checkbox
                  status={exportOptions.includeBooks ? 'checked' : 'unchecked'}
                  onPress={() => updateOption('includeBooks', !exportOptions.includeBooks)}
                />
              )}
            />
            <Divider />
            <List.Item
              title="Entries"
              description="Export all transactions and expenses"
              left={(props) => <List.Icon {...props} icon="receipt" />}
              right={() => (
                <Checkbox
                  status={exportOptions.includeEntries ? 'checked' : 'unchecked'}
                  onPress={() => updateOption('includeEntries', !exportOptions.includeEntries)}
                />
              )}
            />
            <Divider />
            <List.Item
              title="Categories"
              description="Export your custom categories"
              left={(props) => <List.Icon {...props} icon="tag-multiple" />}
              right={() => (
                <Checkbox
                  status={exportOptions.includeCategories ? 'checked' : 'unchecked'}
                  onPress={() => updateOption('includeCategories', !exportOptions.includeCategories)}
                />
              )}
            />
            <Divider />
            <List.Item
              title="App Preferences"
              description="Export your app settings and preferences"
              left={(props) => <List.Icon {...props} icon="tune" />}
              right={() => (
                <Checkbox
                  status={exportOptions.includePreferences ? 'checked' : 'unchecked'}
                  onPress={() => updateOption('includePreferences', !exportOptions.includePreferences)}
                />
              )}
            />
          </Card.Content>
        </Card>

        {/* Date Range (only shown if entries are selected) */}
        {exportOptions.includeEntries && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={{ color: theme.colors.onSurface }}>Date Range</Title>
              <List.Item
                title="Time Period"
                description={getDateRangeLabel()}
                left={(props) => <List.Icon {...props} icon="calendar-range" />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => setShowDateRangeDialog(true)}
              />
            </Card.Content>
          </Card>
        )}

        {/* Export Preview */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Export Summary</Title>
            <Surface style={[styles.previewCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
              <View style={styles.previewHeader}>
                <MaterialIcons 
                  name={exportOptions.format === 'JSON' ? 'code' : 'table-chart'} 
                  size={24} 
                  color={theme.colors.primary} 
                />
                <Text variant="titleMedium" style={[styles.previewTitle, { color: theme.colors.onSurface }]}>
                  {exportOptions.format} Export
                </Text>
              </View>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Data: {getDataSummary()}
              </Text>
              {exportOptions.includeEntries && (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Period: {getDateRangeLabel()}
                </Text>
              )}
            </Surface>
          </Card.Content>
        </Card>

        {/* Export Progress */}
        {isExporting && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.progressContainer}>
                <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                  Exporting Data...
                </Text>
                <ProgressBar progress={exportProgress} style={styles.progressBar} />
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {Math.round(exportProgress * 100)}% complete
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Export Button */}
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={exportData}
            disabled={isExporting || (!exportOptions.includeBooks && !exportOptions.includeEntries && !exportOptions.includeCategories && !exportOptions.includePreferences)}
            style={styles.exportButton}
            icon="export"
          >
            {isExporting ? 'Exporting...' : 'Export Data'}
          </Button>
        </View>
      </ScrollView>

      {/* Dialogs */}
      <Portal>
        {/* Format Selection Dialog */}
        <Dialog visible={showFormatDialog} onDismiss={() => setShowFormatDialog(false)}>
          <Dialog.Title>Select Export Format</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              onValueChange={(value) => {
                updateOption('format', value as 'JSON' | 'CSV' | 'EXCEL');
                setShowFormatDialog(false);
              }}
              value={exportOptions.format}
            >
              <RadioButton.Item
                label="Excel (.xlsx) - Multiple sheets per book (Recommended)"
                value="EXCEL"
                style={styles.radioItem}
              />
              <RadioButton.Item
                label="JSON - Complete structured data"
                value="JSON"
                style={styles.radioItem}
              />
              <RadioButton.Item
                label="CSV - Simple text format"
                value="CSV"
                style={styles.radioItem}
              />
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowFormatDialog(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Date Range Selection Dialog */}
        <Dialog visible={showDateRangeDialog} onDismiss={() => setShowDateRangeDialog(false)}>
          <Dialog.Title>Select Date Range</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              onValueChange={(value) => {
                updateOption('dateRange', value as any);
                setShowDateRangeDialog(false);
              }}
              value={exportOptions.dateRange}
            >
              <RadioButton.Item
                label="All time"
                value="all"
                style={styles.radioItem}
              />
              <RadioButton.Item
                label="Last month"
                value="last_month"
                style={styles.radioItem}
              />
              <RadioButton.Item
                label="Last 3 months"
                value="last_3_months"
                style={styles.radioItem}
              />
              <RadioButton.Item
                label="Last year"
                value="last_year"
                style={styles.radioItem}
              />
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDateRangeDialog(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  radioItem: {
    paddingVertical: 8,
  },
  previewCard: {
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewTitle: {
    marginLeft: 8,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    marginVertical: 12,
  },
  buttonContainer: {
    marginTop: 16,
    marginBottom: 32,
  },
  exportButton: {
    paddingVertical: 8,
  },
});

export default DataExportScreen;