// Authentication context and hooks
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User as FirebaseUser, 
  signInWithCredential, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { User } from '../models/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import preferencesService from '../services/preferences';
// Use Expo-compatible services
// import googleAuthService, { GoogleAuthUser } from '../services/googleAuthService.expo';
// import firebaseSyncService from '../services/firebaseSyncService.expo';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGoogleUser: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsDemo: (defaultCurrency?: string) => Promise<void>;
  logout: () => Promise<void>;
  linkGoogleAccount: () => Promise<void>;
  unlinkGoogleAccount: () => Promise<void>;
  error: string | null;
  // Currency helpers
  getUserDefaultCurrency: () => Promise<string>;
  setUserDefaultCurrency: (currency: string) => Promise<void>;
  // Sync helpers
  startSync: () => Promise<void>;
  stopSync: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleUser, setIsGoogleUser] = useState(false);

  useEffect(() => {
    // Initialize Google Auth Service
    googleAuthService.initialize().catch(console.error);
    
    // Load user from AsyncStorage on app start
    loadStoredUser();
    
    // Set up Google Auth state listener
    const unsubscribe = googleAuthService.onAuthStateChanged(async (googleUser) => {
      if (googleUser) {
        // Convert GoogleAuthUser to User
        const prefs = await preferencesService.getPreferences();
        
        const user: User = {
          id: googleUser.uid,
          email: googleUser.email || '',
          displayName: googleUser.displayName || undefined,
          photoURL: googleUser.photoURL || undefined,
          defaultCurrency: prefs.currency,
          createdAt: new Date() // Firebase user creation time would be better
        };
        
        setUser(user);
        setIsGoogleUser(googleUser.provider === 'google');
        await AsyncStorage.setItem('user', JSON.stringify(user));
        
        // Start sync service for Google users
        if (googleUser.provider === 'google') {
          await startSync();
        }
      } else {
        // User signed out
        setUser(null);
        setIsGoogleUser(false);
        stopSync();
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const loadStoredUser = async () => {
    try {
      setIsLoading(true);
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser({
          ...parsedUser,
          createdAt: new Date(parsedUser.createdAt)
        });
      }
    } catch (error) {
      console.error('Error loading stored user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Use our Google Auth Service
      const googleUser = await googleAuthService.signInWithGoogle();
      console.log('✅ Successfully signed in with Google:', googleUser.email);
      
      // The auth state listener will handle setting the user
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Google Sign-in failed';
      setError(errorMessage);
      console.error('Google sign-in error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const linkGoogleAccount = async () => {
    try {
      setError(null);
      const googleUser = await googleAuthService.linkGoogleAccount();
      console.log('✅ Google account linked:', googleUser.email);
      setIsGoogleUser(true);
      
      // Start sync after linking
      await startSync();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to link Google account';
      setError(errorMessage);
      console.error('Link Google account error:', err);
    }
  };

  const unlinkGoogleAccount = async () => {
    try {
      setError(null);
      await googleAuthService.unlinkGoogleAccount();
      console.log('✅ Google account unlinked');
      setIsGoogleUser(false);
      
      // Stop sync after unlinking
      stopSync();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unlink Google account';
      setError(errorMessage);
      console.error('Unlink Google account error:', err);
    }
  };

  const startSync = async () => {
    try {
      await firebaseSyncService.initialize();
      console.log('✅ Sync service started');
    } catch (err) {
      console.error('Failed to start sync service:', err);
    }
  };

  const stopSync = () => {
    firebaseSyncService.stopAutoSync();
    console.log('⏸️ Sync service stopped');
  };

  const signInAsDemo = async (defaultCurrency: string = 'USD') => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Set the default currency in preferences
      await preferencesService.setCurrency(defaultCurrency);
      
      const demoUser: User = {
        id: 'demo_user_123',
        email: 'demo@example.com',
        displayName: 'Demo User',
        defaultCurrency: defaultCurrency,
        createdAt: new Date()
      };
      
      await AsyncStorage.setItem('user', JSON.stringify(demoUser));
      setUser(demoUser);
      console.log(`✅ Demo user signed in with default currency: ${defaultCurrency}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Demo sign-in failed';
      setError(errorMessage);
      console.error('Demo sign-in error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setError(null);
      
      // Stop sync service
      stopSync();
      
      // Clear user from AsyncStorage (for demo users)
      await AsyncStorage.removeItem('user');
      
      // Sign out from Google/Firebase
      if (isGoogleUser || googleAuthService.isSignedIn()) {
        await googleAuthService.signOut();
      } else {
        // Sign out from Firebase if authenticated with email
        if (auth.currentUser) {
          await signOut(auth);
        }
      }
      
      // Clear local state
      setUser(null);
      setIsGoogleUser(false);
      
      console.log('✅ Successfully logged out');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Logout failed';
      setError(errorMessage);
      console.error('Logout error:', err);
    }
  };

  // Currency helper methods
  const getUserDefaultCurrency = async (): Promise<string> => {
    if (user?.defaultCurrency) {
      return user.defaultCurrency;
    }
    // Fallback to preferences
    const prefs = await preferencesService.getPreferences();
    return prefs.currency;
  };

  const setUserDefaultCurrency = async (currency: string): Promise<void> => {
    // Update preferences
    await preferencesService.setCurrency(currency);
    
    // Update user object
    if (user) {
      const updatedUser: User = {
        ...user,
        defaultCurrency: currency
      };
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      console.log(`✅ User default currency updated to: ${currency}`);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isGoogleUser,
    signInWithGoogle,
    signInAsDemo,
    logout,
    linkGoogleAccount,
    unlinkGoogleAccount,
    error,
    getUserDefaultCurrency,
    setUserDefaultCurrency,
    startSync,
    stopSync
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};