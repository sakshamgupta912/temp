// Add Book screen - Material Design form to create new expense books
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions
} from 'react-native';
import { 
  TextInput, 
  Button, 
  Surface, 
  Text,
  Divider,
  useTheme,
  HelperText
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import asyncStorageService from '../services/asyncStorage';
import { RootStackParamList } from '../navigation/Navigation';
import { spacing, borderRadius } from '../theme/materialTheme';
import { CurrencyPicker } from '../components/CurrencyPicker';
import preferencesService from '../services/preferences';
import currencyService from '../services/currencyService';

type AddBookNavigationProp = StackNavigationProp<RootStackParamList, 'AddBook'>;

const AddBookScreen: React.FC = () => {
  const navigation = useNavigation<AddBookNavigationProp>();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const theme = useTheme();
  const { width } = Dimensions.get('window');

  // Load default currency on component mount
  React.useEffect(() => {
    const loadDefaultCurrency = async () => {
      try {
        const prefs = await preferencesService.getPreferences();
        setCurrency(prefs.currency);
      } catch (error) {
        console.error('Error loading default currency:', error);
        setCurrency('USD'); // fallback
      }
    };
    loadDefaultCurrency();
  }, []);

  const validateName = (value: string) => {
    if (!value.trim()) {
      setNameError('Book name is required');
      return false;
    }
    if (value.trim().length < 2) {
      setNameError('Book name must be at least 2 characters');
      return false;
    }
    if (value.trim().length > 50) {
      setNameError('Book name must be less than 50 characters');
      return false;
    }
    setNameError('');
    return true;
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (nameError) {
      validateName(value);
    }
  };

  const handleCreateBook = async () => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    const isNameValid = validateName(name);
    if (!isNameValid) {
      return;
    }

    setIsLoading(true);
    try {
      console.log('AddBook: Starting book creation process', {
        name: name.trim(),
        description: description.trim(),
        currency: currency || 'default',
        userId: user.id
      });

      const book = await asyncStorageService.createBook({
        name: name.trim(),
        description: description.trim(),
        currency: currency || undefined, // Only set if different from default
        userId: user.id
      });

      console.log('AddBook: Book created successfully:', book);
      Alert.alert(
        'Success',
        `"${book.name}" has been created successfully!`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      console.error('AddBook: Error creating book:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to create book: ${errorMessage}`);
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
          { text: 'Continue Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const isFormValid = name.trim().length >= 2 && !nameError;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      
      {/* Header Section */}
      <Surface style={[styles.headerSection, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
        <View style={styles.headerContent}>
          <Surface style={[styles.headerIcon, { backgroundColor: theme.colors.primary }]} elevation={2}>
            <MaterialIcons name="library-add" size={32} color={theme.colors.onPrimary} />
          </Surface>
          <Text variant="headlineMedium" style={[styles.headerTitle, { color: theme.colors.onPrimaryContainer }]}>
            Create New Book
          </Text>
          <Text variant="bodyLarge" style={[styles.headerSubtitle, { color: theme.colors.onPrimaryContainer }]}>
            Organize your expenses with a new book
          </Text>
        </View>
      </Surface>

      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          
          {/* Form Section */}
          <Surface style={[styles.formCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.formContent}>
              
              <View style={styles.formSection}>
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                  Book Information
                </Text>
                <Text variant="bodyMedium" style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
                  Give your book a descriptive name to easily identify it later
                </Text>
              </View>

              <View style={styles.inputSection}>
                <TextInput
                  label="Book Name"
                  value={name}
                  onChangeText={handleNameChange}
                  mode="outlined"
                  style={styles.input}
                  placeholder="e.g., Monthly Expenses, Vacation 2025, Business"
                  maxLength={50}
                  autoFocus
                  error={!!nameError}
                  right={
                    <TextInput.Affix 
                      text={`${name.length}/50`} 
                      textStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}
                    />
                  }
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                  textColor={theme.colors.onSurface}
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                />
                {nameError ? (
                  <HelperText type="error" visible={true}>
                    {nameError}
                  </HelperText>
                ) : (
                  <HelperText type="info" visible={true}>
                    Choose a name that helps you identify this book's purpose
                  </HelperText>
                )}
              </View>

              <Divider style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

              <View style={styles.inputSection}>
                <TextInput
                  label="Description (Optional)"
                  value={description}
                  onChangeText={setDescription}
                  mode="outlined"
                  style={styles.input}
                  placeholder="Add more details about this book..."
                  maxLength={200}
                  multiline
                  numberOfLines={3}
                  right={
                    <TextInput.Affix 
                      text={`${description.length}/200`} 
                      textStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}
                    />
                  }
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                  textColor={theme.colors.onSurface}
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                />
                <HelperText type="info" visible={true}>
                  Describe what expenses you'll track in this book
                </HelperText>
              </View>

              <Divider style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

              <View style={styles.inputSection}>
                <CurrencyPicker
                  selectedCurrency={currency}
                  onCurrencySelect={(selectedCurrency) => setCurrency(selectedCurrency.code)}
                  label="Currency (Optional)"
                  showFlag={true}
                  style={styles.currencyPicker}
                />
                <HelperText type="info" visible={true}>
                  Leave empty to use your default currency preference
                </HelperText>
              </View>

            </View>
          </Surface>

          {/* Preview Section */}
          <Surface style={[styles.previewCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.previewContent}>
              <Text variant="titleMedium" style={[styles.previewTitle, { color: theme.colors.onSurface }]}>
                Preview
              </Text>
              <View style={styles.previewBook}>
                <View style={styles.previewHeader}>
                  <Surface style={[styles.previewIcon, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
                    <MaterialIcons name="book" size={20} color={theme.colors.onPrimaryContainer} />
                  </Surface>
                  <View style={styles.previewInfo}>
                    <Text variant="titleMedium" style={[styles.previewName, { color: theme.colors.onSurface }]}>
                      {name || 'Book Name'}
                    </Text>
                    {description && (
                      <Text variant="bodySmall" style={[styles.previewDescription, { color: theme.colors.onSurfaceVariant }]}>
                        {description}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </Surface>

        </ScrollView>

        {/* Action Buttons */}
        <Surface style={[styles.actionBar, { backgroundColor: theme.colors.surface }]} elevation={3}>
          <View style={styles.actionButtons}>
            <Button
              mode="outlined"
              onPress={handleCancel}
              style={[styles.cancelButton, { borderColor: theme.colors.outline }]}
              labelStyle={{ color: theme.colors.onSurface }}
              contentStyle={styles.buttonContent}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleCreateBook}
              style={[styles.createButton, { backgroundColor: isFormValid ? theme.colors.primary : theme.colors.surfaceVariant }]}
              labelStyle={{ color: isFormValid ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}
              contentStyle={styles.buttonContent}
              loading={isLoading}
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Book'}
            </Button>
          </View>
        </Surface>

      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    paddingTop: spacing.xxl + 20,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontWeight: '600',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  headerSubtitle: {
    opacity: 0.8,
    textAlign: 'center',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  formCard: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  formContent: {
    padding: spacing.lg,
  },
  formSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    opacity: 0.8,
    lineHeight: 20,
  },
  inputSection: {
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: 'transparent',
  },
  divider: {
    marginVertical: spacing.lg,
    height: 1,
  },
  previewCard: {
    borderRadius: borderRadius.md,
  },
  previewContent: {
    padding: spacing.lg,
  },
  previewTitle: {
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  previewBook: {
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderStyle: 'dashed',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontWeight: '600',
    opacity: 0.8,
  },
  previewDescription: {
    marginTop: spacing.xs / 2,
    opacity: 0.6,
  },
  actionBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopLeftRadius: borderRadius.md,
    borderTopRightRadius: borderRadius.md,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    borderRadius: borderRadius.lg,
  },
  createButton: {
    flex: 2,
    borderRadius: borderRadius.lg,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  currencyPicker: {
    marginVertical: 0,
  },
});

export default AddBookScreen;