// Debug helper to show entry IDs and user information
import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Text, Button, Title } from 'react-native-paper';
import asyncStorageService from '../services/asyncStorage';
import { useAuth } from '../contexts/AuthContext';

export const EntryDebugger: React.FC = () => {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<string>('');

  const getDiagnosticInfo = async () => {
    if (!user) {
      setDebugInfo('No user logged in');
      return;
    }

    try {
      let info = `Current User: ${user.id} (${user.email})\n\n`;
      
      // Get all books for user
      const books = await asyncStorageService.getBooks(user.id);
      info += `Books for user: ${books.length}\n`;
      
      for (const book of books) {
        info += `\nBook: ${book.name} (${book.id})\n`;
        
        const entries = await asyncStorageService.getEntries(book.id);
        info += `  Entries: ${entries.length}\n`;
        
        entries.forEach((entry, index) => {
          info += `    ${index + 1}. ID: ${entry.id}\n`;
          info += `       Amount: ${entry.amount}\n`;
          info += `       Category: ${entry.category}\n`;
          info += `       User: ${entry.userId}\n`;
          info += `       Date: ${entry.date.toDateString()}\n`;
        });
      }
      
      setDebugInfo(info);
    } catch (error) {
      setDebugInfo(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  useEffect(() => {
    if (user) {
      getDiagnosticInfo();
    }
  }, [user]);

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Title>Entry Debug Info</Title>
        <Button mode="outlined" onPress={getDiagnosticInfo} style={styles.button}>
          Refresh Debug Info
        </Button>
        <ScrollView style={styles.scrollView}>
          <Text style={styles.debugText}>{debugInfo}</Text>
        </ScrollView>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 16,
    maxHeight: 400,
  },
  button: {
    marginBottom: 16,
  },
  scrollView: {
    maxHeight: 300,
  },
  debugText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 16,
  },
});