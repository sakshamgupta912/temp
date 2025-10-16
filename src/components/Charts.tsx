import React, { memo, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { LineChart, BarChart as RNBarChart, PieChart } from 'react-native-chart-kit';
import { TrendData, CategoryData, formatCurrency, formatPercentage } from '../utils/chartUtils';
import { spacing, borderRadius } from '../theme/materialTheme';

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 64; // Account for screen padding (32) + card padding (32)
const barWidth = 70; // Width per bar in scrollable bar chart

interface BaseChartProps {
  title: string;
  subtitle?: string;
}

// Line Chart for trends (Income/Expense over time)
interface TrendChartProps extends BaseChartProps {
  data: TrendData[];
  showIncome?: boolean;
  showExpense?: boolean;
  showBalance?: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = memo(({ 
  title, 
  subtitle, 
  data, 
  showIncome = true, 
  showExpense = true, 
  showBalance = false 
}) => {
  const theme = useTheme();

  // Helper function to convert hex color to rgba
  const hexToRgba = (hex: string, opacity: number = 1) => {
    // Remove # if present
    const cleanHex = hex.replace('#', '');
    
    // Parse RGB values
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Memoize expensive data processing
  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    // Prepare data for react-native-chart-kit
    const labels = data.map(item => {
      // The date is already formatted as a string (e.g., "Jan '24" or "15/10")
      // Just use it directly
      return item.date;
    });

    const datasets: any[] = [];
    
    if (showIncome) {
      datasets.push({
        data: data.map(item => item.income / 1000), // Convert to thousands
        color: (opacity = 1) => hexToRgba(theme.colors.primary, opacity),
        strokeWidth: 3,
      });
    }
    
    if (showExpense) {
      datasets.push({
        data: data.map(item => Math.abs(item.expense) / 1000), // Convert to thousands and make positive
        color: (opacity = 1) => hexToRgba(theme.colors.error, opacity),
        strokeWidth: 3,
      });
    }

    return { labels, datasets };
  }, [data, showIncome, showExpense, theme.colors.primary, theme.colors.error]);

  // Memoize chart configuration - MUST be before any conditional returns
  const chartConfig = useMemo(() => ({
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    color: (opacity = 1) => hexToRgba(theme.colors.onSurface, opacity),
    labelColor: (opacity = 1) => hexToRgba(theme.colors.onSurfaceVariant, opacity),
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 1,
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: theme.colors.primary
    }
  }), [theme.colors.surface, theme.colors.onSurface, theme.colors.onSurfaceVariant, theme.colors.primary]);

  if (!chartData) {
    return (
      <Card style={styles.chartCard} elevation={2}>
        <Card.Content>
          <Text variant="titleMedium" style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
            {title}
          </Text>
          {subtitle && (
            <Text variant="bodySmall" style={[styles.chartSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {subtitle}
            </Text>
          )}
          <View style={styles.emptyChart}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>No data available</Text>
          </View>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card style={[styles.chartCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
      <Card.Content>
        <Text variant="titleMedium" style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="bodySmall" style={[styles.chartSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            {subtitle}
          </Text>
        )}
        
        <LineChart
          data={{
            labels: chartData.labels,
            datasets: chartData.datasets
          }}
          width={chartWidth}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          yAxisSuffix="k"
        />
        
        {/* Legend */}
        <View style={styles.legend}>
          {showIncome && (
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: theme.colors.primary }]} />
              <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                Income
              </Text>
            </View>
          )}
          {showExpense && (
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: theme.colors.error }]} />
              <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                Expenses
              </Text>
            </View>
          )}
          {showBalance && (
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: theme.colors.primaryContainer }]} />
              <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                Balance
              </Text>
            </View>
          )}
        </View>
      </Card.Content>
    </Card>
  );
});

// Pie Chart for category breakdown
interface CategoryChartProps extends BaseChartProps {
  data: CategoryData[];
  showPercentages?: boolean;
}

