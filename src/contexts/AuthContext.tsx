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

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsDemo: () => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
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
        const user: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || undefined,
          photoURL: firebaseUser.photoURL || undefined,
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

  const signInAsDemo = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      const demoUser: User = {
        id: 'demo_user_123',
        email: 'demo@example.com',
        displayName: 'Demo User',
        createdAt: new Date()
      };
      
      await AsyncStorage.setItem('user', JSON.stringify(demoUser));
      setUser(demoUser);
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

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signInWithGoogle,
    signInAsDemo,
    logout,
    error
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