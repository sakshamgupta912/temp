// Currency Picker Component - Material Design currency selection with search
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {
  Text,
  Searchbar,
  List,
  Portal,
  Surface,
  IconButton,
  Divider,
  useTheme,
  Button,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';

import currencyService, { Currency } from '../services/currencyService';
import { spacing } from '../theme/materialTheme';

interface CurrencyPickerProps {
  selectedCurrency?: string;
  onCurrencySelect: (currency: Currency) => void;
  label?: string;
  disabled?: boolean;
  style?: any;
  showFlag?: boolean;
  showFullName?: boolean;
}

export const CurrencyPicker: React.FC<CurrencyPickerProps> = ({
  selectedCurrency,
  onCurrencySelect,
  label = "Currency",
  disabled = false,
  style,
  showFlag = true,
  showFullName = false,
}) => {
  const theme = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const currencies = currencyService.getSupportedCurrencies();
  const selectedCurrencyData = selectedCurrency 
    ? currencyService.getCurrencyByCode(selectedCurrency)
    : null;

  // Filter currencies based on search
  const filteredCurrencies = useMemo(() => {
    if (!searchQuery.trim()) return currencies;
    
    const query = searchQuery.toLowerCase();
    return currencies.filter(currency => 
      currency.code.toLowerCase().includes(query) ||
      currency.name.toLowerCase().includes(query)
    );
  }, [currencies, searchQuery]);

  // Popular currencies to show first
  const popularCurrencies = useMemo(() => {
    const popular = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CNY', 'CAD', 'AUD'];
    return filteredCurrencies
      .filter(c => popular.includes(c.code))
      .sort((a, b) => popular.indexOf(a.code) - popular.indexOf(b.code));
  }, [filteredCurrencies]);

  // Other currencies (not in popular list)
  const otherCurrencies = useMemo(() => {
    const popular = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CNY', 'CAD', 'AUD'];
    return filteredCurrencies
      .filter(c => !popular.includes(c.code))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredCurrencies]);

  const handleCurrencyPress = useCallback((currency: Currency) => {
    onCurrencySelect(currency);
    setIsVisible(false);
    setSearchQuery('');
  }, [onCurrencySelect]);

  const renderCurrencyItem = ({ item }: { item: Currency }) => (
    <List.Item
      title={showFullName ? item.name : item.code}
      description={showFullName ? item.code : item.name}
      left={() => (
        <View style={styles.currencyItemLeft}>
          {showFlag && (
            <Text style={styles.flagText}>{item.flag}</Text>
          )}
          <Text style={[styles.symbolText, { color: theme.colors.onSurface }]}>
            {item.symbol}
          </Text>
        </View>
      )}
      right={() => (
        selectedCurrency === item.code ? (
          <MaterialIcons 
            name="check" 
            size={24} 
            color={theme.colors.primary} 
          />
        ) : null
      )}
      onPress={() => handleCurrencyPress(item)}
      style={[
        styles.currencyItem,
        { backgroundColor: theme.colors.surface }
      ]}
      titleStyle={{ color: theme.colors.onSurface }}
      descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
    />
  );

  const renderSectionHeader = (title: string) => (
    <View style={[styles.sectionHeader, { backgroundColor: theme.colors.surfaceVariant }]}>
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {title}
      </Text>
    </View>
  );

  return (
    <>
      {/* Currency Selection Button */}
      <TouchableOpacity
        onPress={() => !disabled && setIsVisible(true)}
        disabled={disabled}
        style={[styles.pickerButton, style]}
        activeOpacity={0.7}
      >
        <Surface 
          style={[
            styles.pickerSurface, 
            { 
              backgroundColor: theme.colors.surface,
              opacity: disabled ? 0.6 : 1 
            }
          ]} 
          elevation={1}
        >
          <View style={styles.pickerContent}>
            <View style={styles.pickerLeft}>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {label}
              </Text>
              {selectedCurrencyData ? (
                <View style={styles.selectedCurrency}>
                  {showFlag && (
                    <Text style={styles.selectedFlag}>{selectedCurrencyData.flag}</Text>
                  )}
                  <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                    {selectedCurrencyData.code}
                  </Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    {selectedCurrencyData.symbol}
                  </Text>
                </View>
              ) : (
                <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                  Select Currency
                </Text>
              )}
            </View>
            <MaterialIcons 
              name="keyboard-arrow-down" 
              size={24} 
              color={theme.colors.onSurfaceVariant} 
            />
          </View>
        </Surface>
      </TouchableOpacity>

      {/* Currency Selection Modal */}
      <Portal>
        <Modal
          visible={isVisible}
          onRequestClose={() => setIsVisible(false)}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={[
            styles.modalContainer,
            { backgroundColor: theme.colors.background }
          ]}>
          <Surface 
            style={[styles.modalSurface, { backgroundColor: theme.colors.surface }]} 
            elevation={3}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>
                Select Currency
              </Text>
              <IconButton
                icon="close"
                onPress={() => setIsVisible(false)}
                iconColor={theme.colors.onSurfaceVariant}
              />
            </View>

            <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />

            {/* Search */}
            <View style={styles.searchContainer}>
              <Searchbar
                placeholder="Search currencies..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={styles.searchBar}
                inputStyle={{ color: theme.colors.onSurface }}
                iconColor={theme.colors.onSurfaceVariant}
                placeholderTextColor={theme.colors.onSurfaceVariant}
              />
            </View>

            {/* Currency List */}
            <FlatList
              data={[]}
              renderItem={() => null}
              ListHeaderComponent={
                <View>
                  {/* Popular Currencies */}
                  {popularCurrencies.length > 0 && (
                    <>
                      {renderSectionHeader("Popular Currencies")}
                      {popularCurrencies.map(currency => 
                        <View key={currency.code}>
                          {renderCurrencyItem({ item: currency })}
                        </View>
                      )}
                    </>
                  )}

                  {/* Other Currencies */}
                  {otherCurrencies.length > 0 && (
                    <>
                      {renderSectionHeader("All Currencies")}
                      {otherCurrencies.map(currency => 
                        <View key={currency.code}>
                          {renderCurrencyItem({ item: currency })}
                        </View>
                      )}
                    </>
                  )}

                  {/* No Results */}
                  {filteredCurrencies.length === 0 && (
                    <View style={styles.noResults}>
                      <MaterialIcons 
                        name="search-off" 
                        size={48} 
                        color={theme.colors.onSurfaceVariant} 
                      />
                      <Text 
                        variant="bodyLarge" 
                        style={{ color: theme.colors.onSurfaceVariant, marginTop: spacing.md }}
                      >
                        No currencies found
                      </Text>
                      <Text 
                        variant="bodyMedium" 
                        style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}
                      >
                        Try adjusting your search terms
                      </Text>
                    </View>
                  )}
                </View>
              }
              style={styles.currencyList}
              showsVerticalScrollIndicator={false}
            />

            {/* Footer */}
            <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
            <View style={styles.modalFooter}>
              <Button
                mode="text"
                onPress={() => setIsVisible(false)}
                textColor={theme.colors.primary}
              >
                Cancel
              </Button>
            </View>
          </Surface>
          </View>
        </Modal>
      </Portal>
    </>
  );
};

