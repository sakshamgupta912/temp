// Enhanced Authentication Context with Firebase Google Auth
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../models/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../services/firebase';
import { 
  GoogleAuthProvider, 
  signInWithCredential, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser 
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';

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

  // Google OAuth configuration - Update with your client IDs
  const googleConfig = {
    expoClientId: 'YOUR_EXPO_CLIENT_ID.apps.googleusercontent.com',
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  };

  useEffect(() => {
    // Initialize auth state
    loadUserFromStorage();
    
    // Listen to Firebase auth changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const userData: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || '',
          defaultCurrency: 'USD', // Can be updated later
          createdAt: new Date(),
        };
        setUser(userData);
        AsyncStorage.setItem('current_user', JSON.stringify(userData));
      } else {
        setUser(null);
        AsyncStorage.removeItem('current_user');
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const loadUserFromStorage = async () => {
    try {
      // Firebase auth state will handle user loading
      // This is just a fallback for offline scenarios
      const userData = await AsyncStorage.getItem('current_user');
      if (userData && !auth.currentUser) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading user from storage:', error);
    }
    // Don't set loading to false here - let Firebase auth handle it
  };

  // Real Google Sign-In implementation
  const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      
      // Check if Google OAuth is configured
      if (!googleConfig.webClientId || googleConfig.webClientId.includes('YOUR_')) {
        console.log('🔧 Google OAuth not configured - using demo flow');
        return { 
          success: false, 
          error: 'Google OAuth client IDs not configured. Please update googleConfig in AuthContext.' 
        };
      }

      // Create Google auth request
      const [request, response, promptAsync] = Google.useAuthRequest({
        clientId: googleConfig.webClientId,
        scopes: ['profile', 'email'],
      });

      if (!request) {
        throw new Error('Failed to create Google auth request');
      }

      // Prompt for authentication
      console.log('🔐 Starting Google Sign-In...');
      const result = await promptAsync();

      if (result.type === 'success') {
        const { id_token } = result.params;
        
        if (!id_token) {
          throw new Error('No ID token received from Google');
        }

        // Create Firebase credential and sign in
        const googleCredential = GoogleAuthProvider.credential(id_token);
        const userCredential = await signInWithCredential(auth, googleCredential);
        
        console.log('✅ Google Sign-In successful:', userCredential.user.email);
        return { success: true };
        
      } else if (result.type === 'cancel') {
        console.log('📱 User cancelled Google Sign-In');
        return { success: false, error: 'User cancelled sign-in' };
      } else {
        throw new Error('Google Sign-In failed');
      }

    } catch (error: any) {
      console.error('❌ Google Sign-In error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
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
      setIsLoading(true);
      await firebaseSignOut(auth);
      console.log('✅ Signed out successfully');
    } catch (error: any) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
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