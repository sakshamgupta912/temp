// Preferences screen - manage app settings
import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import { 
  Card, 
  Title, 
  List, 
  Switch,
  useTheme,
  Divider,
  Dialog,
  Portal,
  Text,
  Button,
  RadioButton,
  ActivityIndicator
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';

import preferencesService, { AppPreferences } from '../services/preferences';
import { CurrencyPicker } from '../components/CurrencyPicker';
import { useAuth } from '../contexts/AuthContext';

const PreferencesScreen: React.FC = () => {
  const theme = useTheme();
  const { enableSync, disableSync, getSyncStatus } = useAuth();

  const [preferences, setPreferences] = useState<AppPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState<string | null>(null);

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const prefs = await preferencesService.getPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
      Alert.alert('Error', 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePreference = async <K extends keyof AppPreferences>(
    key: K, 
    value: AppPreferences[K]
  ) => {
    try {
      await preferencesService.updatePreferences({ [key]: value });
      setPreferences(prev => prev ? { ...prev, [key]: value } : null);
    } catch (error) {
      console.error('Error updating preference:', error);
      Alert.alert('Error', 'Failed to update preference');
    }
  };

  // Special handler for Auto Sync toggle - controls both preference and actual cloud sync
  const handleAutoSyncToggle = async (value: boolean) => {
    try {
      // Update the preference first
      await updatePreference('autoSync', value);
      
      // Then enable/disable actual cloud sync
      if (value) {
        await enableSync();
        console.log('✅ Cloud sync enabled via preferences');
      } else {
        disableSync();
        console.log('🛑 Cloud sync disabled via preferences');
      }
    } catch (error) {
      console.error('Error toggling auto sync:', error);
      Alert.alert('Error', 'Failed to toggle auto sync');
    }
  };



  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, [loadPreferences])
  );

  if (loading || !preferences) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16 }}>Loading preferences...</Text>
      </View>
    );
  }

  const dateFormatOptions = preferencesService.getDateFormatOptions();
  const paymentModeOptions = preferencesService.getPaymentModeOptions();

  // Handle currency selection with new service
  const handleCurrencySelect = async (currency: any) => {
    try {
      await preferencesService.setCurrency(currency.code);
      await loadPreferences(); // Reload to get updated symbol
    } catch (error) {
      console.error('Error updating currency:', error);
      Alert.alert('Error', 'Failed to update currency');
    }
  };

  const renderDateFormatDialog = () => (
    <Dialog visible={showDialog === 'dateFormat'} onDismiss={() => setShowDialog(null)}>
      <Dialog.Title>Select Date Format</Dialog.Title>
      <Dialog.Content>
        <RadioButton.Group
          onValueChange={(value) => {
            updatePreference('dateFormat', value as any);
            setShowDialog(null);
          }}
          value={preferences.dateFormat}
        >
          {dateFormatOptions.map((format) => (
            <RadioButton.Item
              key={format.value}
              label={`${format.label} (${format.example})`}
              value={format.value}
              style={styles.radioItem}
            />
          ))}
        </RadioButton.Group>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={() => setShowDialog(null)}>Cancel</Button>
      </Dialog.Actions>
    </Dialog>
  );

  const renderPaymentModeDialog = () => (
    <Dialog visible={showDialog === 'paymentMode'} onDismiss={() => setShowDialog(null)}>
      <Dialog.Title>Default Payment Mode</Dialog.Title>
      <Dialog.Content>
        <RadioButton.Group
          onValueChange={(value) => {
            updatePreference('defaultPaymentMode', value as any);
            setShowDialog(null);
          }}
          value={preferences.defaultPaymentMode}
        >
          {paymentModeOptions.map((mode) => (
            <RadioButton.Item
              key={mode.value}
              label={mode.label}
              value={mode.value}
              style={styles.radioItem}
            />
          ))}
        </RadioButton.Group>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={() => setShowDialog(null)}>Cancel</Button>
      </Dialog.Actions>
    </Dialog>
  );

  const getCurrentDateFormatDisplay = () => {
    const format = dateFormatOptions.find(f => f.value === preferences.dateFormat);
    return format ? `${format.label} (${format.example})` : preferences.dateFormat;
  };

  const getCurrentPaymentModeDisplay = () => {
    const mode = paymentModeOptions.find(m => m.value === preferences.defaultPaymentMode);
    return mode ? mode.label : preferences.defaultPaymentMode;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView}>
        {/* Display Preferences */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Display</Title>
            <View style={styles.currencyPickerContainer}>
              <CurrencyPicker
                selectedCurrency={preferences.currency}
                onCurrencySelect={handleCurrencySelect}
                label="Currency"
                showFlag={true}
                style={styles.currencyPicker}
              />
            </View>
            <Divider />
            <List.Item
              title="Date Format"
              description={getCurrentDateFormatDisplay()}
              left={(props) => <List.Icon {...props} icon="calendar" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => setShowDialog('dateFormat')}
            />
            <Divider />
            <List.Item
              title="Show Decimal Places"
              description="Display currency with cents/paise"
              left={(props) => <List.Icon {...props} icon="decimal" />}
              right={() => (
                <Switch
                  value={preferences.showDecimalPlaces}
                  onValueChange={(value) => updatePreference('showDecimalPlaces', value)}
                />
              )}
            />
          </Card.Content>
        </Card>

        {/* Default Values */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Defaults</Title>
            <List.Item
              title="Default Payment Mode"
              description={getCurrentPaymentModeDisplay()}
              left={(props) => <List.Icon {...props} icon="credit-card" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => setShowDialog('paymentMode')}
            />
            <Divider />
            <List.Item
              title="Default Entry Type"
              description={preferences.defaultEntryType === 'income' ? 'Income' : 'Expense'}
              left={(props) => <List.Icon {...props} icon={preferences.defaultEntryType === 'income' ? 'trending-up' : 'trending-down'} />}
              right={() => (
                <Switch
                  value={preferences.defaultEntryType === 'income'}
                  onValueChange={(value) => updatePreference('defaultEntryType', value ? 'income' : 'expense')}
                />
              )}
            />
          </Card.Content>
        </Card>

        {/* App Behavior */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Behavior</Title>
            <List.Item
              title="Auto Sync"
              description="Automatically sync data with cloud"
              left={(props) => <List.Icon {...props} icon="sync" />}
              right={() => (
                <Switch
                  value={preferences.autoSync}
                  onValueChange={handleAutoSyncToggle}
                />
              )}
            />
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Dialogs */}
      <Portal>
        {renderDateFormatDialog()}
        {renderPaymentModeDialog()}
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
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
  currencyPickerContainer: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  currencyPicker: {
    marginVertical: 0,
  },
});

export default PreferencesScreen;