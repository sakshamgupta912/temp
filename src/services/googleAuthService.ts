// Google Authentication Service
// Handles Google Sign-In integration with Firebase Auth

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin, User as GoogleUser } from '@react-native-google-signin/google-signin';
import { googleSignInConfig } from '../config/firebaseConfig';

export interface GoogleAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  provider: 'google' | 'email';
  idToken?: string;
}

class GoogleAuthService {
  private static instance: GoogleAuthService;
  private initialized = false;

  static getInstance(): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      GoogleAuthService.instance = new GoogleAuthService();
    }
    return GoogleAuthService.instance;
  }

  /**
   * Initialize Google Sign-In
   * Must be called before using any Google Sign-In features
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await GoogleSignin.configure(googleSignInConfig);
      this.initialized = true;
      console.log('✅ Google Sign-In initialized');
    } catch (error) {
      console.error('❌ Error initializing Google Sign-In:', error);
      throw error;
    }
  }

  /**
   * Sign in with Google
   * Opens Google Sign-In prompt and authenticates with Firebase
   */
  async signInWithGoogle(): Promise<GoogleAuthUser> {
    try {
      // Ensure Google Sign-In is initialized
      await this.initialize();

      // Check if device supports Google Play Services (Android)
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Get user info from Google
      const { idToken, user } = await GoogleSignin.signIn();

      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      // Create Firebase credential
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);

      // Sign in with Firebase
      const userCredential = await auth().signInWithCredential(googleCredential);

      console.log('✅ Successfully signed in with Google');
      
      return this.mapFirebaseUser(userCredential.user, 'google', idToken);
    } catch (error: any) {
      console.error('❌ Error signing in with Google:', error);
      
      // Handle specific error codes
      if (error.code === 'auth/account-exists-with-different-credential') {
        throw new Error('An account already exists with the same email but different sign-in credentials.');
      }
      
      if (error.code === 'auth/invalid-credential') {
        throw new Error('The credential is invalid or has expired.');
      }

      throw error;
    }
  }

  /**
   * Sign out from Google and Firebase
   */
  async signOut(): Promise<void> {
    try {
      // Sign out from Google
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (isSignedIn) {
        await GoogleSignin.signOut();
      }

      // Sign out from Firebase
      await auth().signOut();

      console.log('✅ Successfully signed out');
    } catch (error) {
      console.error('❌ Error signing out:', error);
      throw error;
    }
  }

  /**
   * Get current Firebase user
   */
  getCurrentUser(): FirebaseAuthTypes.User | null {
    return auth().currentUser;
  }

  /**
   * Get current user as GoogleAuthUser
   */
  async getCurrentAuthUser(): Promise<GoogleAuthUser | null> {
    const firebaseUser = this.getCurrentUser();
    if (!firebaseUser) return null;

    const provider = firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email';
    const idToken = await firebaseUser.getIdToken();

    return this.mapFirebaseUser(firebaseUser, provider, idToken);
  }

  /**
   * Check if user is signed in
   */
  isSignedIn(): boolean {
    return !!this.getCurrentUser();
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChanged(callback: (user: GoogleAuthUser | null) => void): () => void {
    return auth().onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const provider = firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email';
        const idToken = await firebaseUser.getIdToken();
        callback(this.mapFirebaseUser(firebaseUser, provider, idToken));
      } else {
        callback(null);
      }
    });
  }

  /**
   * Get ID token for API calls
   */
  async getIdToken(forceRefresh = false): Promise<string | null> {
    try {
      const user = this.getCurrentUser();
      if (!user) return null;

      return await user.getIdToken(forceRefresh);
    } catch (error) {
      console.error('❌ Error getting ID token:', error);
      return null;
    }
  }

  /**
   * Revoke access to Google account
   */
  async revokeAccess(): Promise<void> {
    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (isSignedIn) {
        await GoogleSignin.revokeAccess();
      }
      console.log('✅ Access revoked');
    } catch (error) {
      console.error('❌ Error revoking access:', error);
      throw error;
    }
  }

  /**
   * Check if current user signed in with Google
   */
  async isGoogleUser(): Promise<boolean> {
    const user = this.getCurrentUser();
    if (!user) return false;

    const provider = user.providerData[0]?.providerId;
    return provider === 'google.com';
  }

  /**
   * Get user profile from Google (if signed in with Google)
   */
  async getGoogleUserProfile(): Promise<GoogleUser | null> {
    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (!isSignedIn) return null;

      return await GoogleSignin.getCurrentUser();
    } catch (error) {
      console.error('❌ Error getting Google user profile:', error);
      return null;
    }
  }

  /**
   * Link Google account to existing Firebase account
   */
  async linkGoogleAccount(): Promise<GoogleAuthUser> {
    try {
      await this.initialize();

      const { idToken } = await GoogleSignin.signIn();
      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const user = this.getCurrentUser();
      
      if (!user) {
        throw new Error('No user is currently signed in');
      }

      const userCredential = await user.linkWithCredential(googleCredential);

      console.log('✅ Google account linked successfully');
      
      return this.mapFirebaseUser(userCredential.user, 'google', idToken);
    } catch (error: any) {
      console.error('❌ Error linking Google account:', error);
      
      if (error.code === 'auth/credential-already-in-use') {
        throw new Error('This Google account is already linked to another user.');
      }
      
      if (error.code === 'auth/provider-already-linked') {
        throw new Error('A Google account is already linked to this user.');
      }

      throw error;
    }
  }

  /**
   * Unlink Google account from Firebase account
   */
  async unlinkGoogleAccount(): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        throw new Error('No user is currently signed in');
      }

      await user.unlink('google.com');
      console.log('✅ Google account unlinked');
    } catch (error) {
      console.error('❌ Error unlinking Google account:', error);
      throw error;
    }
  }

  /**
   * Re-authenticate user with Google
   * Required for sensitive operations like account deletion
   */
  async reauthenticateWithGoogle(): Promise<void> {
    try {
      await this.initialize();

      const { idToken } = await GoogleSignin.signIn();
      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const user = this.getCurrentUser();
      
      if (!user) {
        throw new Error('No user is currently signed in');
      }

      await user.reauthenticateWithCredential(googleCredential);
      console.log('✅ Re-authenticated successfully');
    } catch (error) {
      console.error('❌ Error re-authenticating:', error);
      throw error;
    }
  }

  /**
   * Helper: Map Firebase user to GoogleAuthUser
   */
  private mapFirebaseUser(
    user: FirebaseAuthTypes.User,
    provider: 'google' | 'email',
    idToken?: string
  ): GoogleAuthUser {
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      isAnonymous: user.isAnonymous,
      provider,
      idToken,
    };
  }
}

export default GoogleAuthService.getInstance();