export const CategoryChart: React.FC<CategoryChartProps> = memo(({ 
  title, 
  subtitle, 
  data, 
  showPercentages = true 
}) => {
  const theme = useTheme();

  // Memoize pie chart data preparation
  const pieData = useMemo(() => {
    if (data.length === 0) return null;

    return data.map((item, index) => ({
      name: item.category,
      population: item.amount,
      color: item.color,
      legendFontColor: theme.colors.onSurfaceVariant,
      legendFontSize: 12,
    }));
  }, [data, theme.colors.onSurfaceVariant]);

  // Helper function to convert hex color to rgba (reused from TrendChart)
  const hexToRgba = (hex: string, opacity: number = 1) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Memoize chart config - MUST be before conditional return
  const chartConfig = useMemo(() => ({
    color: (opacity = 1) => hexToRgba(theme.colors.onSurface, opacity),
    labelColor: (opacity = 1) => hexToRgba(theme.colors.onSurfaceVariant, opacity),
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
  }), [theme.colors.onSurface, theme.colors.onSurfaceVariant]);

  if (!pieData) {
    return (
      <Card style={styles.chartCard} elevation={2}>
        <Card.Content>
          <Text variant="titleMedium" style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
            {title}
          </Text>
          {subtitle && (
            <Text variant="bodySmall" style={[styles.chartSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {subtitle}
            </Text>
          )}
          <View style={styles.emptyChart}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>No expenses to categorize</Text>
          </View>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card style={[styles.chartCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
      <Card.Content>
        <Text variant="titleMedium" style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="bodySmall" style={[styles.chartSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            {subtitle}
          </Text>
        )}
        
        <PieChart
          data={pieData}
          width={chartWidth}
          height={220}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute={!showPercentages}
          style={styles.chart}
        />
        
        {/* Category Legend */}
        <View style={styles.categoryLegend}>
          {data.slice(0, 5).map((item, index) => (
            <View key={item.category} style={styles.categoryLegendItem}>
              <View style={[styles.categoryColor, { backgroundColor: item.color }]} />
              <View style={styles.categoryInfo}>
                <Text 
                  style={[styles.categoryName, { color: theme.colors.onSurface }]}
                  numberOfLines={1}
                >
                  {item.category}
                </Text>
                <Text style={[styles.categoryAmount, { color: theme.colors.onSurfaceVariant }]}>
                  {formatCurrency(item.amount)} ({formatPercentage(item.percentage)})
                </Text>
              </View>
            </View>
          ))}
          {data.length > 5 && (
            <Text style={[styles.moreCategories, { color: theme.colors.onSurfaceVariant }]}>
              +{data.length - 5} more categories
            </Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );
});

// Bar Chart for comparing periods
interface BarChartProps extends BaseChartProps {
  data: TrendData[];
  dataKey: 'income' | 'expense' | 'balance';
  color?: string;
}

export const BarChart: React.FC<BarChartProps> = memo(({ 
  title, 
  subtitle, 
  data, 
  dataKey,
  color 
}) => {
  const theme = useTheme();
  
  // Helper function to convert hex color to rgba
  const hexToRgba = (hex: string, opacity: number = 1) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };
  
  // Memoize color calculation
  const chartColor = useMemo(() => 
    color || (
      dataKey === 'income' ? theme.colors.primary :
      dataKey === 'expense' ? theme.colors.error :
      theme.colors.tertiary
    ), [color, dataKey, theme.colors.primary, theme.colors.error, theme.colors.tertiary]);

  // Memoize bar chart data
  const barData = useMemo(() => {
    if (data.length === 0) return null;

    // The date field is already formatted as a string (date or category name)
    // Just use it directly - don't try to parse it
    const labels = data.map(item => item.date);

    const chartData = data.map(item => {
      const value = dataKey === 'income' ? item.income :
                   dataKey === 'expense' ? Math.abs(item.expense) :
                   item.income + item.expense;
      return value / 1000; // Convert to thousands
    });

    return { labels, datasets: [{ data: chartData }] };
  }, [data, dataKey]);

  // Memoize chart configuration - MUST be before conditional return
  const chartConfig = useMemo(() => ({
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    color: (opacity = 1) => hexToRgba(chartColor, opacity),
    labelColor: (opacity = 1) => hexToRgba(theme.colors.onSurfaceVariant, opacity),
    strokeWidth: 2,
    barPercentage: 0.7,
    useShadowColorFromDataset: false,
    decimalPlaces: 1,
  }), [theme.colors.surface, chartColor, theme.colors.onSurfaceVariant]);

  if (!barData) {
    return (
      <Card style={styles.chartCard} elevation={2}>
        <Card.Content>
          <Text variant="titleMedium" style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
            {title}
          </Text>
          {subtitle && (
            <Text variant="bodySmall" style={[styles.chartSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {subtitle}
            </Text>
          )}
          <View style={styles.emptyChart}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>No data available</Text>
          </View>
        </Card.Content>
      </Card>
    );
  }

  // Calculate dynamic width based on number of bars
  const scrollChartWidth = useMemo(() => {
    const numBars = barData.labels.length;
    const calculatedWidth = numBars * barWidth;
    return Math.max(calculatedWidth, chartWidth); // Use at least the min chart width
  }, [barData.labels.length]);

  // Ref for ScrollView to scroll to end
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to the end (most recent data) when component mounts
  useEffect(() => {
    if (scrollViewRef.current && scrollChartWidth > chartWidth) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [scrollChartWidth]);

  return (
    <Card style={[styles.chartCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
      <Card.Content>
        <Text variant="titleMedium" style={[styles.chartTitle, { color: theme.colors.onSurface }]}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="bodySmall" style={[styles.chartSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            {subtitle}
        </Text>
        )}
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={true}
          ref={scrollViewRef}
          style={styles.chartScrollView}
          contentContainerStyle={styles.chartScrollContent}
        >
          <RNBarChart
            data={barData}
            width={scrollChartWidth}
            height={280}
            chartConfig={{
              ...chartConfig,
              propsForLabels: {
                fontSize: 11,
              },
            }}
            style={styles.chart}
            yAxisLabel=""
            yAxisSuffix="k"
            showValuesOnTopOfBars
            fromZero
            verticalLabelRotation={90}
          />
        </ScrollView>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  chartCard: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  chartTitle: {
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  chartSubtitle: {
    marginBottom: spacing.md,
  },
  chart: {
    marginVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  chartScrollView: {
    marginVertical: spacing.sm,
  },
  chartScrollContent: {
    paddingBottom: 40, // Extra space for rotated labels
  },
  emptyChart: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.xs,
  },
  legendText: {
    fontSize: 12,
  },
  categoryLegend: {
    marginTop: spacing.md,
  },
  categoryLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: spacing.md,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoryAmount: {
    fontSize: 12,
  },
  moreCategories: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
});