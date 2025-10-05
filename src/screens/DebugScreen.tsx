// Debug Screen - View AsyncStorage data
import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import { 
  Card, 
  Title, 
  Text, 
  Button, 
  Surface,
  useTheme,
  Divider
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import asyncStorageService from '../services/asyncStorage';
import preferencesService from '../services/preferences';
import { spacing } from '../theme/materialTheme';

const DebugScreen: React.FC = () => {
  const [storageData, setStorageData] = useState<{[key: string]: any}>({});
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const theme = useTheme();

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      // Get all AsyncStorage keys
      const keys = await AsyncStorage.getAllKeys();
      const allData: {[key: string]: any} = {};
      
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        try {
          allData[key] = value ? JSON.parse(value) : null;
        } catch (parseError) {
          allData[key] = value; // Store as string if not JSON
        }
      }
      
      setStorageData(allData);
      console.log('Debug: All AsyncStorage data:', allData);
    } catch (error) {
      console.error('Error loading storage data:', error);
      Alert.alert('Error', 'Failed to load storage data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserSpecificData = async () => {
    if (!user) {
      Alert.alert('Error', 'No user logged in');
      return;
    }
    
    setIsLoading(true);
    try {
      const userData: {[key: string]: any} = {};
      
      // Load user data
      userData.user = user;
      
      // Load preferences
      userData.preferences = await preferencesService.getPreferences();
      
      // Load books
      userData.books = await asyncStorageService.getBooks(user.id);
      
      // Load entries for each book  
      userData.entries = {};
      for (const book of userData.books) {
        userData.entries[book.id] = await asyncStorageService.getEntries(book.id);
      }
      
      // Load categories
      userData.categories = await asyncStorageService.getCategories(user.id);
      
      setStorageData(userData);
      console.log('Debug: User-specific data:', userData);
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user data');
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllData = async () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all app data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              setStorageData({});
              Alert.alert('Success', 'All data cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data');
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    loadUserSpecificData();
  }, [user]);

  const renderValue = (value: any, depth = 0) => {
    if (depth > 3) return <Text>... (too deep)</Text>;
    
    if (value === null || value === undefined) {
      return <Text style={styles.nullValue}>null</Text>;
    }
    
    if (typeof value === 'object') {
      return (
        <Surface style={[styles.objectContainer, { marginLeft: depth * 10 }]} elevation={1}>
          {Object.entries(value).map(([key, val]) => (
            <React.Fragment key={key}>
              <Text style={styles.keyText}>{key}:</Text>
              {renderValue(val, depth + 1)}
              <Divider style={styles.divider} />
            </React.Fragment>
          ))}
        </Surface>
      );
    }
    
    return (
      <Text style={styles.valueText} selectable>
        {typeof value === 'string' ? `"${value}"` : String(value)}
      </Text>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={[styles.header, { backgroundColor: theme.colors.primary }]} elevation={2}>
        <Title style={[styles.headerTitle, { color: theme.colors.onPrimary }]}>
          Debug Storage
        </Title>
      </Surface>
      
      <Card style={styles.card}>
        <Card.Content>
          <Title>Storage Actions</Title>
          <Button 
            mode="contained" 
            onPress={loadAllData} 
            loading={isLoading}
            style={styles.button}
          >
            Load All AsyncStorage Data
          </Button>
          <Button 
            mode="contained" 
            onPress={loadUserSpecificData} 
            loading={isLoading}
            style={styles.button}
          >
            Load User Data Only
          </Button>
          <Button 
            mode="outlined" 
            onPress={clearAllData}
            style={styles.button}
          >
            Clear All Data
          </Button>
        </Card.Content>
      </Card>

      {Object.keys(storageData).length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Title>Storage Data ({Object.keys(storageData).length} items)</Title>
            {Object.entries(storageData).map(([key, value]) => (
              <Surface key={key} style={styles.dataItem} elevation={1}>
                <Text style={styles.keyTitle}>{key}</Text>
                {renderValue(value)}
              </Surface>
            ))}
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  card: {
    margin: spacing.md,
  },
  button: {
    marginVertical: spacing.xs,
  },
  dataItem: {
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: 8,
  },
  keyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
    color: '#2196F3',
  },
  keyText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.xs,
    color: '#4CAF50',
  },
  valueText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginLeft: spacing.sm,
    color: '#333',
  },
  nullValue: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#999',
  },
  objectContainer: {
    padding: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: 4,
  },
  divider: {
    marginVertical: spacing.xs,
  },
});

export default DebugScreen;