// Settings screen - app configuration and user preferences
import React, { useState, useCallback, useEffect } from 'react';
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
import { SyncStatusBanner } from '../components/SyncStatusBanner';

type SettingsNavigationProp = StackNavigationProp<RootStackParamList>;

const SettingsScreen: React.FC = () => {
  const { user, signOut, enableSync, disableSync, syncNow, getSyncStatus, deleteAllFirebaseData } = useAuth();
  const navigation = useNavigation<SettingsNavigationProp>();
  const theme = useTheme();

  // Settings state
  const [notifications, setNotifications] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null);
  
  // Sync state
  const [syncStatus, setSyncStatus] = useState(getSyncStatus());
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  
  // Developer/Debug mode state
  const [developerMode, setDeveloperMode] = useState(false);
  
  // App info
  const appVersion = '1.0.0';
  const buildNumber = '1';

  // Load developer mode state from storage
  useEffect(() => {
    const loadDeveloperMode = async () => {
      try {
        const value = await AsyncStorage.getItem('developer_mode');
        if (value !== null) {
          setDeveloperMode(value === 'true');
        }
      } catch (error) {
        console.error('Error loading developer mode:', error);
      }
    };
    loadDeveloperMode();
  }, []);

  // Update sync status periodically
  useEffect(() => {
    const updateSyncStatus = () => {
      setSyncStatus(getSyncStatus());
    };

    // Initial update
    updateSyncStatus();

    // Update every 5 seconds
    const interval = setInterval(updateSyncStatus, 5000);

    return () => clearInterval(interval);
  }, [getSyncStatus]);

  const handleToggleDeveloperMode = async (value: boolean) => {
    try {
      setDeveloperMode(value);
      await AsyncStorage.setItem('developer_mode', value.toString());
      Alert.alert(
        value ? 'Developer Mode Enabled' : 'Developer Mode Disabled',
        value 
          ? 'Debug and testing options are now visible.' 
          : 'Debug and testing options are now hidden.'
      );
    } catch (error) {
      console.error('Error saving developer mode:', error);
    }
  };

  const handleLogout = () => {
    // Check if sync is enabled
    const isSyncEnabled = syncStatus.syncEnabled;
    
    Alert.alert(
      'Logout',
      isSyncEnabled 
        ? 'Your data is synced to the cloud. Do you want to keep local data on this device?'
        : '⚠️ Sync is disabled. Your local data may not be in the cloud. What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Keep Local Data', 
          onPress: () => signOut(false) // Don't clear data
        },
        { 
          text: 'Clear All Data', 
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Clear Data',
              isSyncEnabled
                ? 'This will remove all local data from this device. You can access it again by signing in (data is in the cloud).'
                : '⚠️ WARNING: This will permanently delete all local data. If sync was disabled, this data may not be in the cloud!',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear All Data',
                  style: 'destructive',
                  onPress: () => signOut(true) // Clear all data
                }
              ]
            );
          }
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
      // Clear cache properly with await
      await dataCacheService.clearAll();
      setShowConfirmDialog(null);
      Alert.alert('Success', 'Cache cleared successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
      Alert.alert('Error', 'Failed to clear cache');
    }
  };

  const confirmClearData = async () => {
    try {
      if (!user) {
        Alert.alert('Error', 'No user logged in');
        return;
      }
      
      setShowConfirmDialog(null);
      
      console.log('🚀 Starting data deletion process...');
      
      // Delete from Firebase first
      try {
        console.log('🗑️ Step 1: Deleting data from Firebase...');
        await deleteAllFirebaseData();
        console.log('✅ Firebase data deleted successfully');
      } catch (firebaseError) {
        console.error('❌ Error deleting Firebase data:', firebaseError);
        Alert.alert(
          'Firebase Deletion Failed', 
          `Failed to delete data from Firebase: ${firebaseError instanceof Error ? firebaseError.message : 'Unknown error'}\n\nDo you want to continue deleting local data?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Delete Local Only', 
              style: 'destructive',
              onPress: async () => {
                try {
                  await clearLocalData();
                  Alert.alert('Success', 'Local data cleared. Note: Firebase data may still exist.');
                } catch (localError) {
                  console.error('❌ Error deleting local data:', localError);
                  Alert.alert('Error', 'Failed to delete local data');
                }
              }
            }
          ]
        );
        return;
      }
      
      // Then clear local data
      try {
        console.log('🗑️ Step 2: Deleting local data...');
        await clearLocalData();
        console.log('✅ Local data deleted successfully');
      } catch (localError) {
        console.error('❌ Error deleting local data:', localError);
        Alert.alert('Error', 'Firebase data was deleted, but failed to clear local data. Try restarting the app.');
        return;
      }
      
      // Success!
      Alert.alert(
        'Success', 
        'All data has been permanently deleted from Firebase and your device. The app will now restart with default data.',
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
      console.error('❌ Unexpected error during data deletion:', error);
      Alert.alert('Error', `Failed to clear data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const clearLocalData = async () => {
    // Clear all local data
    await AsyncStorage.removeItem('budget_app_books');
    await AsyncStorage.removeItem('budget_app_entries');
    await AsyncStorage.removeItem('budget_app_categories');
    await AsyncStorage.removeItem('preferences');
    await dataCacheService.clearAll();
    console.log('✅ Local data cleared');
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

  const handleToggleSync = async () => {
    try {
      if (syncStatus.syncEnabled) {
        await disableSync();
      } else {
        await enableSync();
      }
      setSyncStatus(getSyncStatus());
    } catch (error) {
      console.error('Error toggling sync:', error);
      Alert.alert('Error', 'Failed to toggle sync');
    }
  };

  const handleManualSync = async () => {
    setIsSyncLoading(true);
    try {
      const result = await syncNow(true); // Manual sync
      setSyncStatus(getSyncStatus());
      
      if (result.success) {
        Alert.alert('Success', result.message);
      } else {
        Alert.alert('Sync Failed', result.message);
      }
    } catch (error) {
      console.error('Error during manual sync:', error);
      Alert.alert('Error', 'An unexpected error occurred during sync');
    } finally {
      setIsSyncLoading(false);
    }
  };

  const formatLastSyncTime = (lastSyncTime: Date | null) => {
    if (!lastSyncTime) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - lastSyncTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      const hours = Math.floor(diffHours);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      return lastSyncTime.toLocaleDateString();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Sync Status Banner */}
      <SyncStatusBanner />
      
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

        {/* Cloud Sync Section */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Cloud Sync</Title>
            
            {/* Sync Toggle */}
            <List.Item
              title="Cloud Sync"
              description={syncStatus.syncEnabled ? 'Data automatically synced to cloud' : 'Sync disabled - data stored locally only'}
              left={(props) => <List.Icon {...props} icon="cloud-sync" />}
              right={() => (
                <Switch
                  value={syncStatus.syncEnabled}
                  onValueChange={handleToggleSync}
                  disabled={isSyncLoading}
                />
              )}
            />
            
            <Divider />
            
            {/* Sync Status */}
            <List.Item
              title="Sync Status"
              description={
                syncStatus.isSyncing 
                  ? 'Syncing...' 
                  : syncStatus.error 
                    ? `Error: ${syncStatus.error}`
                    : `Last sync: ${formatLastSyncTime(syncStatus.lastSyncTime)}`
              }
              left={(props) => (
                <List.Icon 
                  {...props} 
                  icon={
                    syncStatus.isSyncing 
                      ? "sync" 
                      : syncStatus.error 
                        ? "alert-circle" 
                        : "check-circle"
                  } 
                />
              )}
            />
            
            <Divider />
            
            {/* Manual Sync Button */}
            <List.Item
              title="Sync Now"
              description="Manually sync your data to the cloud"
              left={(props) => <List.Icon {...props} icon="cloud-upload" />}
              right={() => (
                <Button
                  mode="outlined"
                  onPress={handleManualSync}
                  disabled={!syncStatus.syncEnabled || isSyncLoading || syncStatus.isSyncing}
                  loading={isSyncLoading || syncStatus.isSyncing}
                  compact
                  style={{ borderColor: theme.colors.primary }}
                >
                  {isSyncLoading || syncStatus.isSyncing ? 'Syncing...' : 'Sync'}
                </Button>
              )}
            />
          </Card.Content>
        </Card>

        {/* App Settings */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>AI & Categories</Title>
            <List.Item
              title="AI Settings"
              description="Configure LLM for better transaction predictions"
              left={(props) => <List.Icon {...props} icon="robot" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('AISettings')}
            />
            <Divider />
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
              title="Export Data"
              description="Export data as CSV or JSON with options"
              left={(props) => <List.Icon {...props} icon="export" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('DataExport')}
            />
             
               <Divider />
             <List.Item
              title="Archived Books"
              description="View and unarchive hidden books"
              left={(props) => <List.Icon {...props} icon="archive" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('ArchivedBooks')}
            />
            <Divider />
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
              description={syncStatus.syncEnabled 
                ? "Delete all data from Firebase and locally" 
                : "Delete all local data (sync is disabled)"
              }
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

        {/* Developer Options */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Advanced</Title>
            <List.Item
              title="Developer Mode"
              description={developerMode ? 'Debug & testing options visible' : 'Enable to show debug & testing options'}
              left={(props) => <List.Icon {...props} icon="code-braces" />}
              right={() => (
                <Switch
                  value={developerMode}
                  onValueChange={handleToggleDeveloperMode}
                />
              )}
            />
          </Card.Content>
        </Card>

        {/* Debug Section - Only visible in Developer Mode */}
        {developerMode && (
          <>
            <Card style={styles.card}>
              <Card.Content>
                <Title style={{ color: theme.colors.onSurface }}>🔧 Developer Tools</Title>
                <List.Item
                  title="Debug Storage"
                  description="View AsyncStorage data for debugging"
                  left={(props) => <List.Icon {...props} icon="bug" />}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => navigation.navigate('Debug')}
                />
              </Card.Content>
            </Card>

            {/* Debug Section - CRUD Tester */}
            <Card style={styles.card}>
              <Card.Content>
                <Title style={{ color: theme.colors.onSurface }}>🧪 Testing Tools</Title>
                <CRUDTester />
              </Card.Content>
            </Card>
          </>
        )}

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