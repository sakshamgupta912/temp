// Data Export screen - export user data in various formats
import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Share
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

import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../navigation/Navigation';
import asyncStorageService from '../services/asyncStorage';
import preferencesService from '../services/preferences';

type DataExportNavigationProp = StackNavigationProp<RootStackParamList>;

interface ExportOptions {
  format: 'JSON' | 'CSV';
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
    format: 'JSON',
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

  const exportData = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to export data');
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress(0);

      const exportData: any = {
        exportInfo: {
          date: new Date().toISOString(),
          user: user.id,
          format: exportOptions.format,
          dateRange: exportOptions.dateRange,
          appVersion: '1.0.0'
        }
      };

      let totalSteps = 0;
      let currentStep = 0;

      // Count steps
      if (exportOptions.includeBooks) totalSteps++;
      if (exportOptions.includeEntries) totalSteps++;
      if (exportOptions.includeCategories) totalSteps++;
      if (exportOptions.includePreferences) totalSteps++;

      const updateProgress = () => {
        currentStep++;
        setExportProgress(currentStep / totalSteps);
      };

      // Export Books
      if (exportOptions.includeBooks) {
        console.log('Exporting books...');
        const books = await asyncStorageService.getBooks(user.id);
        exportData.books = books;
        updateProgress();
      }

      // Export Entries
      if (exportOptions.includeEntries) {
        console.log('Exporting entries...');
        const books = await asyncStorageService.getBooks(user.id);
        const allEntries = [];
        
        for (const book of books) {
          const entries = await asyncStorageService.getEntries(book.id);
          allEntries.push(...entries);
        }

        // Filter by date range if specified
        const dateFilter = getDateRangeFilter();
        let filteredEntries = allEntries;
        
        if (dateFilter) {
          filteredEntries = allEntries.filter(entry => entry.date >= dateFilter);
        }

        exportData.entries = filteredEntries;
        updateProgress();
      }

      // Export Categories
      if (exportOptions.includeCategories) {
        console.log('Exporting categories...');
        const categories = await asyncStorageService.getCategories(user.id);
        exportData.categories = categories;
        updateProgress();
      }

      // Export Preferences
      if (exportOptions.includePreferences) {
        console.log('Exporting preferences...');
        const preferences = await preferencesService.getPreferences();
        exportData.preferences = preferences;
        updateProgress();
      }

      // Generate output based on format
      let exportContent: string;
      let fileName: string;
      let mimeType: string;

      if (exportOptions.format === 'JSON') {
        exportContent = JSON.stringify(exportData, null, 2);
        fileName = `expense_data_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      } else {
        // CSV format - create separate files for each data type
        const csvFiles: string[] = [];
        
        if (exportData.books?.length > 0) {
          const booksCSV = generateCSV(exportData.books.map((book: any) => ({
            id: book.id,
            name: book.name,
            description: book.description || '',
            created: book.createdAt.toISOString(),
            updated: book.updatedAt.toISOString()
          })));
          csvFiles.push(`--- BOOKS ---\n${booksCSV}`);
        }

        if (exportData.entries?.length > 0) {
          const entriesCSV = generateCSV(exportData.entries.map((entry: any) => ({
            id: entry.id,
            bookId: entry.bookId,
            amount: entry.amount,
            date: entry.date.toISOString().split('T')[0],
            party: entry.party || '',
            category: entry.category,
            paymentMode: entry.paymentMode,
            remarks: entry.remarks || '',
            created: entry.createdAt.toISOString()
          })));
          csvFiles.push(`--- ENTRIES ---\n${entriesCSV}`);
        }

        if (exportData.categories?.length > 0) {
          const categoriesCSV = generateCSV(exportData.categories.map((cat: any) => ({
            id: cat.id,
            name: cat.name,
            color: cat.color || '',
            icon: cat.icon || '',
            userId: cat.userId,
            created: cat.createdAt.toISOString()
          })));
          csvFiles.push(`--- CATEGORIES ---\n${categoriesCSV}`);
        }

        exportContent = csvFiles.join('\n\n');
        fileName = `expense_data_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      }

      // Share the export
      await Share.share({
        message: exportContent,
        title: `Expense App Data Export (${exportOptions.format})`,
      });

      Alert.alert('Success', `Data exported successfully as ${exportOptions.format}`);

    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export data. Please try again.');
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
                updateOption('format', value as 'JSON' | 'CSV');
                setShowFormatDialog(false);
              }}
              value={exportOptions.format}
            >
              <RadioButton.Item
                label="JSON - Complete structured data"
                value="JSON"
                style={styles.radioItem}
              />
              <RadioButton.Item
                label="CSV - Spreadsheet compatible format"
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