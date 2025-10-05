// Settings screen - app configuration and user preferences
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, Share, Linking } from 'react-native';
import { Card, Title, List, Button, Switch, useTheme, Text, Divider, Dialog, Portal } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../navigation/Navigation';
import asyncStorageService from '../services/asyncStorage';
import { dataCacheService } from '../services/dataCache';
import { CRUDTester } from '../components/CRUDTester';

type SettingsNavigationProp = StackNavigationProp<RootStackParamList>;

const SettingsScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation<SettingsNavigationProp>();
  const theme = useTheme();

  // Settings state
  const [notifications, setNotifications] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null);
  
  // App info
  const appVersion = '1.0.0';
  const buildNumber = '1';

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: logout
        }
      ]
    );
  };

  const handleClearCache = () => {
    setShowConfirmDialog('clearCache');
  };

  const handleClearData = () => {
    setShowConfirmDialog('clearData');
  };

  const confirmClearCache = async () => {
    try {
      dataCacheService.clearAll();
      setShowConfirmDialog(null);
      Alert.alert('Success', 'Cache cleared successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
      Alert.alert('Error', 'Failed to clear cache');
    }
  };

  const confirmClearData = async () => {
    try {
      if (!user) return;
      
      // Clear all user data
      const keys = [
        'books',
        'entries', 
        'categories'
      ];
      
      await Promise.all(keys.map(key => AsyncStorage.removeItem(key)));
      dataCacheService.clearAll();
      
      setShowConfirmDialog(null);
      Alert.alert(
        'Success', 
        'All data cleared successfully. The app will now restart with default data.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Reinitialize with defaults
              asyncStorageService.initializeDatabase();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error clearing data:', error);
      Alert.alert('Error', 'Failed to clear data');
    }
  };



  const handleCreateDefaultCategories = async () => {
    try {
      if (!user) return;
      
      await asyncStorageService.createDefaultCategories(user.id);
      Alert.alert('Success', 'Default categories created successfully');
    } catch (error) {
      console.error('Error creating default categories:', error);
      Alert.alert('Error', 'Failed to create default categories');
    }
  };

  const handleOpenGitHub = () => {
    Linking.openURL('https://github.com');
  };

  const handleSendFeedback = () => {
    Linking.openURL('mailto:feedback@example.com?subject=Expense App Feedback');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView}>
        {/* Account Section */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Account</Title>
            <List.Item
              title={user?.displayName || 'Demo User'}
              description={user?.email || 'demo@example.com'}
              left={(props) => <List.Icon {...props} icon="account" />}
            />
          </Card.Content>
        </Card>

        {/* App Settings */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Categories & Data</Title>
            <List.Item
              title="Manage Categories"
              description="Create, edit, and delete custom categories"
              left={(props) => <List.Icon {...props} icon="tag-multiple" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('CategoryManagement')}
            />
            <Divider />
            <List.Item
              title="Create Default Categories"
              description="Add standard income and expense categories"
              left={(props) => <List.Icon {...props} icon="plus-circle" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={handleCreateDefaultCategories}
            />
            <Divider />
            <List.Item
              title="Export Data"
              description="Export data as CSV or JSON with options"
              left={(props) => <List.Icon {...props} icon="export" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('DataExport')}
            />
          </Card.Content>
        </Card>

        {/* App Preferences */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Preferences</Title>
            <List.Item
              title="App Preferences"
              description="Currency, date format, defaults, and more"
              left={(props) => <List.Icon {...props} icon="tune" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('Preferences')}
            />
            <Divider />
            <List.Item
              title="Notifications"
              description="Enable expense reminders and alerts"
              left={(props) => <List.Icon {...props} icon="bell" />}
              right={() => (
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                />
              )}
            />
            <Divider />
            <List.Item
              title="Biometric Security"
              description="Use fingerprint or face ID"
              left={(props) => <List.Icon {...props} icon="fingerprint" />}
              right={() => (
                <Switch
                  value={biometric}
                  onValueChange={setBiometric}
                />
              )}
            />
            <Divider />
            <List.Item
              title="Dark Mode"
              description="Use dark theme (coming soon)"
              left={(props) => <List.Icon {...props} icon="brightness-6" />}
              right={() => (
                <Switch
                  value={darkMode}
                  onValueChange={setDarkMode}
                  disabled={true}
                />
              )}
            />
          </Card.Content>
        </Card>

        {/* Data Management */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Data Management</Title>
            <List.Item
              title="Clear Cache"
              description="Clear app cache to free up space"
              left={(props) => <List.Icon {...props} icon="broom" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={handleClearCache}
            />
            <Divider />
            <List.Item
              title="Reset All Data"
              description="Delete all books, entries, and categories"
              left={(props) => <List.Icon {...props} icon="delete-forever" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={handleClearData}
              titleStyle={{ color: theme.colors.error }}
              descriptionStyle={{ color: theme.colors.error }}
            />
          </Card.Content>
        </Card>

        {/* Support & Info */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Support & Info</Title>
            <List.Item
              title="About"
              description="App info, features, and developer details"
              left={(props) => <List.Icon {...props} icon="information" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('About')}
            />
            <Divider />
            <List.Item
              title="Send Feedback"
              description="Help us improve the app"
              left={(props) => <List.Icon {...props} icon="email" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={handleSendFeedback}
            />
            <Divider />
            <List.Item
              title="Debug Storage"
              description="View AsyncStorage data for debugging"
              left={(props) => <List.Icon {...props} icon="bug" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('Debug')}
            />
            <Divider />
            <List.Item
              title="Source Code"
              description="View on GitHub"
              left={(props) => <List.Icon {...props} icon="github" />}
              right={(props) => <List.Icon {...props} icon="open-in-new" />}
              onPress={handleOpenGitHub}
            />
            <Divider />
            <List.Item
              title="App Version"
              description={`Version ${appVersion} (${buildNumber})`}
              left={(props) => <List.Icon {...props} icon="information" />}
            />
          </Card.Content>
        </Card>

        {/* Debug Section - CRUD Tester */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Debug & Testing</Title>
            <CRUDTester />
          </Card.Content>
        </Card>

        {/* Logout */}
        <View style={styles.logoutContainer}>
          <Button
            mode="outlined"
            onPress={handleLogout}
            style={[styles.logoutButton, { borderColor: theme.colors.error }]}
            textColor={theme.colors.error}
            icon="logout"
          >
            Logout
          </Button>
        </View>
      </ScrollView>

      {/* Confirmation Dialogs */}
      <Portal>
        <Dialog 
          visible={showConfirmDialog === 'clearCache'} 
          onDismiss={() => setShowConfirmDialog(null)}
        >
          <Dialog.Title>Clear Cache</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Are you sure you want to clear the app cache? This will not delete your data but may temporarily slow down the app.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowConfirmDialog(null)}>Cancel</Button>
            <Button onPress={confirmClearCache} textColor={theme.colors.error}>
              Clear Cache
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog 
          visible={showConfirmDialog === 'clearData'} 
          onDismiss={() => setShowConfirmDialog(null)}
        >
          <Dialog.Title>Reset All Data</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
              ⚠️ Warning: This will permanently delete ALL your books, entries, and custom categories. This action cannot be undone.
            </Text>
            <Text variant="bodySmall" style={{ marginTop: 8 }}>
              Make sure to export your data first if you want to keep a backup.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowConfirmDialog(null)}>Cancel</Button>
            <Button 
              onPress={confirmClearData} 
              textColor={theme.colors.error}
              mode="contained"
              buttonColor={theme.colors.error}
            >
              Delete All Data
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  logoutContainer: {
    marginTop: 20,
    marginBottom: 40,
  },
  logoutButton: {
    borderColor: '#F44336',
  },
});

export default SettingsScreen;