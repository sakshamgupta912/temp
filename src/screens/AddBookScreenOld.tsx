// Add Book screen - form to create new expense books
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { TextInput, Button, Card, Title } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { useAuth } from '../contexts/AuthContext';
import asyncStorageService from '../services/asyncStorage';
import { RootStackParamList } from '../navigation/Navigation';

type AddBookNavigationProp = StackNavigationProp<RootStackParamList, 'AddBook'>;

const AddBookScreen: React.FC = () => {
  const navigation = useNavigation<AddBookNavigationProp>();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateBook = async () => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a book name');
      return;
    }

    setIsLoading(true);
    try {
      const book = await asyncStorageService.createBook({
        name: name.trim(),
        description: description.trim(),
        userId: user.id
      });

      console.log('Book created:', book);
      Alert.alert(
        'Success',
        'Book created successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      console.error('Error creating book:', error);
      Alert.alert('Error', 'Failed to create book. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (name || description) {
      Alert.alert(
        'Discard Changes',
        'Are you sure you want to discard your changes?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.title}>Create New Book</Title>
            
            <TextInput
              label="Book Name *"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., Personal Expenses, Business, Vacation"
              maxLength={50}
              autoFocus
            />
            
            <TextInput
              label="Description (Optional)"
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              style={styles.input}
              placeholder="Brief description of this book"
              maxLength={200}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.buttonContainer}>
              <Button
                mode="outlined"
                onPress={handleCancel}
                style={styles.cancelButton}
                disabled={isLoading}
              >
                Cancel
              </Button>
              
              <Button
                mode="contained"
                onPress={handleCreateBook}
                style={styles.createButton}
                loading={isLoading}
                disabled={isLoading || !name.trim()}
              >
                Create Book
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.tipsCard}>
          <Card.Content>
            <Title style={styles.tipsTitle}>💡 Tips</Title>
            <View style={styles.tipsList}>
              <View style={styles.tipItem}>
                <View style={styles.tipBullet} />
                <View style={styles.tipText}>
                  <TextInput.Icon icon="book" />
                  <Title style={styles.tipItemTitle}>Organize by Purpose</Title>
                  <TextInput.Affix text="Create separate books for different purposes like 'Personal', 'Business', or 'Travel'" />
                </View>
              </View>
              
              <View style={styles.tipItem}>
                <View style={styles.tipBullet} />
                <View style={styles.tipText}>
                  <TextInput.Icon icon="tag" />
                  <Title style={styles.tipItemTitle}>Use Clear Names</Title>
                  <TextInput.Affix text="Choose descriptive names that make it easy to identify the book's purpose" />
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 4,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#2196F3',
  },
  input: {
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
  },
  createButton: {
    flex: 1,
    marginLeft: 8,
  },
  tipsCard: {
    elevation: 2,
  },
  tipsTitle: {
    fontSize: 16,
    marginBottom: 12,
    color: '#666',
  },
  tipsList: {
    paddingLeft: 8,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2196F3',
    marginTop: 6,
    marginRight: 12,
  },
  tipText: {
    flex: 1,
  },
  tipItemTitle: {
    fontSize: 14,
    marginBottom: 4,
    color: '#333',
  },
});

export default AddBookScreen;