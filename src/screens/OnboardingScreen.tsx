// Onboarding screen for first-time users
import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  StatusBar,
  ScrollView,
  Animated,
  Pressable,
} from 'react-native';
import {
  Button,
  Card,
  Text,
  Surface,
  useTheme,
  RadioButton,
  Switch,
  Divider,
  IconButton,
  ActivityIndicator,
} from 'react-native-paper';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing, borderRadius } from '../theme/materialTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';

interface OnboardingScreenProps {
  navigation: any;
}

export interface UserPreferences {
  currency: string;
  enableCloudSync: boolean;
  enableNotifications: boolean;
  defaultView: 'dashboard' | 'books' | 'analytics';
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  enableBiometric: boolean;
  theme: 'light' | 'dark' | 'system';
}

const CURRENCY_OPTIONS = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
];

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { completeOnboarding, skipOnboarding } = useAuth();
  const { width } = Dimensions.get('window');
  const scrollViewRef = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Current step (0-3)
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Preferences state
  const [preferences, setPreferences] = useState<UserPreferences>({
    currency: 'USD',
    enableCloudSync: true,
    enableNotifications: true,
    defaultView: 'dashboard',
    dateFormat: 'DD/MM/YYYY',
    enableBiometric: false,
    theme: 'system',
  });

  // Load existing preferences from Firebase if available
  React.useEffect(() => {
    const loadExistingPreferences = async () => {
      try {
        const prefsService = await import('../services/preferences');
        const existingPrefs = await prefsService.default.getPreferences();
        
        // Update preferences with existing values
        setPreferences(prev => ({
          ...prev,
          currency: existingPrefs.currency || prev.currency,
          dateFormat: existingPrefs.dateFormat || prev.dateFormat,
          enableCloudSync: existingPrefs.autoSync !== undefined ? existingPrefs.autoSync : prev.enableCloudSync,
        }));
        
        console.log('✅ Pre-populated onboarding with existing preferences');
      } catch (error) {
        console.error('Error loading existing preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadExistingPreferences();
  }, []);

  const totalSteps = 4;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // Animate progress bar
  React.useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const handleComplete = async () => {
    // Save preferences using AuthContext
    try {
      await completeOnboarding(preferences);
      // Navigation will automatically update when needsOnboarding becomes false
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  };

  const handleSkip = async () => {
    try {
      await skipOnboarding();
      // Navigation will automatically update when needsOnboarding becomes false
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return renderWelcomeStep();
      case 1:
        return renderCurrencyStep();
      case 2:
        return renderSyncStep();
      case 3:
        return renderCustomizationStep();
      default:
        return null;
    }
  };

  // Step 0: Welcome
  const renderWelcomeStep = () => (
    <View style={styles.stepContainer}>
      <Surface style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
        <MaterialCommunityIcons name="hand-wave" size={64} color={theme.colors.primary} />
      </Surface>
      
      <Text variant="headlineMedium" style={[styles.stepTitle, { color: theme.colors.onBackground }]}>
        Welcome to Cocona!
      </Text>
      
      <Text variant="bodyLarge" style={[styles.stepDescription, { color: theme.colors.onSurfaceVariant }]}>
        Let's set up your expense tracker in just a few steps. This will only take a minute!
      </Text>

      <View style={styles.featuresList}>
        <View style={styles.featureItem}>
          <MaterialCommunityIcons name="chart-line" size={24} color={theme.colors.primary} />
          <Text style={[styles.featureText, { color: theme.colors.onSurface }]}>
            Track expenses across multiple books
          </Text>
        </View>
        <View style={styles.featureItem}>
          <MaterialCommunityIcons name="cloud-sync" size={24} color={theme.colors.primary} />
          <Text style={[styles.featureText, { color: theme.colors.onSurface }]}>
            Sync across all your devices
          </Text>
        </View>
        <View style={styles.featureItem}>
          <MaterialCommunityIcons name="chart-box" size={24} color={theme.colors.primary} />
          <Text style={[styles.featureText, { color: theme.colors.onSurface }]}>
            Powerful analytics and insights
          </Text>
        </View>
        <View style={styles.featureItem}>
          <MaterialCommunityIcons name="currency-usd" size={24} color={theme.colors.primary} />
          <Text style={[styles.featureText, { color: theme.colors.onSurface }]}>
            Multi-currency support
          </Text>
        </View>
      </View>
    </View>
  );

  // Step 1: Currency Selection
  const renderCurrencyStep = () => (
    <View style={styles.stepContainer}>
      <Surface style={[styles.iconContainer, { backgroundColor: theme.colors.secondaryContainer }]} elevation={0}>
        <MaterialCommunityIcons name="currency-usd" size={64} color={theme.colors.secondary} />
      </Surface>
      
      <Text variant="headlineMedium" style={[styles.stepTitle, { color: theme.colors.onBackground }]}>
        Choose Your Currency
      </Text>
      
      <Text variant="bodyLarge" style={[styles.stepDescription, { color: theme.colors.onSurfaceVariant }]}>
        Select your primary currency. You can always change this later or use multiple currencies.
      </Text>

      <Card style={[styles.optionsCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <Card.Content>
          <RadioButton.Group
            onValueChange={(value) => setPreferences({ ...preferences, currency: value })}
            value={preferences.currency}
          >
            {CURRENCY_OPTIONS.map((currency) => (
              <Pressable
                key={currency.code}
                onPress={() => setPreferences({ ...preferences, currency: currency.code })}
                style={({ pressed }) => [
                  styles.radioItem,
                  pressed && { backgroundColor: theme.colors.surfaceVariant },
                  preferences.currency === currency.code && {
                    backgroundColor: theme.colors.primaryContainer,
                  },
                ]}
              >
                <View style={styles.radioContent}>
                  <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                  <View style={styles.currencyInfo}>
                    <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                      {currency.name}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {currency.code}
                    </Text>
                  </View>
                </View>
                <RadioButton value={currency.code} />
              </Pressable>
            ))}
          </RadioButton.Group>
        </Card.Content>
      </Card>
    </View>
  );

  // Step 2: Cloud Sync & Backup
  const renderSyncStep = () => (
    <View style={styles.stepContainer}>
      <Surface style={[styles.iconContainer, { backgroundColor: theme.colors.tertiaryContainer }]} elevation={0}>
        <MaterialCommunityIcons name="cloud-sync" size={64} color={theme.colors.tertiary} />
      </Surface>
      
      <Text variant="headlineMedium" style={[styles.stepTitle, { color: theme.colors.onBackground }]}>
        Cloud Sync & Backup
      </Text>
      
      <Text variant="bodyLarge" style={[styles.stepDescription, { color: theme.colors.onSurfaceVariant }]}>
        Keep your data safe and accessible across all your devices.
      </Text>

      <Card style={[styles.optionsCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <Card.Content>
          {/* Cloud Sync Toggle */}
          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <MaterialCommunityIcons name="cloud-upload" size={28} color={theme.colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                Enable Cloud Sync
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                Automatically backup and sync your data to Firebase
              </Text>
            </View>
            <Switch
              value={preferences.enableCloudSync}
              onValueChange={(value) => setPreferences({ ...preferences, enableCloudSync: value })}
            />
          </View>

          <Divider style={{ marginVertical: spacing.md }} />

          {/* Notifications Toggle */}
          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <MaterialCommunityIcons name="bell" size={28} color={theme.colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                Enable Notifications
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                Get reminders to track your expenses
              </Text>
            </View>
            <Switch
              value={preferences.enableNotifications}
              onValueChange={(value) => setPreferences({ ...preferences, enableNotifications: value })}
            />
          </View>

          {preferences.enableCloudSync && (
            <>
              <Divider style={{ marginVertical: spacing.md }} />
              <Surface style={[styles.infoBox, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
                <MaterialCommunityIcons name="information" size={20} color={theme.colors.primary} />
                <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer, marginLeft: spacing.sm, flex: 1 }}>
                  Your data will be securely encrypted and synced to your personal Firebase account.
                </Text>
              </Surface>
            </>
          )}
        </Card.Content>
      </Card>
    </View>
  );

  // Step 3: Customization
  const renderCustomizationStep = () => (
    <View style={styles.stepContainer}>
      <Surface style={[styles.iconContainer, { backgroundColor: theme.colors.errorContainer }]} elevation={0}>
        <MaterialCommunityIcons name="tune" size={64} color={theme.colors.error} />
      </Surface>
      
      <Text variant="headlineMedium" style={[styles.stepTitle, { color: theme.colors.onBackground }]}>
        Customize Your Experience
      </Text>
      
      <Text variant="bodyLarge" style={[styles.stepDescription, { color: theme.colors.onSurfaceVariant }]}>
        Choose your preferred settings. You can change these anytime in Settings.
      </Text>

      <Card style={[styles.optionsCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <Card.Content>
          {/* Default View */}
          <Text variant="titleSmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: spacing.sm }}>
            DEFAULT VIEW
          </Text>
          <RadioButton.Group
            onValueChange={(value) => setPreferences({ ...preferences, defaultView: value as any })}
            value={preferences.defaultView}
          >
            <Pressable
              onPress={() => setPreferences({ ...preferences, defaultView: 'dashboard' })}
              style={({ pressed }) => [
                styles.customRadioItem,
                pressed && { backgroundColor: theme.colors.surfaceVariant },
                preferences.defaultView === 'dashboard' && { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <MaterialCommunityIcons name="view-dashboard" size={24} color={theme.colors.primary} />
              <Text style={{ flex: 1, marginLeft: spacing.md, color: theme.colors.onSurface }}>Dashboard</Text>
              <RadioButton value="dashboard" />
            </Pressable>

            <Pressable
              onPress={() => setPreferences({ ...preferences, defaultView: 'books' })}
              style={({ pressed }) => [
                styles.customRadioItem,
                pressed && { backgroundColor: theme.colors.surfaceVariant },
                preferences.defaultView === 'books' && { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <MaterialCommunityIcons name="book-open-variant" size={24} color={theme.colors.primary} />
              <Text style={{ flex: 1, marginLeft: spacing.md, color: theme.colors.onSurface }}>Books</Text>
              <RadioButton value="books" />
            </Pressable>

            <Pressable
              onPress={() => setPreferences({ ...preferences, defaultView: 'analytics' })}
              style={({ pressed }) => [
                styles.customRadioItem,
                pressed && { backgroundColor: theme.colors.surfaceVariant },
                preferences.defaultView === 'analytics' && { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <MaterialCommunityIcons name="chart-bar" size={24} color={theme.colors.primary} />
              <Text style={{ flex: 1, marginLeft: spacing.md, color: theme.colors.onSurface }}>Analytics</Text>
              <RadioButton value="analytics" />
            </Pressable>
          </RadioButton.Group>

          <Divider style={{ marginVertical: spacing.lg }} />

          {/* Date Format */}
          <Text variant="titleSmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: spacing.sm }}>
            DATE FORMAT
          </Text>
          <RadioButton.Group
            onValueChange={(value) => setPreferences({ ...preferences, dateFormat: value as any })}
            value={preferences.dateFormat}
          >
            <Pressable
              onPress={() => setPreferences({ ...preferences, dateFormat: 'DD/MM/YYYY' })}
              style={({ pressed }) => [
                styles.customRadioItem,
                pressed && { backgroundColor: theme.colors.surfaceVariant },
                preferences.dateFormat === 'DD/MM/YYYY' && { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Text style={{ flex: 1, color: theme.colors.onSurface }}>DD/MM/YYYY (11/10/2025)</Text>
              <RadioButton value="DD/MM/YYYY" />
            </Pressable>

            <Pressable
              onPress={() => setPreferences({ ...preferences, dateFormat: 'MM/DD/YYYY' })}
              style={({ pressed }) => [
                styles.customRadioItem,
                pressed && { backgroundColor: theme.colors.surfaceVariant },
                preferences.dateFormat === 'MM/DD/YYYY' && { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Text style={{ flex: 1, color: theme.colors.onSurface }}>MM/DD/YYYY (10/11/2025)</Text>
              <RadioButton value="MM/DD/YYYY" />
            </Pressable>

            <Pressable
              onPress={() => setPreferences({ ...preferences, dateFormat: 'YYYY-MM-DD' })}
              style={({ pressed }) => [
                styles.customRadioItem,
                pressed && { backgroundColor: theme.colors.surfaceVariant },
                preferences.dateFormat === 'YYYY-MM-DD' && { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Text style={{ flex: 1, color: theme.colors.onSurface }}>YYYY-MM-DD (2025-10-11)</Text>
              <RadioButton value="YYYY-MM-DD" />
            </Pressable>
          </RadioButton.Group>
        </Card.Content>
      </Card>
    </View>
  );

  // Show loading while fetching existing preferences
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 16, color: theme.colors.onSurface }}>
          Loading preferences...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />

      {/* Progress Bar with Skip Button */}
      <Surface style={[styles.progressContainer, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <View style={styles.progressHeader}>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
            Step {currentStep + 1} of {totalSteps}
          </Text>
          <Button
            mode="text"
            onPress={handleSkip}
            compact
            labelStyle={{ fontSize: 14 }}
          >
            Skip
          </Button>
        </View>
        <View style={[styles.progressBarContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                backgroundColor: theme.colors.primary,
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </Surface>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderStep()}
      </ScrollView>

      {/* Navigation Buttons */}
      <Surface style={[styles.buttonContainer, { backgroundColor: theme.colors.surface }]} elevation={4}>
        <Button
          mode="outlined"
          onPress={handleBack}
          disabled={currentStep === 0}
          style={styles.backButton}
          contentStyle={styles.buttonContent}
        >
          Back
        </Button>
        <Button
          mode="contained"
          onPress={handleNext}
          style={styles.nextButton}
          contentStyle={styles.buttonContent}
          icon={currentStep === totalSteps - 1 ? 'check' : 'arrow-right'}
        >
          {currentStep === totalSteps - 1 ? "Let's Go!" : 'Next'}
        </Button>
      </Surface>
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
  progressContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  stepContainer: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  stepTitle: {
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  stepDescription: {
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  featuresList: {
    width: '100%',
    gap: spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureText: {
    flex: 1,
    fontSize: 16,
  },
  optionsCard: {
    width: '100%',
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  radioContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '600',
    width: 50,
    textAlign: 'center',
  },
  currencyInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.sm,
  },
  customRadioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
  buttonContent: {
    paddingVertical: spacing.xs,
  },
});

export default OnboardingScreen;
