// Category Management screen - create, edit, and delete custom categories
import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  Dimensions,
  ScrollView,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { 
  Card, 
  Text, 
  FAB, 
  IconButton, 
  Menu, 
  Surface,
  Divider,
  Button,
  useTheme,
  TextInput,
  Dialog,
  Portal,
  Chip,
  HelperText
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';

import { Category } from '../models/types';
import { useAuth } from '../contexts/AuthContext';
import asyncStorageService from '../services/asyncStorage';
import { RootStackParamList } from '../navigation/Navigation';
import { spacing, borderRadius } from '../theme/materialTheme';

type CategoryManagementNavigationProp = StackNavigationProp<RootStackParamList>;

// Available colors for categories
const CATEGORY_COLORS = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3',
  '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
  '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548', '#9E9E9E'
];

// Available icons for categories (optimized for expense tracking)
const CATEGORY_ICONS = [
  'category',          // Others/General
  'shopping-cart',      // Shopping/Groceries
  'restaurant',         // Food & Dining
  'local-gas-station',  // Fuel/Gas
  'directions-car',     // Transportation/Vehicle
  'home',              // Housing/Rent
  'phone',             // Bills/Utilities
  'local-hospital',    // Healthcare/Medical
  'school',            // Education
  'work',              // Salary/Income
  'flight',            // Travel
  'movie',             // Entertainment
  'fitness-center',    // Fitness/Gym
  'pets',              // Pets
  'card-giftcard',     // Gifts
  'account-balance',   // Banking/Finance
  'coffee',            // Cafe/Snacks
  'directions-bus',    // Public Transport
  'celebration',       // Events/Parties
];

