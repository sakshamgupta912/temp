// Login screen component
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  Dimensions
} from 'react-native';
import { 
  Button, 
  Card, 
  Title, 
  Paragraph, 
  ActivityIndicator,
  Surface,
  Text,
  useTheme
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { spacing, borderRadius, elevation } from '../theme/materialTheme';

const LoginScreen: React.FC = () => {
  const { signInWithGoogle, signInAsDemo, error, isLoading } = useAuth();
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const theme = useTheme();
  const { width, height } = Dimensions.get('window');

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      Alert.alert('Error', 'Failed to sign in with Google');
    }
  };

  const handleDemoSignIn = async () => {
    setIsDemoLoading(true);
    try {
      // Sign in as demo user using the context method
      await signInAsDemo();
      console.log('Demo user signed in successfully');
    } catch (err) {
      console.error('Demo sign in error:', err);
      Alert.alert('Error', 'Failed to sign in as demo user');
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} 
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}>
      
      {/* Hero Section */}
      <Surface style={[styles.heroSection, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
        <View style={styles.logoContainer}>
          <Surface style={[styles.logoBackground, { backgroundColor: theme.colors.primary }]} elevation={3}>
            <MaterialIcons name="account-balance-wallet" size={48} color={theme.colors.onPrimary} />
          </Surface>
          <Title style={[styles.appTitle, { color: theme.colors.onPrimaryContainer }]}>
            Budget Manager
          </Title>
          <Text variant="bodyLarge" style={[styles.appSubtitle, { color: theme.colors.onPrimaryContainer }]}>
            Take control of your finances
          </Text>
        </View>
      </Surface>

      {/* Main Content */}
      <View style={styles.mainContent}>
        
        {/* Welcome Card */}
        <Card style={[styles.welcomeCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Card.Content style={styles.welcomeContent}>
            <Text variant="headlineSmall" style={[styles.welcomeTitle, { color: theme.colors.onSurface }]}>
              Welcome Back
            </Text>
            <Text variant="bodyMedium" style={[styles.welcomeSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Track expenses, manage budgets, and achieve your financial goals
            </Text>
          </Card.Content>
        </Card>

        {/* Sign In Options */}
        <View style={styles.signInSection}>
          
          {/* Demo Sign In Button */}
          <Surface style={[styles.buttonContainer, { backgroundColor: theme.colors.surfaceVariant }]} elevation={1}>
            <MaterialIcons name="person" size={24} color={theme.colors.primary} style={styles.buttonIcon} />
            <View style={styles.buttonContent}>
              <Text variant="titleMedium" style={[styles.buttonTitle, { color: theme.colors.onSurfaceVariant }]}>
                Demo Account
              </Text>
              <Text variant="bodySmall" style={[styles.buttonSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Explore with sample data
              </Text>
            </View>
            <Button
              mode="contained"
              onPress={handleDemoSignIn}
              loading={isDemoLoading}
              disabled={isLoading || isDemoLoading}
              style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
              labelStyle={{ color: theme.colors.onPrimary }}
              contentStyle={styles.buttonContentStyle}
            >
              {isDemoLoading ? 'Signing In...' : 'Continue'}
            </Button>
          </Surface>

          {/* Google Sign In Button */}
          <Surface style={[styles.buttonContainer, { backgroundColor: theme.colors.surfaceVariant }]} elevation={1}>
            <MaterialIcons name="login" size={24} color="#4285F4" style={styles.buttonIcon} />
            <View style={styles.buttonContent}>
              <Text variant="titleMedium" style={[styles.buttonTitle, { color: theme.colors.onSurfaceVariant }]}>
                Google Account
              </Text>
              <Text variant="bodySmall" style={[styles.buttonSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Sync across devices
              </Text>
            </View>
            <Button
              mode="outlined"
              onPress={handleGoogleSignIn}
              loading={isLoading && !isDemoLoading}
              disabled={isLoading || isDemoLoading}
              style={[styles.actionButton, { borderColor: theme.colors.outline }]}
              labelStyle={{ color: theme.colors.primary }}
              contentStyle={styles.buttonContentStyle}
            >
              {isLoading && !isDemoLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </Surface>
          
        </View>

        {/* Features Preview */}
        <Card style={[styles.featuresCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Card.Content>
            <Text variant="titleMedium" style={[styles.featuresTitle, { color: theme.colors.onSurface }]}>
              What you can do:
            </Text>
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <MaterialIcons name="book" size={20} color={theme.colors.primary} />
                <Text variant="bodyMedium" style={[styles.featureText, { color: theme.colors.onSurfaceVariant }]}>
                  Create multiple budget books
                </Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="trending-up" size={20} color={theme.colors.primary} />
                <Text variant="bodyMedium" style={[styles.featureText, { color: theme.colors.onSurfaceVariant }]}>
                  Track income and expenses
                </Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="insights" size={20} color={theme.colors.primary} />
                <Text variant="bodyMedium" style={[styles.featureText, { color: theme.colors.onSurfaceVariant }]}>
                  View detailed reports
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Error Display */}
        {error && (
          <Surface style={[styles.errorContainer, { backgroundColor: theme.colors.errorContainer }]} elevation={1}>
            <MaterialIcons name="error" size={20} color={theme.colors.onErrorContainer} />
            <Text variant="bodyMedium" style={[styles.errorText, { color: theme.colors.onErrorContainer }]}>
              {error}
            </Text>
          </Surface>
        )}
        
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  heroSection: {
    paddingTop: spacing.xxl + 20,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoBackground: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  appTitle: {
    marginBottom: spacing.xs,
    textAlign: 'center',
    fontWeight: '600',
  },
  appSubtitle: {
    textAlign: 'center',
    opacity: 0.8,
  },
  mainContent: {
    flex: 1,
    padding: spacing.lg,
  },
  welcomeCard: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
  },
  welcomeContent: {
    paddingVertical: spacing.lg,
  },
  welcomeTitle: {
    marginBottom: spacing.sm,
    textAlign: 'center',
    fontWeight: '600',
  },
  welcomeSubtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
  signInSection: {
    marginBottom: spacing.lg,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
  },
  buttonIcon: {
    marginRight: spacing.md,
  },
  buttonContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  buttonTitle: {
    marginBottom: spacing.xs / 2,
    fontWeight: '600',
  },
  buttonSubtitle: {
    opacity: 0.7,
  },
  actionButton: {
    borderRadius: borderRadius.lg,
    minWidth: 100,
  },
  buttonContentStyle: {
    paddingVertical: spacing.xs,
  },
  featuresCard: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  featuresTitle: {
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  featuresList: {
    gap: spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  featureText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  errorText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
});

export default LoginScreen;