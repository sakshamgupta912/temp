import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
  Appbar,
  Card,
  Text,
  RadioButton,
  TextInput,
  Button,
  Switch,
  List,
  Divider,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import llmTransactionService from '../services/llmTransactionService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LLM_CONFIG_KEY = 'llm_config';

type LLMProvider = 'gemini' | 'none';

const AISettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<LLMProvider>('none');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [endpoint, setEndpoint] = useState('http://localhost:11434');

  // Load saved configuration
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const savedConfig = await AsyncStorage.getItem(LLM_CONFIG_KEY);
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        setEnabled(config.enabled || false);
        setProvider(config.provider || 'none');
        setApiKey(config.apiKey || '');
        setModel(config.model || '');
        setEndpoint(config.endpoint || 'http://localhost:11434');
      }
    } catch (error) {
      console.error('Failed to load LLM config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    // Validation
    if (enabled && provider !== 'none' && !apiKey) {
      Alert.alert('Error', 'API Key is required for this provider');
      return;
    }

    setSaving(true);
    try {
      const config = {
        enabled,
        provider,
        apiKey,
        model: model || undefined,
        endpoint: endpoint || undefined,
      };

      // Save to AsyncStorage
      await AsyncStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(config));

      // Initialize LLM service
      await llmTransactionService.initialize(config);

      Alert.alert('Success', 'LLM configuration saved successfully!');
    } catch (error) {
      console.error('Failed to save LLM config:', error);
      Alert.alert('Error', 'Failed to save configuration: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!enabled || provider === 'none') {
      Alert.alert('Info', 'Enable LLM first to test connection');
      return;
    }

    if (!apiKey) {
      Alert.alert('Error', 'API Key is required for testing');
      return;
    }

    setTesting(true);
    try {
      // Initialize with current config
      await llmTransactionService.initialize({
        enabled: true,
        provider,
        apiKey,
        model: model || undefined,
        endpoint: endpoint || undefined,
      });

      // Test with sample transaction
      const testResult = await llmTransactionService.predictTransaction(
        {
          amount: 250,
          description: 'Test transaction at McDonald\'s',
          merchant: 'McDonald\'s',
          transactionType: 'debit',
        },
        [{ id: '1', name: 'Food', currency: 'INR' } as any],
        [{ id: '1', name: 'Dining', userId: 'test' } as any],
        []
      );

      if (testResult) {
        Alert.alert(
          '✅ Connection Successful!',
          `Predicted:\nBook: ${testResult.bookName}\nCategory: ${testResult.categoryName}\nConfidence: ${testResult.confidence}%\n\nReasoning: ${testResult.reasoning}`
        );
      } else {
        Alert.alert('Warning', 'LLM returned no prediction, but connection worked');
      }
    } catch (error) {
      console.error('LLM test failed:', error);
      Alert.alert(
        '❌ Connection Failed',
        `Error: ${(error as Error).message}\n\nPlease check your API key and try again.`
      );
    } finally {
      setTesting(false);
    }
  };

  const getProviderInfo = () => {
    return {
      gemini: {
        name: 'Google Gemini',
        freeTier: true,
        limits: '15 requests/minute, 1M tokens/day',
        pricing: 'Free tier available',
        signupUrl: 'https://makersuite.google.com/app/apikey',
        recommended: true,
        pros: ['Free tier', 'Fast', 'Good quality'],
        cons: ['Requires Google account', 'Rate limited'],
      },
      none: {
        name: 'Keyword-based AI (Current)',
        freeTier: true,
        limits: 'No limits',
        pricing: 'Free',
        signupUrl: null,
        recommended: false,
        pros: ['No setup', 'Fast', 'Works offline', 'Privacy'],
        cons: ['Limited accuracy', 'No learning', 'Static rules'],
      },
    };
  };

  const openProviderSignup = (provider: LLMProvider) => {
    const info = getProviderInfo();
    const url = info[provider]?.signupUrl;
    if (url) {
      // You can use Linking.openURL(url) here
      Alert.alert('Get API Key', `Visit: ${url}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading configuration...</Text>
      </View>
    );
  }

  const providerInfo = getProviderInfo();

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="AI Settings" />
      </Appbar.Header>

      <ScrollView style={styles.scrollView}>
        {/* Enable/Disable LLM */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text variant="titleMedium">🤖 LLM-Enhanced AI</Text>
                <Text variant="bodySmall" style={styles.subtitle}>
                  Use AI models for better transaction classification
                </Text>
              </View>
              <Switch value={enabled} onValueChange={setEnabled} />
            </View>
          </Card.Content>
        </Card>

        {enabled && (
          <>
            {/* Provider Selection */}
            <Card style={styles.card}>
              <Card.Title title="Choose Provider" />
              <Card.Content>
                <RadioButton.Group value={provider} onValueChange={(value) => setProvider(value as LLMProvider)}>
                  {/* Gemini */}
                  <View style={styles.radioItem}>
                    <RadioButton.Item
                      label=""
                      value="gemini"
                      style={styles.radioButton}
                    />
                    <View style={styles.radioContent}>
                      <View style={styles.radioHeader}>
                        <Text variant="titleSmall">Google Gemini</Text>
                        {providerInfo.gemini.recommended && (
                          <Chip mode="flat" compact>Recommended</Chip>
                        )}
                      </View>
                      <Text variant="bodySmall" style={styles.providerDesc}>
                        {providerInfo.gemini.limits}
                      </Text>
                      <Text variant="bodySmall" style={styles.providerPros}>
                        ✅ {providerInfo.gemini.pros.join(', ')}
                      </Text>
                    </View>
                  </View>

                  <Divider style={styles.divider} />

                  {/* Keyword-based (None) */}
                  <View style={styles.radioItem}>
                    <RadioButton.Item
                      label=""
                      value="none"
                      style={styles.radioButton}
                    />
                    <View style={styles.radioContent}>
                      <Text variant="titleSmall">Keyword-based AI</Text>
                      <Text variant="bodySmall" style={styles.providerDesc}>
                        Current method (no setup required)
                      </Text>
                    </View>
                  </View>
                </RadioButton.Group>
              </Card.Content>
            </Card>

            {/* API Configuration */}
            {provider !== 'none' && (
              <Card style={styles.card}>
                <Card.Title title="Configuration" />
                <Card.Content>
                  <TextInput
                    label="API Key *"
                    value={apiKey}
                    onChangeText={setApiKey}
                    secureTextEntry
                    mode="outlined"
                    style={styles.input}
                    right={<TextInput.Icon icon="key" />}
                  />
                  <Button
                    mode="text"
                    onPress={() => openProviderSignup(provider)}
                    style={styles.linkButton}
                  >
                    Get Free API Key
                  </Button>

                  {provider === 'gemini' && (
                    <>
                      <TextInput
                        label="Model (optional)"
                        value={model}
                        onChangeText={setModel}
                        placeholder="gemini-2.5-flash"
                        mode="outlined"
                        style={styles.input}
                      />
                      <Text variant="bodySmall" style={{ marginTop: -8, marginBottom: 8, opacity: 0.7 }}>
                        Leave empty for default (recommended)
                      </Text>
                    </>
                  )}


                </Card.Content>
              </Card>
            )}

            {/* Actions */}
            <Card style={styles.card}>
              <Card.Content>
                <Button
                  mode="outlined"
                  onPress={testConnection}
                  loading={testing}
                  disabled={testing || saving || provider === 'none'}
                  icon="test-tube"
                  style={styles.button}
                >
                  Test Connection
                </Button>
                
                <Button
                  mode="contained"
                  onPress={saveConfig}
                  loading={saving}
                  disabled={testing || saving}
                  icon="content-save"
                  style={styles.button}
                >
                  Save Configuration
                </Button>
              </Card.Content>
            </Card>

            {/* Info */}
            <Card style={styles.card}>
              <Card.Content>
                <List.Item
                  title="How it works"
                  description="LLM analyzes transaction description and your history to predict the correct book and category with reasoning."
                  left={props => <List.Icon {...props} icon="information" />}
                />
                <List.Item
                  title="Privacy"
                  description="Only transaction amounts, descriptions, and your book/category names are sent. No personal information."
                  left={props => <List.Icon {...props} icon="shield-check" />}
                />
                <List.Item
                  title="Fallback"
                  description="If LLM fails or is disabled, the app falls back to keyword-based classification."
                  left={props => <List.Icon {...props} icon="auto-fix" />}
                />
              </Card.Content>
            </Card>
          </>
        )}
      </ScrollView>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  card: {
    margin: 8,
    marginTop: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    flex: 1,
  },
  subtitle: {
    marginTop: 4,
    opacity: 0.7,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  radioButton: {
    marginRight: -8,
  },
  radioContent: {
    flex: 1,
    marginLeft: 8,
  },
  radioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  providerDesc: {
    opacity: 0.7,
    marginBottom: 4,
  },
  providerPros: {
    color: '#4caf50',
    fontSize: 12,
  },
  providerCons: {
    color: '#ff9800',
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    marginVertical: 8,
  },
  input: {
    marginBottom: 12,
  },
  linkButton: {
    marginTop: -8,
    marginBottom: 8,
  },
  button: {
    marginTop: 8,
  },
});

export default AISettingsScreen;
