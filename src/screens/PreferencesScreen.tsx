// Preferences screen - manage app settings and customization
import React, { useState, useCallback, useEffect } from 'react';
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
  Chip
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { RootStackParamList } from '../navigation/Navigation';
import preferencesService, { AppPreferences } from '../services/preferences';
import { CurrencyPicker, CurrencyDisplay } from '../components/CurrencyPicker';
import currencyService from '../services/currencyService';

type PreferencesNavigationProp = StackNavigationProp<RootStackParamList>;

const PreferencesScreen: React.FC = () => {
  const navigation = useNavigation<PreferencesNavigationProp>();
  const theme = useTheme();

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

  const handleResetPreferences = () => {
    Alert.alert(
      'Reset Preferences',
      'Are you sure you want to reset all preferences to their default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await preferencesService.resetPreferences();
              await loadPreferences();
              Alert.alert('Success', 'Preferences reset to defaults');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset preferences');
            }
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, [loadPreferences])
  );

  if (loading || !preferences) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <Text>Loading preferences...</Text>
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

  const getCurrentCurrencyDisplay = () => {
    const currency = currencyService.getCurrencyByCode(preferences.currency);
    return currency ? `${currency.symbol} ${currency.name}` : preferences.currency;
  };

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
              title="Enable Notifications"
              description="Get reminders and alerts"
              left={(props) => <List.Icon {...props} icon="bell" />}
              right={() => (
                <Switch
                  value={preferences.enableNotifications}
                  onValueChange={(value) => updatePreference('enableNotifications', value)}
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
                  value={preferences.enableBiometric}
                  onValueChange={(value) => updatePreference('enableBiometric', value)}
                />
              )}
            />
            <Divider />
            <List.Item
              title="Auto Backup"
              description="Automatically backup data"
              left={(props) => <List.Icon {...props} icon="backup-restore" />}
              right={() => (
                <Switch
                  value={preferences.autoBackup}
                  onValueChange={(value) => updatePreference('autoBackup', value)}
                />
              )}
            />
            <Divider />
            <List.Item
              title="Enable Analytics"
              description="Help improve the app with usage data"
              left={(props) => <List.Icon {...props} icon="chart-bar" />}
              right={() => (
                <Switch
                  value={preferences.enableAnalytics}
                  onValueChange={(value) => updatePreference('enableAnalytics', value)}
                />
              )}
            />
          </Card.Content>
        </Card>

        {/* Advanced Settings */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Advanced</Title>
            <List.Item
              title="Max Entries Per Page"
              description={`${preferences.maxEntriesPerPage} entries`}
              left={(props) => <List.Icon {...props} icon="format-list-numbered" />}
              right={() => (
                <View style={styles.chipContainer}>
                  {[25, 50, 100].map(count => (
                    <Chip
                      key={count}
                      mode={preferences.maxEntriesPerPage === count ? 'flat' : 'outlined'}
                      selected={preferences.maxEntriesPerPage === count}
                      onPress={() => updatePreference('maxEntriesPerPage', count)}
                      style={styles.chip}
                      compact
                    >
                      {count}
                    </Chip>
                  ))}
                </View>
              )}
            />
            <Divider />
            <List.Item
              title="Cache Timeout"
              description={`${preferences.cacheTimeout / 1000 / 60} minutes`}
              left={(props) => <List.Icon {...props} icon="timer" />}
              right={() => (
                <View style={styles.chipContainer}>
                  {[1, 5, 10, 30].map(minutes => (
                    <Chip
                      key={minutes}
                      mode={preferences.cacheTimeout === minutes * 60 * 1000 ? 'flat' : 'outlined'}
                      selected={preferences.cacheTimeout === minutes * 60 * 1000}
                      onPress={() => updatePreference('cacheTimeout', minutes * 60 * 1000)}
                      style={styles.chip}
                      compact
                    >
                      {minutes}m
                    </Chip>
                  ))}
                </View>
              )}
            />
          </Card.Content>
        </Card>

        {/* Reset */}
        <Card style={styles.card}>
          <Card.Content>
            <List.Item
              title="Reset All Preferences"
              description="Restore all settings to defaults"
              left={(props) => <List.Icon {...props} icon="restore" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={handleResetPreferences}
              titleStyle={{ color: theme.colors.error }}
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
  chipContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  chip: {
    marginHorizontal: 2,
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