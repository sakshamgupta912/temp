// Simplified Authentication Context - Temporary version without Firebase services
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../models/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Auth methods
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  linkGoogleAccount: () => Promise<{ success: boolean; error?: string }>;
  unlinkGoogleAccount: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  
  // Sync methods (placeholder)
  enableSync: () => Promise<void>;
  disableSync: () => void;
  syncNow: () => Promise<{ success: boolean; message: string }>;
  getSyncStatus: () => any;
  onSyncStatusChange: (callback: (status: any) => void) => () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize auth state
    loadUserFromStorage();
  }, []);

  const loadUserFromStorage = async () => {
    try {
      const userData = await AsyncStorage.getItem('current_user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading user from storage:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Placeholder implementations - will be replaced with Firebase services
  const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    // TODO: Implement with Firebase Google Auth
    console.log('🔧 Google Sign-In not yet implemented - Firebase services disabled');
    return { success: false, error: 'Firebase services not yet configured' };
  };

  const linkGoogleAccount = async (): Promise<{ success: boolean; error?: string }> => {
    // TODO: Implement with Firebase
    return { success: false, error: 'Not implemented yet' };
  };

  const unlinkGoogleAccount = async (): Promise<{ success: boolean; error?: string }> => {
    // TODO: Implement with Firebase
    return { success: false, error: 'Not implemented yet' };
  };

  const signOut = async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem('current_user');
      setUser(null);
      console.log('✅ Signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const enableSync = async (): Promise<void> => {
    // TODO: Implement with Firebase sync
    console.log('🔧 Sync not yet implemented');
  };

  const disableSync = (): void => {
    // TODO: Implement
    console.log('🔧 Sync disabled');
  };

  const syncNow = async (): Promise<{ success: boolean; message: string }> => {
    // TODO: Implement
    return { success: false, message: 'Sync not yet implemented' };
  };

  const getSyncStatus = () => {
    return {
      isOnline: true,
      lastSyncTime: null,
      isSyncing: false,
      pendingChanges: 0,
      error: 'Sync not yet implemented'
    };
  };

  const onSyncStatusChange = (callback: (status: any) => void) => {
    // TODO: Implement
    return () => {}; // Unsubscribe function
  };

  const contextValue: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    signInWithGoogle,
    linkGoogleAccount,
    unlinkGoogleAccount,
    signOut,
    enableSync,
    disableSync,
    syncNow,
    getSyncStatus,
    onSyncStatusChange,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;