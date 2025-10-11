// Google Authentication Service for Expo
// Handles Google Sign-In integration with Firebase Auth using Expo Auth Session

import { auth } from './firebase';
import { 
  signInWithCredential, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  linkWithCredential,
  unlink
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

// Complete the auth session in the web browser
WebBrowser.maybeCompleteAuthSession();

export interface GoogleAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isEmailVerified: boolean;
  providerData: any[];
}

export interface GoogleSignInResult {
  success: boolean;
  user?: GoogleAuthUser;
  error?: string;
  isNewUser?: boolean;
}

export interface AuthStateChange {
  user: GoogleAuthUser | null;
  isLoading: boolean;
}

class GoogleAuthService {
  private static instance: GoogleAuthService;
  private authStateListeners: Array<(state: AuthStateChange) => void> = [];
  private isInitialized = false;

  // ⚠️ IMPORTANT: Replace these with your actual OAuth client IDs
  // Get them from Google Cloud Console > APIs & Services > Credentials
  private readonly googleConfig = {
    expoClientId: 'YOUR_EXPO_CLIENT_ID.apps.googleusercontent.com',
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com', 
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  };

  static getInstance(): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      GoogleAuthService.instance = new GoogleAuthService();
    }
    return GoogleAuthService.instance;
  }

  /**
   * Initialize Google Sign-In configuration
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;

      console.log('🔐 Initializing Google Auth Service...');
      
      // Set up auth state listener
      onAuthStateChanged(auth, (firebaseUser) => {
        const user = firebaseUser ? this.mapFirebaseUser(firebaseUser) : null;
        this.notifyAuthStateChange({ user, isLoading: false });
      });

      this.isInitialized = true;
      console.log('✅ Google Auth Service initialized');
    } catch (error: any) {
      console.error('❌ Google Auth initialization failed:', error);
      throw new Error(`Google Auth initialization failed: ${error.message}`);
    }
  }

  /**
   * Sign in with Google using Expo Auth Session
   */
  async signInWithGoogle(): Promise<GoogleSignInResult> {
    try {
      this.notifyAuthStateChange({ user: null, isLoading: true });

      // Create the Google auth request
      const [request, response, promptAsync] = Google.useAuthRequest({
        clientId: this.googleConfig.expoClientId,
        iosClientId: this.googleConfig.iosClientId,
        androidClientId: this.googleConfig.androidClientId,
        webClientId: this.googleConfig.webClientId,
        scopes: ['profile', 'email'],
      });

      if (!request) {
        throw new Error('Failed to create Google auth request');
      }

      // Prompt for authentication
      const result = await promptAsync();

      if (result.type === 'success') {
        const { id_token } = result.params;
        
        if (!id_token) {
          throw new Error('No ID token received from Google');
        }

        // Create Firebase credential
        const googleCredential = GoogleAuthProvider.credential(id_token);
        
        // Sign in to Firebase
        const userCredential = await signInWithCredential(auth, googleCredential);
        const firebaseUser = userCredential.user;
        
        const user = this.mapFirebaseUser(firebaseUser);
        
        console.log('✅ Google Sign-In successful:', user.email);
        
        return {
          success: true,
          user,
          isNewUser: userCredential.providerId === 'google.com'
        };
      } else if (result.type === 'cancel') {
        console.log('📱 User cancelled Google Sign-In');
        return { success: false, error: 'User cancelled sign-in' };
      } else {
        throw new Error('Google Sign-In failed');
      }

    } catch (error: any) {
      console.error('❌ Google Sign-In failed:', error);
      this.notifyAuthStateChange({ user: null, isLoading: false });
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign out from both Google and Firebase
   */
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🚪 Signing out...');
      
      // Sign out from Firebase
      await signOut(auth);
      
      console.log('✅ Sign-out successful');
      return { success: true };
    } catch (error: any) {
      console.error('❌ Sign-out failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): GoogleAuthUser | null {
    const firebaseUser = auth.currentUser;
    return firebaseUser ? this.mapFirebaseUser(firebaseUser) : null;
  }

  /**
   * Check if user is currently signed in
   */
  isSignedIn(): boolean {
    return auth.currentUser !== null;
  }

  /**
   * Listen to authentication state changes
   */
  onAuthStateChanged(callback: (state: AuthStateChange) => void): () => void {
    this.authStateListeners.push(callback);
    
    // Call immediately with current state
    const currentUser = this.getCurrentUser();
    callback({ user: currentUser, isLoading: false });
    
    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  /**
   * Link Google account to existing Firebase user
   */
  async linkGoogleAccount(): Promise<{ success: boolean; error?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No user is currently signed in');
      }

      // Create the Google auth request
      const [request, response, promptAsync] = Google.useAuthRequest({
        clientId: this.googleConfig.expoClientId,
        iosClientId: this.googleConfig.iosClientId,
        androidClientId: this.googleConfig.androidClientId,
        webClientId: this.googleConfig.webClientId,
        scopes: ['profile', 'email'],
      });

      if (!request) {
        throw new Error('Failed to create Google auth request');
      }

      const result = await promptAsync();

      if (result.type === 'success') {
        const { id_token } = result.params;
        const googleCredential = GoogleAuthProvider.credential(id_token);
        
        await linkWithCredential(currentUser, googleCredential);
        
        console.log('✅ Google account linked successfully');
        return { success: true };
      } else {
        throw new Error('Google account linking cancelled or failed');
      }
    } catch (error: any) {
      console.error('❌ Google account linking failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unlink Google account from Firebase user
   */
  async unlinkGoogleAccount(): Promise<{ success: boolean; error?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No user is currently signed in');
      }

      await unlink(currentUser, GoogleAuthProvider.PROVIDER_ID);
      
      console.log('✅ Google account unlinked successfully');
      return { success: true };
    } catch (error: any) {
      console.error('❌ Google account unlinking failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's linked providers
   */
  getLinkedProviders(): string[] {
    const currentUser = auth.currentUser;
    if (!currentUser) return [];
    
    return currentUser.providerData.map(provider => provider.providerId);
  }

  /**
   * Check if Google account is linked
   */
  isGoogleLinked(): boolean {
    return this.getLinkedProviders().includes(GoogleAuthProvider.PROVIDER_ID);
  }

  // Private helper methods

  private mapFirebaseUser(firebaseUser: FirebaseUser): GoogleAuthUser {
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      isEmailVerified: firebaseUser.emailVerified,
      providerData: firebaseUser.providerData,
    };
  }

  private notifyAuthStateChange(state: AuthStateChange): void {
    this.authStateListeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }
}

export default GoogleAuthService.getInstance();