const CategoryManagementScreen: React.FC = () => {
  const navigation = useNavigation<CategoryManagementNavigationProp>();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  
  // Reset menu state when categories change
  React.useEffect(() => {
    setMenuVisible(null);
  }, [categories]);
  
  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Form state
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(CATEGORY_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(CATEGORY_ICONS[0]);
  const [errors, setErrors] = useState<{ name?: string }>({});
  
  const theme = useTheme();
  const { width } = Dimensions.get('window');

  const loadCategories = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const userCategories = await asyncStorageService.getCategories(user.id);
      // Show both default and custom categories for management
      setCategories(userCategories);
      console.log('Loaded categories:', userCategories.length);
    } catch (error) {
      console.error('Error loading categories:', error);
      Alert.alert('Error', 'Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const validateForm = () => {
    const newErrors: { name?: string } = {};
    
    if (!categoryName.trim()) {
      newErrors.name = 'Category name is required';
    } else if (categoryName.trim().length < 2) {
      newErrors.name = 'Category name must be at least 2 characters';
    } else if (categories.some(cat => 
      cat.name.toLowerCase() === categoryName.trim().toLowerCase() && 
      cat.id !== editingCategory?.id
    )) {
      newErrors.name = 'Category name already exists';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateCategory = async () => {
    if (!user || !validateForm()) return;

    try {
      const newCategory = await asyncStorageService.createCategory({
        name: categoryName.trim(),
        description: categoryDescription.trim() || undefined,
        color: selectedColor,
        icon: selectedIcon,
        userId: user.id
      });
      
      setCategories(prev => [...prev, newCategory]);
      resetDialog();
      Alert.alert('Success', 'Category created successfully');
    } catch (error) {
      console.error('Error creating category:', error);
      Alert.alert('Error', 'Failed to create category');
    }
  };

  const handleEditCategory = async () => {
    if (!user || !editingCategory || !validateForm()) return;

    try {
      await asyncStorageService.updateCategory(editingCategory.id, {
        name: categoryName.trim(),
        description: categoryDescription.trim() || undefined,
        color: selectedColor,
        icon: selectedIcon
      });
      
      setCategories(prev => prev.map(cat => 
        cat.id === editingCategory.id 
          ? { ...cat, name: categoryName.trim(), description: categoryDescription.trim() || undefined, color: selectedColor, icon: selectedIcon }
          : cat
      ));
      resetDialog();
      Alert.alert('Success', 'Category updated successfully');
    } catch (error) {
      console.error('Error updating category:', error);
      Alert.alert('Error', 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    // CRITICAL: Check if already loading (prevent double-delete race condition)
    // Note: This screen doesn't have isLoading state, but we should add early return check if one is added
    
    // Prevent deletion of mandatory "Others" category
    if (category.name.toLowerCase() === 'others' && category.userId === 'default') {
      Alert.alert(
        'Cannot Delete',
        'The "Others" category is a mandatory default category and cannot be deleted.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await asyncStorageService.deleteCategory(category.id);
              setCategories(prev => prev.filter(cat => cat.id !== category.id));
              Alert.alert('Success', 'Category deleted successfully');
            } catch (error) {
              console.error('Error deleting category:', error);
              const errorMessage = error instanceof Error ? error.message : 'Failed to delete category';
              Alert.alert('Error', errorMessage);
            }
          },
        },
      ]
    );
  };

  const openCreateDialog = () => {
    setDialogMode('create');
    setCategoryName('');
    setSelectedColor(CATEGORY_COLORS[0]);
    setSelectedIcon(CATEGORY_ICONS[0]);
    setErrors({});
    setShowDialog(true);
  };

  const openEditDialog = (category: Category) => {
    setDialogMode('edit');
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(category.description || '');
    setSelectedColor(category.color || CATEGORY_COLORS[0]);
    setSelectedIcon(category.icon || CATEGORY_ICONS[0]);
    setErrors({});
    setMenuVisible(null);
    setShowDialog(true);
  };

  const resetDialog = () => {
    setShowDialog(false);
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDescription('');
    setSelectedColor(CATEGORY_COLORS[0]);
    setSelectedIcon(CATEGORY_ICONS[0]);
    setErrors({});
  };

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
  );

  const renderColorPicker = () => (
    <View style={styles.section}>
      <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Color
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll}>
        <View style={styles.colorGrid}>
          {CATEGORY_COLORS.map((color) => (
            <Surface
              key={color}
              style={[
                styles.colorButton,
                { 
                  backgroundColor: color,
                  borderWidth: 3,
                  borderColor: selectedColor === color ? theme.colors.primary : 'transparent'
                }
              ]}
              elevation={selectedColor === color ? 3 : 1}
            >
              <IconButton
                icon={selectedColor === color ? 'check' : ''}
                iconColor="white"
                onPress={() => setSelectedColor(color)}
                size={20}
                style={{ margin: 0 }}
              />
            </Surface>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderIconPicker = () => (
    <View style={styles.section}>
      <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Icon
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconScroll}>
        <View style={styles.iconGrid}>
          {CATEGORY_ICONS.map((icon) => (
            <Surface
              key={icon}
              style={[
                styles.iconButton,
                { 
                  backgroundColor: selectedIcon === icon ? theme.colors.primaryContainer : theme.colors.surface,
                  borderWidth: 2,
                  borderColor: selectedIcon === icon ? theme.colors.primary : theme.colors.outline
                }
              ]}
              elevation={selectedIcon === icon ? 2 : 0}
            >
              <IconButton
                icon={({ size, color }) => (
                  <MaterialIcons 
                    name={icon as keyof typeof MaterialIcons.glyphMap} 
                    size={22} 
                    color={selectedIcon === icon ? theme.colors.primary : theme.colors.onSurfaceVariant} 
                  />
                )}
                onPress={() => setSelectedIcon(icon)}
                size={40}
                style={{ margin: 0 }}
              />
            </Surface>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderCategoryItem = ({ item: category }: { item: Category }) => (
    <Surface style={[styles.categoryCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <View style={styles.categoryContent}>
        <View style={styles.categoryMain}>
          <Surface 
            style={[
              styles.categoryIcon, 
              { backgroundColor: category.color || theme.colors.primaryContainer }
            ]} 
            elevation={0}
          >
            <MaterialIcons 
              name={category.icon as keyof typeof MaterialIcons.glyphMap || 'more-horiz'} 
              size={20} 
              color="white" 
            />
          </Surface>
          <View style={styles.categoryInfo}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              {category.name}
            </Text>
            {category.description ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {category.description}
              </Text>
            ) : (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {category.userId === 'default' ? 'Default category' : 'Custom category'}
              </Text>
            )}
          </View>
        </View>
        <Menu
          visible={menuVisible === category.id}
          onDismiss={() => setMenuVisible(null)}
          anchor={
            <IconButton
              icon="dots-vertical"
              onPress={() => {
                // Toggle pattern to ensure state change
                setMenuVisible(null);
                setTimeout(() => setMenuVisible(category.id), 0);
              }}
            />
          }
        >
          <Menu.Item
            onPress={() => openEditDialog(category)}
            title="Edit"
            leadingIcon="pencil"
          />
          <Divider />
          <Menu.Item
            onPress={() => handleDeleteCategory(category)}
            title="Delete"
            leadingIcon="delete"
            titleStyle={{ color: theme.colors.error }}
            disabled={category.name.toLowerCase() === 'others' && category.userId === 'default'}
          />
        </Menu>
      </View>
    </Surface>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Surface style={[styles.emptyCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
        <MaterialIcons name="category" size={64} color={theme.colors.onSurfaceVariant} />
        <Text variant="headlineSmall" style={[styles.emptyTitle, { color: theme.colors.onSurfaceVariant }]}>
          No Custom Categories
        </Text>
        <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          Create custom categories to better organize your expenses and income
        </Text>
        <Button
          mode="contained"
          onPress={openCreateDialog}
          style={styles.emptyButton}
          icon="plus"
        >
          Create Category
        </Button>
      </Surface>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text>Loading categories...</Text>
        </View>
      ) : (
        <>
          {categories.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={categories}
              keyExtractor={(item) => item.id}
              renderItem={renderCategoryItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          <FAB
            style={[styles.fab, { backgroundColor: theme.colors.primary }]}
            icon="plus"
            onPress={openCreateDialog}
            color={theme.colors.onPrimary}
          />

          {/* Create/Edit Dialog */}
          <Portal>
            <Dialog visible={showDialog} onDismiss={resetDialog} style={styles.dialog}>
              <Dialog.Title>
                {dialogMode === 'create' ? 'Create Category' : 'Edit Category'}
              </Dialog.Title>
              <Dialog.Content>
                <View style={styles.dialogContent}>
                  {/* Category Name Input */}
                  <TextInput
                    label="Category Name"
                    value={categoryName}
                    onChangeText={(text) => {
                      setCategoryName(text);
                      if (errors.name) {
                        setErrors(prev => ({ ...prev, name: '' }));
                      }
                    }}
                    mode="outlined"
                    error={!!errors.name}
                    style={styles.input}
                  />
                  <HelperText type="error" visible={!!errors.name}>
                    {errors.name}
                  </HelperText>

                  {/* Category Description Input */}
                  <TextInput
                    label="Description (optional)"
                    value={categoryDescription}
                    onChangeText={setCategoryDescription}
                    mode="outlined"
                    multiline
                    numberOfLines={3}
                    style={styles.input}
                  />

                  {/* Preview */}
                  <View style={styles.previewSection}>
                    <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                      Preview
                    </Text>
                    <Surface style={styles.previewContainer} elevation={0}>
                      <Surface 
                        style={[
                          styles.previewIconContainer,
                          { backgroundColor: selectedColor }
                        ]} 
                        elevation={2}
                      >
                        <MaterialIcons 
                          name={selectedIcon as keyof typeof MaterialIcons.glyphMap} 
                          size={24} 
                          color="white" 
                        />
                      </Surface>
                      <View style={styles.previewTextContainer}>
                        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                          {categoryName || 'Category Name'}
                        </Text>
                        {categoryDescription && (
                          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {categoryDescription}
                          </Text>
                        )}
                      </View>
                    </Surface>
                  </View>

                  {renderColorPicker()}
                  {renderIconPicker()}
                </View>
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={resetDialog}>Cancel</Button>
                <Button 
                  onPress={dialogMode === 'create' ? handleCreateCategory : handleEditCategory}
                  mode="contained"
                >
                  {dialogMode === 'create' ? 'Create' : 'Update'}
                </Button>
              </Dialog.Actions>
            </Dialog>
          </Portal>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 100, // Space for FAB
  },
  categoryCard: {
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  categoryMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  categoryInfo: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: spacing.lg,
  },
  fab: {
    position: 'absolute',
    margin: spacing.lg,
    right: 0,
    bottom: 0,
  },
  dialog: {
    maxHeight: '80%',
  },
  dialogContent: {
    paddingVertical: spacing.sm,
  },
  input: {
    marginBottom: spacing.xs,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  previewSection: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: 'transparent',
    gap: spacing.md,
  },
  previewIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewTextContainer: {
    flex: 1,
  },
  previewChip: {
    alignSelf: 'flex-start',
  },
  colorScroll: {
    maxHeight: 60,
  },
  colorGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  colorButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconScroll: {
    maxHeight: 60,
  },
  iconGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});

export default CategoryManagementScreen;