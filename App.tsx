import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from './src/contexts/AuthContext';
import Navigation from './src/navigation/Navigation';
import asyncStorageService from './src/services/asyncStorage';
import llmTransactionService from './src/services/llmTransactionService';
import { lightTheme, darkTheme } from './src/theme/materialTheme';
import ErrorBoundary from './src/components/ErrorBoundary';
import currencyUtils from './src/utils/currencyUtils';

export default function App() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  useEffect(() => {
    // Initialize storage on app start
    const initStorage = async () => {
      try {
        console.log('App: Initializing AsyncStorage...');
        await asyncStorageService.initializeDatabase();
        console.log('App: AsyncStorage initialized successfully');
      } catch (error) {
        console.error('App: AsyncStorage initialization failed:', error);
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

      // Initialize LLM service with saved configuration
      try {
        const savedConfig = await AsyncStorage.getItem('llm_config');
        if (savedConfig) {
          const config = JSON.parse(savedConfig);
          await llmTransactionService.initialize(config);
          console.log('App: LLM service initialized with provider:', config.provider);
        } else {
          console.log('App: No LLM config found, using keyword-based AI');
        }
      } catch (error) {
        console.error('App: LLM service initialization failed:', error);
      }
    };
    
    initStorage();
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
