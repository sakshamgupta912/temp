// Chart utilities and data processing for analytics
import { Entry } from '../models/types';

export interface ChartData {
  x: string | number;
  y: number;
  label?: string;
  color?: string;
}

export interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  color: string;
}

export interface TrendData {
  date: string;
  income: number;
  expense: number;
  balance: number;
}

// Generate colors for categories using Material Design palette
const CATEGORY_COLORS = [
  '#1976D2', // Primary Blue
  '#388E3C', // Green
  '#F57C00', // Orange
  '#7B1FA2', // Purple
  '#D32F2F', // Red
  '#0097A7', // Cyan
  '#5D4037', // Brown
  '#616161', // Gray
  '#E64A19', // Deep Orange
  '#303F9F', // Indigo
  '#C2185B', // Pink
  '#00796B', // Teal
];

export const getCategoryColor = (index: number): string => {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
};

// Process entries for category breakdown
export const processCategoryData = (entries: Entry[]): CategoryData[] => {
  const categoryMap = new Map<string, { amount: number; count: number }>();
  const totalExpenses = entries
    .filter(entry => entry.amount < 0)
    .reduce((sum, entry) => sum + Math.abs(entry.amount), 0);

  // Group expenses by category
  entries
    .filter(entry => entry.amount < 0)
    .forEach(entry => {
      const existing = categoryMap.get(entry.category) || { amount: 0, count: 0 };
      categoryMap.set(entry.category, {
        amount: existing.amount + Math.abs(entry.amount),
        count: existing.count + 1
      });
    });

  // Convert to array and calculate percentages
  const categoryData: CategoryData[] = Array.from(categoryMap.entries())
    .map(([category, data], index) => ({
      category,
      amount: data.amount,
      count: data.count,
      percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
      color: getCategoryColor(index)
    }))
    .sort((a, b) => b.amount - a.amount);

  return categoryData;
};

// Process entries for monthly trend analysis
export const processMonthlyTrends = (entries: Entry[], months: number = 6): TrendData[] => {
  const now = new Date();
  const trendData: TrendData[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

    const monthEntries = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= monthStart && entryDate <= monthEnd;
    });

    const income = monthEntries
      .filter(entry => entry.amount > 0)
      .reduce((sum, entry) => sum + entry.amount, 0);
    
    const expense = Math.abs(monthEntries
      .filter(entry => entry.amount < 0)
      .reduce((sum, entry) => sum + entry.amount, 0));

    const monthName = targetDate.toLocaleDateString('en-IN', { 
      month: 'short',
      year: '2-digit'
    });

    trendData.push({
      date: monthName,
      income,
      expense,
      balance: income - expense
    });
  }

  return trendData;
};

// Process entries for weekly spending trends
export const processWeeklyTrends = (entries: Entry[], weeks: number = 8): TrendData[] => {
  const now = new Date();
  const trendData: TrendData[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (i * 7 + now.getDay()));
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekEntries = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= weekStart && entryDate <= weekEnd;
    });

    const income = weekEntries
      .filter(entry => entry.amount > 0)
      .reduce((sum, entry) => sum + entry.amount, 0);
    
    const expense = Math.abs(weekEntries
      .filter(entry => entry.amount < 0)
      .reduce((sum, entry) => sum + entry.amount, 0));

    const weekLabel = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;

    trendData.push({
      date: weekLabel,
      income,
      expense,
      balance: income - expense
    });
  }

  return trendData;
};

// Get financial insights from entries
export interface FinancialInsights {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  avgDailyExpense: number;
  topExpenseCategory: string;
  topExpenseCategoryAmount: number;
  savingsRate: number;
  daysOfData: number;
}

export const getFinancialInsights = (entries: Entry[]): FinancialInsights => {
  if (entries.length === 0) {
    return {
      totalIncome: 0,
      totalExpenses: 0,
      netSavings: 0,
      avgDailyExpense: 0,
      topExpenseCategory: '',
      topExpenseCategoryAmount: 0,
      savingsRate: 0,
      daysOfData: 0
    };
  }

  const income = entries
    .filter(entry => entry.amount > 0)
    .reduce((sum, entry) => sum + entry.amount, 0);

  const expenses = Math.abs(entries
    .filter(entry => entry.amount < 0)
    .reduce((sum, entry) => sum + entry.amount, 0));

  // Calculate date range
  const dates = entries.map(entry => new Date(entry.date));
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  const daysOfData = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));

  // Find top expense category
  const categoryData = processCategoryData(entries);
  const topCategory = categoryData.length > 0 ? categoryData[0] : null;

  return {
    totalIncome: income,
    totalExpenses: expenses,
    netSavings: income - expenses,
    avgDailyExpense: expenses / daysOfData,
    topExpenseCategory: topCategory?.category || '',
    topExpenseCategoryAmount: topCategory?.amount || 0,
    savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
    daysOfData
  };
};

// Format currency for display
export const formatCurrency = (amount: number): string => {
  return `₹${Math.abs(amount).toLocaleString('en-IN')}`;
};

// Format percentage for display
export const formatPercentage = (percentage: number): string => {
  return `${percentage.toFixed(1)}%`;
};