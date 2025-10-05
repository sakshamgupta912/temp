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

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsDemo: (defaultCurrency?: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  // Currency helpers
  getUserDefaultCurrency: () => Promise<string>;
  setUserDefaultCurrency: (currency: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load user from AsyncStorage on app start
    loadStoredUser();
    
    // Set up Firebase auth state listener (for future Firebase integration)
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Get user's default currency from preferences
        const prefs = await preferencesService.getPreferences();
        
        const user: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || undefined,
          photoURL: firebaseUser.photoURL || undefined,
          defaultCurrency: prefs.currency, // Add default currency
          createdAt: new Date(firebaseUser.metadata.creationTime || Date.now())
        };
        setUser(user);
        await AsyncStorage.setItem('user', JSON.stringify(user));
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
      
      // Note: This is a placeholder for Google Sign-In
      // In a real app, you would use expo-auth-session or @react-native-google-signin
      // to get the Google ID token and then create a credential
      
      console.log('Google Sign-In not implemented yet');
      // Example implementation would be:
      // const result = await Google.logInAsync({ ... });
      // const credential = GoogleAuthProvider.credential(result.idToken);
      // await signInWithCredential(auth, credential);
      
      throw new Error('Google Sign-In not implemented in this demo');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign-in failed';
      setError(errorMessage);
      console.error('Google sign-in error:', err);
    } finally {
      setIsLoading(false);
    }
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
      // Clear user from AsyncStorage (for demo users)
      await AsyncStorage.removeItem('user');
      setUser(null);
      
      // Sign out from Firebase if authenticated
      if (auth.currentUser) {
        await signOut(auth);
      }
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
    signInWithGoogle,
    signInAsDemo,
    logout,
    error,
    getUserDefaultCurrency,
    setUserDefaultCurrency
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