// CRUD Operations Tester - Component to test all CRUD operations
import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { 
  Button, 
  Text, 
  Card, 
  Title, 
  Paragraph,
  ActivityIndicator,
  Divider
} from 'react-native-paper';
import asyncStorageService from '../services/asyncStorage';
import { useAuth } from '../contexts/AuthContext';
import { Book, Entry, Category, PaymentMode } from '../models/types';

interface TestResult {
  operation: string;
  success: boolean;
  message: string;
  data?: any;
}

export const CRUDTester: React.FC = () => {
  const { user } = useAuth();
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testBook, setTestBook] = useState<Book | null>(null);

  const addResult = (result: TestResult) => {
    setResults(prev => [...prev, result]);
    console.log('Test Result:', result);
  };

  const clearResults = () => {
    setResults([]);
  };

  const testBookOperations = async () => {
    if (!user) {
      addResult({ operation: 'Book Test', success: false, message: 'No user logged in' });
      return;
    }

    try {
      // Test Create Book
      console.log('Testing book creation...');
      const bookData = {
        name: `Test Book ${Date.now()}`,
        description: 'This is a test book for CRUD testing',
        userId: user.id
      };

      const createdBook = await asyncStorageService.createBook(bookData);
      setTestBook(createdBook);
      addResult({ 
        operation: 'Create Book', 
        success: true, 
        message: `Book "${createdBook.name}" created successfully`,
        data: createdBook
      });

      // Test Read Books
      console.log('Testing book reading...');
      const books = await asyncStorageService.getBooks(user.id);
      const foundBook = books.find(book => book.id === createdBook.id);
      
      if (foundBook) {
        addResult({ 
          operation: 'Read Books', 
          success: true, 
          message: `Found ${books.length} books, including our test book`,
          data: { totalBooks: books.length }
        });
      } else {
        addResult({ 
          operation: 'Read Books', 
          success: false, 
          message: 'Created book not found in books list'
        });
      }

      // Test Update Book
      console.log('Testing book update...');
      const updatedName = `Updated Test Book ${Date.now()}`;
      await asyncStorageService.updateBook(createdBook.id, { name: updatedName });
      
      const updatedBooks = await asyncStorageService.getBooks(user.id);
      const updatedBook = updatedBooks.find(book => book.id === createdBook.id);
      
      if (updatedBook && updatedBook.name === updatedName) {
        addResult({ 
          operation: 'Update Book', 
          success: true, 
          message: `Book updated successfully to "${updatedName}"`
        });
      } else {
        addResult({ 
          operation: 'Update Book', 
          success: false, 
          message: 'Book update failed or not reflected'
        });
      }

    } catch (error) {
      addResult({ 
        operation: 'Book Operations', 
        success: false, 
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  const testEntryOperations = async () => {
    if (!user || !testBook) {
      addResult({ operation: 'Entry Test', success: false, message: 'No user or test book available' });
      return;
    }

    try {
      // Test Create Entry
      console.log('Testing entry creation...');
      const entryData = {
        bookId: testBook.id,
        amount: -25.50, // Expense
        date: new Date(),
        category: 'Food & Dining',
        paymentMode: PaymentMode.CASH,
        party: 'Test Restaurant',
        remarks: 'Test entry for CRUD testing',
        userId: user.id
      };

      const createdEntry = await asyncStorageService.createEntry(entryData);
      addResult({ 
        operation: 'Create Entry', 
        success: true, 
        message: `Entry created successfully with amount ${entryData.amount}`,
        data: createdEntry
      });

      // Test Read Entries
      console.log('Testing entry reading...');
      const entries = await asyncStorageService.getEntries(testBook.id);
      const foundEntry = entries.find(entry => entry.id === createdEntry.id);
      
      if (foundEntry) {
        addResult({ 
          operation: 'Read Entries', 
          success: true, 
          message: `Found ${entries.length} entries for book, including our test entry`,
          data: { totalEntries: entries.length }
        });
      } else {
        addResult({ 
          operation: 'Read Entries', 
          success: false, 
          message: 'Created entry not found in entries list'
        });
      }

      // Test Update Entry
      console.log('Testing entry update...');
      const updatedAmount = -30.75;
      await asyncStorageService.updateEntry(createdEntry.id, { amount: updatedAmount });
      
      const updatedEntries = await asyncStorageService.getEntries(testBook.id);
      const updatedEntry = updatedEntries.find(entry => entry.id === createdEntry.id);
      
      if (updatedEntry && updatedEntry.amount === updatedAmount) {
        addResult({ 
          operation: 'Update Entry', 
          success: true, 
          message: `Entry updated successfully to amount ${updatedAmount}`
        });
      } else {
        addResult({ 
          operation: 'Update Entry', 
          success: false, 
          message: 'Entry update failed or not reflected'
        });
      }

      // Test Delete Entry
      console.log('Testing entry deletion...');
      await asyncStorageService.deleteEntry(createdEntry.id);
      
      const entriesAfterDelete = await asyncStorageService.getEntries(testBook.id);
      const deletedEntry = entriesAfterDelete.find(entry => entry.id === createdEntry.id);
      
      if (!deletedEntry) {
        addResult({ 
          operation: 'Delete Entry', 
          success: true, 
          message: 'Entry deleted successfully'
        });
      } else {
        addResult({ 
          operation: 'Delete Entry', 
          success: false, 
          message: 'Entry deletion failed - entry still exists'
        });
      }

    } catch (error) {
      addResult({ 
        operation: 'Entry Operations', 
        success: false, 
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  const testCategoryOperations = async () => {
    if (!user) {
      addResult({ operation: 'Category Test', success: false, message: 'No user logged in' });
      return;
    }

    try {
      // Test Read Categories
      console.log('Testing category reading...');
      const categories = await asyncStorageService.getCategories(user.id);
      
      if (categories.length > 0) {
        addResult({ 
          operation: 'Read Categories', 
          success: true, 
          message: `Found ${categories.length} categories`,
          data: { totalCategories: categories.length, categories: categories.map(c => c.name) }
        });
      } else {
        addResult({ 
          operation: 'Read Categories', 
          success: false, 
          message: 'No categories found - this might be a problem'
        });
      }

    } catch (error) {
      addResult({ 
        operation: 'Category Operations', 
        success: false, 
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    clearResults();
    
    addResult({ operation: 'Test Start', success: true, message: 'Starting comprehensive CRUD tests...' });
    
    // Initialize database
    try {
      await asyncStorageService.initializeDatabase();
      addResult({ operation: 'Database Init', success: true, message: 'Database initialized successfully' });
    } catch (error) {
      addResult({ operation: 'Database Init', success: false, message: `Database init failed: ${error}` });
    }

    // Run tests in sequence
    await testCategoryOperations();
    await testBookOperations();
    if (testBook) {
      await testEntryOperations();
    }
    
    // Clean up
    if (testBook) {
      try {
        await asyncStorageService.deleteBook(testBook.id);
        addResult({ operation: 'Cleanup', success: true, message: 'Test book deleted successfully' });
      } catch (error) {
        addResult({ operation: 'Cleanup', success: false, message: `Cleanup failed: ${error}` });
      }
    }
    
    addResult({ operation: 'Test Complete', success: true, message: 'All CRUD tests completed!' });
    setIsRunning(false);
  };

  const getResultColor = (success: boolean) => {
    return success ? '#4CAF50' : '#F44336';
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>CRUD Operations Tester</Title>
          <Paragraph>
            Test all Create, Read, Update, Delete operations for Books, Entries, and Categories
          </Paragraph>
          <Divider style={styles.divider} />
          
          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={runAllTests}
              disabled={isRunning || !user}
              loading={isRunning}
              style={styles.button}
            >
              {isRunning ? 'Running Tests...' : 'Run All CRUD Tests'}
            </Button>
            
            <Button
              mode="outlined"
              onPress={clearResults}
              disabled={isRunning}
              style={styles.button}
            >
              Clear Results
            </Button>
          </View>

          {!user && (
            <Text style={styles.warningText}>
              Please log in to run CRUD tests
            </Text>
          )}
        </Card.Content>
      </Card>

      {results.map((result, index) => (
        <Card key={index} style={[styles.resultCard, { borderLeftColor: getResultColor(result.success) }]}>
          <Card.Content>
            <View style={styles.resultHeader}>
              <Text style={[styles.operationText, { color: getResultColor(result.success) }]}>
                {result.operation}
              </Text>
              <Text style={[styles.statusText, { color: getResultColor(result.success) }]}>
                {result.success ? '✓ SUCCESS' : '✗ FAILED'}
              </Text>
            </View>
            <Paragraph style={styles.messageText}>{result.message}</Paragraph>
            {result.data && (
              <Text style={styles.dataText}>
                Data: {JSON.stringify(result.data, null, 2)}
              </Text>
            )}
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
  },
  warningText: {
    color: '#FF9800',
    marginTop: 16,
    textAlign: 'center',
  },
  resultCard: {
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  operationText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  messageText: {
    fontSize: 14,
  },
  dataText: {
    fontSize: 12,
    marginTop: 8,
    fontFamily: 'monospace',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
  },
});