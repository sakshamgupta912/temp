// Main navigation structure with Material Design
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

// Import screens (we'll create these next)
import DashboardScreen from '../screens/DashboardScreen';
import BooksScreen from '../screens/BooksScreen';
import AddBookScreen from '../screens/AddBookScreen';
import EditBookScreen from '../screens/EditBookScreen';
import BookDetailScreen from '../screens/BookDetailScreen';
import AddEntryScreen from '../screens/AddEntryScreen';
import EditEntryScreen from '../screens/EditEntryScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CategoryManagementScreen from '../screens/CategoryManagementScreen';
import PreferencesScreen from '../screens/PreferencesScreen';
import DataExportScreen from '../screens/DataExportScreen';
import AboutScreen from '../screens/AboutScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import DebugScreen from '../screens/DebugScreen';

import { useAuth } from '../contexts/AuthContext';

// Stack Navigator Types
export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Onboarding: undefined;
  Main: undefined;
  AddBook: undefined;
  EditBook: { bookId: string };
  BookDetail: { bookId: string; bookName: string };
  AddEntry: { bookId: string };
  EditEntry: { entryId: string };
  CategoryManagement: undefined;
  Preferences: undefined;
  DataExport: undefined;
  About: undefined;
  Debug: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Books: undefined;
  Analytics: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabs: React.FC = () => {
  const theme = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof MaterialIcons.glyphMap;

          if (route.name === 'Dashboard') {
            iconName = 'dashboard';
          } else if (route.name === 'Books') {
            iconName = 'book';
          } else if (route.name === 'Analytics') {
            iconName = 'analytics';
          } else if (route.name === 'Settings') {
            iconName = 'settings';
          } else {
            iconName = 'help';
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontFamily: 'Roboto-Medium',
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 4,
        },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 20,
          fontFamily: 'Roboto-Medium',
        },
        headerTitleAlign: 'left',
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{ 
          title: 'Dashboard',
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen 
        name="Books" 
        component={BooksScreen}
        options={{ 
          title: 'My Books',
          tabBarLabel: 'Books',
        }}
      />
      <Tab.Screen 
        name="Analytics" 
        component={AnalyticsScreen}
        options={{ 
          title: 'Analytics',
          tabBarLabel: 'Analytics',
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ 
          title: 'Settings',
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
};

const LoadingScreen: React.FC = () => {
  const theme = useTheme();
  
  return (
    <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text variant="bodyLarge" style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
        Loading...
      </Text>
    </View>
  );
};

const Navigation: React.FC = () => {
  const { isAuthenticated, isLoading, user, needsOnboarding } = useAuth();
  const theme = useTheme();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.surface,
            shadowColor: theme.colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 4,
          },
          headerTintColor: theme.colors.onSurface,
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
            fontFamily: 'Roboto-Medium',
          },
          headerTitleAlign: 'left',
        }}
      >
        {!isAuthenticated ? (
          <>
            <Stack.Screen 
              name="Login" 
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="SignUp" 
              component={SignUpScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : needsOnboarding ? (
          <>
            <Stack.Screen 
              name="Onboarding" 
              component={OnboardingScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen 
              name="Main" 
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="AddBook" 
              component={AddBookScreen}
              options={{ 
                title: 'Create Book',
                headerStyle: {
                  backgroundColor: theme.colors.surface,
                  shadowColor: theme.colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 4,
                },
              }}
            />
            <Stack.Screen 
              name="EditBook" 
              component={EditBookScreen}
              options={{ 
                title: 'Edit Book',
                headerStyle: {
                  backgroundColor: theme.colors.surface,
                  shadowColor: theme.colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 4,
                },
              }}
            />
            <Stack.Screen 
              name="BookDetail" 
              component={BookDetailScreen}
              options={({ route }) => ({ 
                title: route.params?.bookName || 'Book Details',
                headerStyle: {
                  backgroundColor: theme.colors.surface,
                  shadowColor: theme.colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 4,
                },
              })}
            />
            <Stack.Screen 
              name="AddEntry" 
              component={AddEntryScreen}
              options={{ 
                title: 'Add Entry',
                headerStyle: {
                  backgroundColor: theme.colors.surface,
                  shadowColor: theme.colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 4,
                },
              }}
            />
            <Stack.Screen 
              name="EditEntry" 
              component={EditEntryScreen}
              options={{ 
                title: 'Edit Entry',
                headerStyle: {
                  backgroundColor: theme.colors.surface,
                  shadowColor: theme.colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 4,
                },
              }}
            />
            <Stack.Screen 
              name="CategoryManagement" 
              component={CategoryManagementScreen}
              options={{ 
                title: 'Manage Categories',
                headerStyle: {
                  backgroundColor: theme.colors.surface,
                  shadowColor: theme.colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 4,
                },
              }}
            />
            <Stack.Screen 
              name="Preferences" 
              component={PreferencesScreen}
              options={{ 
                title: 'Preferences',
                headerStyle: {
                  backgroundColor: theme.colors.surface,
                  shadowColor: theme.colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 4,
                },
              }}
            />
            <Stack.Screen 
              name="DataExport" 
              component={DataExportScreen}
              options={{ 
                title: 'Export Data',
                headerStyle: {
                  backgroundColor: theme.colors.surface,
                  shadowColor: theme.colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 4,
                },
              }}
            />
            <Stack.Screen 
              name="About" 
              component={AboutScreen}
              options={{ 
                title: 'About',
                headerStyle: {
                  backgroundColor: theme.colors.surface,
                  shadowColor: theme.colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 4,
                },
              }}
            />
            <Stack.Screen 
              name="Debug" 
              component={DebugScreen}
              options={{ 
                title: 'Debug Storage',
                headerStyle: {
                  backgroundColor: theme.colors.surface,
                  shadowColor: theme.colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 4,
                },
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
});

export default Navigation;