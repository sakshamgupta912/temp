// Sign Up screen for email authentication
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  Dimensions,
  StatusBar
} from 'react-native';
import { 
  Button, 
  Card, 
  TextInput,
  Text,
  Surface,
  useTheme,
  IconButton
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { spacing, borderRadius } from '../theme/materialTheme';

interface SignUpScreenProps {
  navigation: any;
}

const SignUpScreen: React.FC<SignUpScreenProps> = ({ navigation }) => {
  const { signUpWithEmail, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const { width, height } = Dimensions.get('window');

  const validateForm = () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return false;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter a password');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;

    setError(null);
    try {
      const result = await signUpWithEmail(email.trim(), password, displayName.trim());
      if (result.success) {
        Alert.alert(
          'Account Created!', 
          'Your account has been created successfully. You are now signed in.',
          [{ text: 'OK' }]
        );
        // Navigation will be handled automatically by auth state change
      } else {
        setError(result.error || 'Sign-up failed');
        Alert.alert('Sign Up Failed', result.error || 'Unknown error occurred');
      }
    } catch (err) {
      setError('Failed to create account');
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const navigateToLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor={theme.colors.onBackground}
          onPress={navigateToLogin}
          style={styles.backButton}
        />
        <View style={styles.headerContent}>
          <MaterialIcons name="account-circle" size={48} color={theme.colors.primary} />
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
            Create Account
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Join us to start tracking your expenses
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={[styles.formCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Card.Content style={styles.formContent}>
            
            {/* Display Name Input */}
            <TextInput
              label="Full Name"
              value={displayName}
              onChangeText={setDisplayName}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="account" />}
              disabled={isLoading}
              autoComplete="name"
              textContentType="name"
            />

            {/* Email Input */}
            <TextInput
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              left={<TextInput.Icon icon="email" />}
              disabled={isLoading}
            />

            {/* Password Input */}
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              style={styles.input}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              textContentType="newPassword"
              left={<TextInput.Icon icon="lock" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? "eye-off" : "eye"}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              disabled={isLoading}
            />

            {/* Confirm Password Input */}
            <TextInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              mode="outlined"
              style={styles.input}
              secureTextEntry={!showConfirmPassword}
              autoComplete="new-password"
              textContentType="newPassword"
              left={<TextInput.Icon icon="lock-check" />}
              right={
                <TextInput.Icon
                  icon={showConfirmPassword ? "eye-off" : "eye"}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              }
              disabled={isLoading}
            />

            {/* Error Message */}
            {error && (
              <Surface style={[styles.errorContainer, { backgroundColor: theme.colors.errorContainer }]} elevation={1}>
                <MaterialIcons name="error" size={20} color={theme.colors.error} />
                <Text variant="bodyMedium" style={[styles.errorText, { color: theme.colors.error }]}>
                  {error}
                </Text>
              </Surface>
            )}

            {/* Sign Up Button */}
            <Button
              mode="contained"
              onPress={handleSignUp}
              loading={isLoading}
              disabled={isLoading}
              style={[styles.signUpButton, { backgroundColor: theme.colors.primary }]}
              labelStyle={{ color: theme.colors.onPrimary, fontSize: 16, fontWeight: '600' }}
              contentStyle={styles.buttonContent}
              icon={isLoading ? undefined : "account-plus"}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>

            {/* Login Prompt */}
            <View style={styles.loginPrompt}>
              <Text variant="bodyMedium" style={[styles.promptText, { color: theme.colors.onSurfaceVariant }]}>
                Already have an account?{' '}
              </Text>
              <Button
                mode="text"
                onPress={navigateToLogin}
                labelStyle={{ color: theme.colors.primary, fontWeight: '600' }}
                disabled={isLoading}
              >
                Sign In
              </Button>
            </View>

          </Card.Content>
        </Card>

        {/* Features Section */}
        <Card style={[styles.featuresCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Card.Content>
            <Text variant="titleMedium" style={[styles.featuresTitle, { color: theme.colors.onSurface }]}>
              What you'll get:
            </Text>
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <MaterialIcons name="cloud-sync" size={20} color={theme.colors.primary} />
                <Text style={[styles.featureText, { color: theme.colors.onSurfaceVariant }]}>
                  Automatic cloud backup
                </Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="devices" size={20} color={theme.colors.primary} />
                <Text style={[styles.featureText, { color: theme.colors.onSurfaceVariant }]}>
                  Sync across all devices
                </Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="analytics" size={20} color={theme.colors.primary} />
                <Text style={[styles.featureText, { color: theme.colors.onSurfaceVariant }]}>
                  Advanced analytics
                </Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="security" size={20} color={theme.colors.primary} />
                <Text style={[styles.featureText, { color: theme.colors.onSurfaceVariant }]}>
                  Secure data encryption
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginLeft: -spacing.sm,
    marginBottom: spacing.md,
  },
  headerContent: {
    alignItems: 'center',
  },
  title: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textAlign: 'center',
    fontWeight: '600',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  formCard: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
  },
  formContent: {
    paddingVertical: spacing.lg,
  },
  input: {
    marginBottom: spacing.md,
  },
  signUpButton: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  loginPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  promptText: {
    textAlign: 'center',
  },
  featuresCard: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
  },
  featuresTitle: {
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  featuresList: {
    gap: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  featureText: {
    marginLeft: spacing.md,
    flex: 1,
  },
});

export default SignUpScreen;