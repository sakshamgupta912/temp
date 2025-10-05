import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import { AuthProvider } from './src/contexts/AuthContext';
import Navigation from './src/navigation/Navigation';
import databaseService from './src/services/database';
import asyncStorageService from './src/services/asyncStorage';
import { lightTheme, darkTheme } from './src/theme/materialTheme';
import ErrorBoundary from './src/components/ErrorBoundary';
import currencyUtils from './src/utils/currencyUtils';

export default function App() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  useEffect(() => {
    // Initialize database on app start
    const initDatabase = async () => {
      try {
        console.log('App: Trying to initialize SQLite database...');
        await databaseService.initializeDatabase();
        console.log('App: SQLite database initialized successfully');
      } catch (error) {
        console.error('App: SQLite failed, falling back to AsyncStorage:', error);
        try {
          await asyncStorageService.initializeDatabase();
          console.log('App: AsyncStorage fallback initialized successfully');
        } catch (fallbackError) {
          console.error('App: Both SQLite and AsyncStorage failed:', fallbackError);
        }
      }
      
      // Initialize currency system
      try {
        const validation = await currencyUtils.validateCurrencySetup();
        if (validation.isValid) {
          console.log('App: Currency system validated with backend currency INR');
        } else {
          console.warn('App: Currency system issues:', validation.issues);
        }
      } catch (error) {
        console.error('App: Currency system validation failed:', error);
      }
    };
    
    initDatabase();
  }, []);  return (
    <ErrorBoundary>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <Navigation />
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </AuthProvider>
      </PaperProvider>
    </ErrorBoundary>
  );
}
