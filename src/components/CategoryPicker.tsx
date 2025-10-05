// Category Picker Component - Full-screen modal for selecting categories
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Modal,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  Searchbar,
  Button,
  useTheme,
  Divider,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';

import { Category } from '../models/types';
import { spacing, borderRadius } from '../theme/materialTheme';
import asyncStorageService from '../services/asyncStorage';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/Navigation';

interface CategoryPickerProps {
  visible: boolean;
  selectedCategory: string;
  onSelect: (category: string) => void;
  onDismiss: () => void;
}

type NavigationProp = StackNavigationProp<RootStackParamList>;

const CategoryPicker: React.FC<CategoryPickerProps> = ({
  visible,
  selectedCategory,
  onSelect,
  onDismiss,
}) => {
  const theme = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { height } = Dimensions.get('window');

  useEffect(() => {
    if (visible && user) {
      loadCategories();
    }
  }, [visible, user]);

  const loadCategories = async () => {
    if (!user) return;
    try {
      const userCategories = await asyncStorageService.getCategories(user.id);
      setCategories(userCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    return categories.filter((cat) =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [categories, searchQuery]);

  const categorizedData = useMemo(() => {
    const userCategories = filteredCategories.filter(cat => cat.userId !== 'default');
    const defaultCategories = filteredCategories.filter(cat => cat.userId === 'default');
    
    return {
      userCategories,
      defaultCategories,
    };
  }, [filteredCategories]);

  const handleSelect = (categoryName: string) => {
    onSelect(categoryName);
    setSearchQuery('');
    onDismiss();
  };

  const handleManageCategories = () => {
    onDismiss();
    setSearchQuery('');
    navigation.navigate('CategoryManagement');
  };

  const renderCategoryItem = ({ item }: { item: Category }) => {
    const isSelected = item.name === selectedCategory;

    return (
      <TouchableOpacity
        onPress={() => handleSelect(item.name)}
        activeOpacity={0.7}
      >
        <Surface
          style={[
            styles.categoryItem,
            {
              backgroundColor: isSelected
                ? theme.colors.primaryContainer
                : theme.colors.surface,
            },
          ]}
          elevation={isSelected ? 2 : 0}
        >
          <View style={styles.categoryItemContent}>
            <Surface
              style={[
                styles.categoryIcon,
                { backgroundColor: item.color || theme.colors.primaryContainer },
              ]}
              elevation={0}
            >
              <MaterialIcons
                name={item.icon as keyof typeof MaterialIcons.glyphMap || 'more-horiz'}
                size={22}
                color="white"
              />
            </Surface>
            <View style={styles.categoryText}>
              <Text
                variant="titleMedium"
                style={[
                  styles.categoryName,
                  {
                    color: isSelected
                      ? theme.colors.onPrimaryContainer
                      : theme.colors.onSurface,
                  },
                ]}
              >
                {item.name}
              </Text>
              {item.description && (
                <Text
                  variant="bodySmall"
                  style={[
                    styles.categoryDescription,
                    {
                      color: isSelected
                        ? theme.colors.onPrimaryContainer
                        : theme.colors.onSurfaceVariant,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.description}
                </Text>
              )}
            </View>
            {isSelected && (
              <MaterialIcons
                name="check-circle"
                size={24}
                color={theme.colors.primary}
              />
            )}
          </View>
        </Surface>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text
        variant="titleSmall"
        style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}
      >
        {title}
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      onRequestClose={onDismiss}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
        <Surface
          style={[
            styles.modalContent,
            {
              backgroundColor: theme.colors.background,
            },
          ]}
          elevation={0}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text
              variant="headlineSmall"
              style={[styles.title, { color: theme.colors.onSurface }]}
            >
              Select Category
            </Text>
            <IconButton
              icon="close"
              size={24}
              onPress={onDismiss}
              iconColor={theme.colors.onSurfaceVariant}
            />
          </View>

          {/* Search Bar */}
          <Searchbar
            placeholder="Search categories..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
            iconColor={theme.colors.onSurfaceVariant}
          />

          {/* Categories List */}
          <FlatList
            data={[]}
            renderItem={null}
            ListHeaderComponent={
              <>
                {categorizedData.userCategories.length > 0 && (
                  <>
                    {renderSectionHeader('Your Categories')}
                    {categorizedData.userCategories.map((category) => (
                      <View key={category.id}>{renderCategoryItem({ item: category })}</View>
                    ))}
                  </>
                )}
                {categorizedData.defaultCategories.length > 0 && (
                  <>
                    {renderSectionHeader('Default Categories')}
                    {categorizedData.defaultCategories.map((category) => (
                      <View key={category.id}>{renderCategoryItem({ item: category })}</View>
                    ))}
                  </>
                )}
                {filteredCategories.length === 0 && (
                  <View style={styles.emptyState}>
                    <MaterialIcons
                      name="search-off"
                      size={48}
                      color={theme.colors.onSurfaceVariant}
                    />
                    <Text
                      variant="bodyLarge"
                      style={[
                        styles.emptyText,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      No categories found
                    </Text>
                  </View>
                )}
              </>
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />

          {/* Manage Categories Button */}
          <View style={styles.footer}>
            <Divider />
            <Button
              mode="text"
              icon="settings"
              onPress={handleManageCategories}
              style={styles.manageButton}
              contentStyle={styles.manageButtonContent}
            >
              Manage Categories
            </Button>
          </View>
        </Surface>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontWeight: '600',
  },
  searchBar: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    elevation: 0,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  sectionHeader: {
    paddingVertical: spacing.sm,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    fontWeight: '600',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  categoryItem: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  categoryItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryText: {
    flex: 1,
  },
  categoryName: {
    fontWeight: '500',
  },
  categoryDescription: {
    marginTop: 2,
    opacity: 0.8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  footer: {
    paddingTop: spacing.sm,
  },
  manageButton: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
  },
  manageButtonContent: {
    paddingVertical: spacing.xs,
  },
});

export default CategoryPicker;