// Compact Currency Display Component
interface CurrencyDisplayProps {
  currencyCode: string;
  showFlag?: boolean;
  showSymbol?: boolean;
  showCode?: boolean;
  style?: any;
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  currencyCode,
  showFlag = true,
  showSymbol = true,
  showCode = true,
  style,
}) => {
  const theme = useTheme();
  const currency = currencyService.getCurrencyByCode(currencyCode);

  if (!currency) {
    return (
      <Text variant="bodyMedium" style={[{ color: theme.colors.onSurfaceVariant }, style]}>
        {currencyCode}
      </Text>
    );
  }

  return (
    <View style={[styles.currencyDisplay, style]}>
      {showFlag && (
        <Text style={styles.displayFlag}>{currency.flag}</Text>
      )}
      {showSymbol && (
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
          {currency.symbol}
        </Text>
      )}
      {showCode && (
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {currency.code}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Picker Button Styles
  pickerButton: {
    marginVertical: spacing.xs,
  },
  pickerSurface: {
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerLeft: {
    flex: 1,
  },
  selectedCurrency: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  selectedFlag: {
    fontSize: 20,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    margin: spacing.lg,
    marginTop: spacing.xxl * 2,
  },
  modalSurface: {
    flex: 1,
    borderRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  searchBar: {
    elevation: 0,
  },

  // Currency List Styles
  currencyList: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  currencyItem: {
    paddingHorizontal: spacing.lg,
  },
  currencyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginRight: spacing.md,
  },
  flagText: {
    fontSize: 20,
  },
  symbolText: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 32,
  },

  // No Results
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },

  // Currency Display
  currencyDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  displayFlag: {
    fontSize: 16,
  },
});

export default CurrencyPicker;