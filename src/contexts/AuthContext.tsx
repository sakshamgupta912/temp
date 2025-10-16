// Enhanced Authentication Context with Firebase Google Auth
import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User } from '../models/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, firestore } from '../services/firebase';
import { asyncStorageService } from '../services/asyncStorage';
import { preferencesService } from '../services/preferences';
import { dataCacheService } from '../services/dataCache';
import { 
  GoogleAuthProvider, 
  signInWithCredential, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  onSnapshot,
  query,
  where,
  deleteDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri, ResponseType } from 'expo-auth-session';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  
  // Auth methods
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string; needsOnboarding?: boolean }>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string; needsOnboarding?: boolean }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string; needsOnboarding?: boolean }>;
  linkGoogleAccount: () => Promise<{ success: boolean; error?: string }>;
  unlinkGoogleAccount: () => Promise<{ success: boolean; error?: string }>;
  signOut: (clearAllData?: boolean, reason?: 'manual' | 'token-expired' | 'session-expired' | 'permission-error') => Promise<void>;
  completeOnboarding: (preferences: any) => Promise<void>;
  skipOnboarding: () => Promise<void>;
  checkOnboardingStatus: () => Promise<boolean>;
  
  // Sync methods
  enableSync: () => Promise<void>;
  disableSync: () => void;
  syncNow: (isManual?: boolean) => Promise<{ success: boolean; message: string; conflicts?: any[] }>;
  getSyncStatus: () => any;
  onSyncStatusChange: (callback: (status: any) => void) => () => void;
  checkAuthHealth: () => Promise<{ healthy: boolean; message: string | null }>;
  
  // Data management
  deleteAllFirebaseData: () => Promise<void>;
  
  // Git-style conflict resolution
  conflicts: any[];
  conflictCount: number;
  clearConflicts: () => void;
  resolveConflicts: (resolutions: Map<string, 'use-local' | 'use-cloud' | any>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  
  // Auto-sync state
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  // Real-time listeners
  const firestoreListenersRef = useRef<(() => void)[]>([]);
  
  // Prevent listener from re-syncing immediately after upload
  const justUploadedRef = useRef(false);
  const lastListenerSyncRef = useRef<number>(0);
  
  // Git-style conflict state
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [conflictCount, setConflictCount] = useState(0);

  console.log('🚀 AuthProvider mounted');

  // Google OAuth configuration - Using NEW OAuth 2.0 Client ID with JavaScript origins
  const googleConfig = {
    expoClientId: '965715628931-fjajaci0tm1irupn235njgd1hpjj5j9q.apps.googleusercontent.com',
    webClientId: '965715628931-fjajaci0tm1irupn235njgd1hpjj5j9q.apps.googleusercontent.com',
    iosClientId: '965715628931-fjajaci0tm1irupn235njgd1hpjj5j9q.apps.googleusercontent.com',
    androidClientId: '965715628931-fjajaci0tm1irupn235njgd1hpjj5j9q.apps.googleusercontent.com',
  };

  // Google auth request hook - must be at component level
  // Use web browser for authentication with proper deep linking
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: googleConfig.webClientId,
    scopes: ['profile', 'email'],
    responseType: ResponseType.IdToken,
  });

  console.log('🔧 Google auth request state:', { 
    hasRequest: !!request, 
    responseType: response?.type || 'none',
    responseExists: !!response 
  });

  useEffect(() => {
    // Initialize auth state
    loadUserFromStorage();
    
    // Listen to Firebase auth changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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
        
        // Skip auto-sync on app reload (first auth event)
        // Only sync on actual sign-in or later auth changes
        if (!isInitialLoad) {
          console.log('🔄 User authenticated - checking autoSync preference...');
          
          // Check if autoSync is enabled in preferences
          const prefs = await preferencesService.getPreferences();
          if (prefs.autoSync) {
            console.log('✅ AutoSync enabled in preferences - triggering sync');
            await syncNow();
          } else {
            console.log('⏭️ AutoSync disabled in preferences - skipping sync');
          }
        } else {
          console.log('⏭️ Initial load - skipping auto-sync');
          setIsInitialLoad(false);
        }
      } else {
        // User signed out or not authenticated
        console.log('👤 No authenticated user');
        setUser(null);
        setNeedsOnboarding(false);
        setSyncEnabled(false);
        setLastSyncTime(null);
        AsyncStorage.removeItem('current_user');
        
        // Cleanup any active listeners
        cleanupRealtimeListeners();
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, [isInitialLoad]);

  // Automatic token refresh every 50 minutes (before 1-hour expiry)
  // This prevents "Missing or insufficient permissions" errors
  useEffect(() => {
    if (!user || !auth.currentUser) return;

    console.log('⏰ Starting automatic token refresh (every 24 hours)');

    const refreshInterval = setInterval(async () => {
      try {
        console.log('🔄 Auto-refreshing Firebase auth token...');
        await auth.currentUser?.getIdToken(true); // Force token refresh
        console.log('✅ Token refreshed successfully');
      } catch (error: any) {
        console.error('❌ Token refresh failed:', error.message);
        
        // If token refresh fails, user needs to re-authenticate
        if (error.code === 'auth/user-token-expired' || 
            error.code === 'auth/invalid-user-token') {
          console.error('🔐 Token expired - user needs to sign in again');
          await signOut(false, 'token-expired');
        }
      }
    }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds

    return () => {
      console.log('⏰ Stopping automatic token refresh');
      clearInterval(refreshInterval);
    };
  }, [user]);

  // Handle Google authentication response
  useEffect(() => {
    if (response) {
      console.log('🔍 Google auth response received:', response.type);
      console.log('🔍 Full response object:', JSON.stringify(response, null, 2));
      
      if (response.type === 'success') {
        console.log('✅ Google auth success, processing...');
        console.log('🔍 Response params:', JSON.stringify(response.params, null, 2));
        
        const { id_token, access_token } = response.params;
        
        if (id_token) {
          console.log('🔑 ID token received, creating Firebase credential...');
          try {
            // Create Firebase credential and sign in
            const googleCredential = GoogleAuthProvider.credential(id_token);
            signInWithCredential(auth, googleCredential)
              .then(async (userCredential) => {
                console.log('✅ Firebase sign-in successful:', userCredential.user.email);
                
                // Sync preferences from Firebase
                await preferencesService.syncWithFirebase(userCredential.user.uid);
                console.log('✅ Preferences synced from Firebase');
                
                // Enable/disable sync based on the autoSync preference
                const prefs = await preferencesService.getPreferences();
                if (prefs.autoSync) {
                  console.log('✅ AutoSync enabled in preferences - enabling cloud sync');
                  await enableSync();
                } else {
                  console.log('⏭️ AutoSync disabled in preferences - keeping sync disabled');
                }
                
                // The Firebase auth state listener will handle updating the user state
              })
              .catch((error) => {
                console.error('❌ Firebase sign-in error:', error.message);
                console.error('❌ Full Firebase error:', error);
              });
          } catch (credentialError) {
            console.error('❌ Error creating Google credential:', credentialError);
          }
        } else {
          console.error('❌ No ID token in response params');
          console.error('Available params:', Object.keys(response.params || {}));
        }
      } else if (response.type === 'error') {
        console.error('❌ Google auth error:', response.error);
      } else if (response.type === 'cancel') {
        console.log('📱 User cancelled Google authentication');
      }
    }
  }, [response]);

  // ============ CLOUD-FIRST MERGE HELPER ============
  /**
   * Merges cloud and local data with cloud-first strategy
   * Cloud items always win conflicts, local-only items are preserved
   */
  /**
   * Intelligent merge with timestamp-based conflict resolution
   * Strategy: Last-write-wins based on updatedAt timestamp
   * - If item exists in both: Keep the one with latest updatedAt
   * - If item only in cloud: Keep it (was added/updated from other device)
   * - If item only in local: Keep it (pending upload)
   * - If item marked as deleted: Respect deletion (tombstone marker for multi-device sync)
   */
  const mergeCloudFirst = (cloudData: any[], localData: any[]): any[] => {
    const merged = new Map<string, any>();
    
    // Step 1: Add all cloud items to map
    for (const cloudItem of cloudData) {
      merged.set(cloudItem.id, { ...cloudItem, source: 'cloud' });
    }
    
    // Step 2: Process local items
    for (const localItem of localData) {
      const cloudItem = merged.get(localItem.id);
      
      if (!cloudItem) {
        // Local-only item: Keep it UNLESS it's marked as deleted locally
        if (!localItem.deleted) {
          merged.set(localItem.id, { ...localItem, source: 'local-only' });
        } else {
          // Local item is deleted - keep tombstone to upload deletion to cloud
          console.log(`🗑️ Local item deleted: ${localItem.id}, will sync deletion`);
          merged.set(localItem.id, { ...localItem, source: 'local-deleted' });
        }
      } else {
        // Item exists in both: Check for deletions first, then use timestamp-based conflict resolution
        const cloudDeleted = cloudItem.deleted === true;
        const localDeleted = localItem.deleted === true;
        
        if (cloudDeleted && localDeleted) {
          // Both deleted - use the one with newer deletedAt timestamp
          const cloudDeletedAt = new Date(cloudItem.deletedAt || cloudItem.updatedAt);
          const localDeletedAt = new Date(localItem.deletedAt || localItem.updatedAt);
          merged.set(cloudItem.id, localDeletedAt > cloudDeletedAt ? { ...localItem, source: 'local-deleted-newer' } : { ...cloudItem, source: 'cloud-deleted' });
          console.log(`🗑️ Both deleted: ${cloudItem.id}, keeping ${localDeletedAt > cloudDeletedAt ? 'local' : 'cloud'} version`);
        } else if (cloudDeleted) {
          // Cloud says deleted - respect it (deletion wins over updates)
          console.log(`🗑️ Cloud deleted: ${cloudItem.id}, removing local version`);
          merged.set(cloudItem.id, { ...cloudItem, source: 'cloud-deleted' });
        } else if (localDeleted) {
          // Local says deleted - respect it (deletion wins over updates)
          console.log(`🗑️ Local deleted: ${localItem.id}, will overwrite cloud`);
          merged.set(localItem.id, { ...localItem, source: 'local-deleted' });
        } else {
          // Neither deleted: Use timestamp-based conflict resolution
          const cloudUpdatedAt = new Date(cloudItem.updatedAt || cloudItem.createdAt);
          const localUpdatedAt = new Date(localItem.updatedAt || localItem.createdAt);
          
          if (localUpdatedAt > cloudUpdatedAt) {
            // Local version is newer: Keep local (will overwrite cloud)
            console.log(`🔄 Conflict: Local version newer for ${localItem.id}, keeping local`);
            merged.set(localItem.id, { ...localItem, source: 'local-newer' });
          } else {
            // Cloud version is newer or equal: Keep cloud
            if (localUpdatedAt < cloudUpdatedAt) {
              console.log(`☁️ Conflict: Cloud version newer for ${cloudItem.id}, keeping cloud`);
            }
            merged.set(cloudItem.id, { ...cloudItem, source: 'cloud-newer' });
          }
        }
      }
    }
    
    return Array.from(merged.values());
  };

  // ============ REAL-TIME SYNC LISTENERS ============
  
  /**
   * Setup real-time Firebase listeners for multi-device sync
   * Changes on Device A immediately reflect on Device B
   */
  const setupRealtimeListeners = (userId: string, retryCount: number = 0) => {
    console.log('🎧 Setting up real-time Firestore listeners...');
    
    // Check if Firebase auth is ready
    if (!auth.currentUser) {
      if (retryCount < 5) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
        console.log(`⚠️ Firebase auth not ready, retrying in ${delay}ms... (attempt ${retryCount + 1}/5)`);
        
        setTimeout(() => {
          if (auth.currentUser && user) {
            setupRealtimeListeners(userId, retryCount + 1);
          } else if (retryCount >= 4) {
            console.error('❌ Failed to setup listeners after 5 attempts');
            console.error('🔐 Session may have expired. User needs to sign in again.');
          }
        }, delay);
        return;
      } else {
        console.error('❌ Failed to setup listeners - Auth still not ready after retries');
        console.error('🔐 User session appears invalid. Please sign in again.');
        return;
      }
    }
    
    // Clear any existing listeners
    firestoreListenersRef.current.forEach(unsubscribe => unsubscribe());
    firestoreListenersRef.current = [];
    
    try {
      // Listen to user document changes
      const userDocRef = doc(firestore, 'users', userId);
      const unsubscribeUser = onSnapshot(userDocRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          
          // Skip if we just uploaded (prevent sync loop)
          if (justUploadedRef.current) {
            console.log('⏭️ Skipping listener sync - just uploaded data');
            justUploadedRef.current = false;
            return;
          }
          
          // Debounce: Skip if synced less than 2 seconds ago (prevents rapid re-syncs)
          const now = Date.now();
          if (now - lastListenerSyncRef.current < 2000) {
            console.log('⏭️ Skipping listener sync - too soon after last sync');
            return;
          }
          lastListenerSyncRef.current = now;
          
          console.log('👤 User document changed, syncing...');
          console.log('🔀 GIT-STYLE MODE: Three-way merge (base, local, cloud)');
          
          // Extract data arrays from cloud
          const cloudBooks = userData.books || [];
          const cloudEntries = userData.entries || [];
          const cloudCategories = userData.categories || [];
          
          console.log(`📥 Cloud data: ${cloudBooks.length} books, ${cloudEntries.length} entries, ${cloudCategories.length} categories`);
          
          try {
            // Get local data for merge
            // CRITICAL: Use getAllX() to include deleted AND archived items for proper merge
            const localBooks = await asyncStorageService.getAllBooks(userId);
            const localCategories = await asyncStorageService.getAllCategories(userId);
            const localEntries = await asyncStorageService.getAllEntries(userId);
            
            console.log(`📱 Local data: ${localBooks.length} books, ${localEntries.length} entries, ${localCategories.length} categories`);
            console.log(`   (${localBooks.filter((b: any) => b.deleted).length} deleted books, ${localBooks.filter((b: any) => b.archived).length} archived books)`);
            
            // THREE-WAY MERGE using Git-style logic
            const { GitStyleSyncService } = await import('../services/gitStyleSync');
            
            const booksResult = GitStyleSyncService.mergeArrays(localBooks, cloudBooks, 'book');
            const entriesResult = GitStyleSyncService.mergeArrays(localEntries, cloudEntries, 'entry');
            const categoriesResult = GitStyleSyncService.mergeArrays(localCategories, cloudCategories, 'category');
            
            const allConflicts = [
              ...booksResult.conflicts,
              ...entriesResult.conflicts,
              ...categoriesResult.conflicts
            ];
            
            if (allConflicts.length > 0) {
              console.warn(`⚠️ Real-time listener: ${allConflicts.length} conflicts detected`);
              console.warn('Conflicts will be saved with cloud values by default');
              // TODO: Notify user about conflicts via UI
              // For now, merged data already has cloud values for conflicts
            } else {
              console.log('✅ No conflicts - auto-merged successfully');
            }
            
            // DEBUG: Log archived books after merge
            const mergedArchivedBooks = booksResult.merged.filter((b: any) => b.archived);
            if (mergedArchivedBooks.length > 0) {
              console.log('📦 Real-time listener: Archived books after merge:');
              mergedArchivedBooks.forEach((b: any) => {
                console.log(`   - ${b.name}: archived=${b.archived}, version=${b.version}`);
              });
            }
            
            // Save merged data (includes conflicts with cloud values)
            await saveDownloadedDataToLocal(userId, booksResult.merged, entriesResult.merged, categoriesResult.merged);
            
            setLastSyncTime(new Date());
            console.log('✅ Real-time sync complete - Data merged using Git-style three-way merge');
          } catch (mergeError) {
            console.error('❌ Git-style merge failed in listener, falling back to cloud data:', mergeError);
            // Fallback: Use cloud data directly
            await saveDownloadedDataToLocal(userId, cloudBooks, cloudEntries, cloudCategories);
            setLastSyncTime(new Date());
          }
        }
      }, async (error) => {
        console.error('❌ Firestore listener error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // Handle permission errors (usually means session expired)
        if (error.code === 'permission-denied' || 
            error.code === 'unauthenticated' ||
            error.message?.includes('Missing or insufficient permissions')) {
          
          console.error('🔐 Permission denied - Session expired or user unauthorized');
          console.error('🔐 Signing out user and cleaning up...');
          
          // Cleanup listeners first
          cleanupRealtimeListeners();
          
          // Disable sync
          setSyncEnabled(false);
          
          // Clear user session
          setUser(null);
          setNeedsOnboarding(false);
          await AsyncStorage.removeItem('current_user');
          
          // Note: Don't call signOut() here to avoid potential loop
          // The UI should detect user is null and redirect to login
          
          console.log('🔐 User session cleared. Please sign in again.');
        } else {
          // Other errors - just cleanup listeners but keep user signed in
          console.error('⚠️ Listener error (non-auth) - cleaning up listeners');
          cleanupRealtimeListeners();
        }
      });
      
      firestoreListenersRef.current.push(unsubscribeUser);
      console.log('✅ Real-time listeners active');
      
    } catch (error) {
      console.error('❌ Failed to setup real-time listeners:', error);
    }
  };
  
  /**
   * Cleanup real-time listeners
   */
  const cleanupRealtimeListeners = () => {
    console.log('🧹 Cleaning up real-time listeners...');
    firestoreListenersRef.current.forEach(unsubscribe => unsubscribe());
    firestoreListenersRef.current = [];
  };

  // ============ FIREBASE SYNC FUNCTIONS ============
  
  /**
   * Converts ISO date strings back to Date objects
   */
  const deserializeFirestoreData = (data: any): any => {
    if (data === null || data === undefined) {
      return data;
    }
    
    // Check if it's an ISO date string
    if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(data)) {
      return new Date(data);
    }
    
    if (Array.isArray(data)) {
      return data.map(item => deserializeFirestoreData(item));
    }
    
    if (typeof data === 'object') {
      const deserialized: any = {};
      for (const key in data) {
        deserialized[key] = deserializeFirestoreData(data[key]);
      }
      return deserialized;
    }
    
    return data;
  };
  
  /**
   * Downloads data from Firebase (master database)
   */
  const downloadFirestoreData = async (userId: string) => {
    const userDocRef = doc(firestore, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      return { books: [], entries: [], categories: [] };
    }
    
    const data = userDoc.data();
    
    // Deserialize: Convert ISO strings back to Date objects
    return {
      books: deserializeFirestoreData(data.books || []),
      entries: deserializeFirestoreData(data.entries || []),
      categories: deserializeFirestoreData(data.categories || []),
    };
  };

  /**
   * Saves merged data to AsyncStorage
   * Temporarily disables callback to prevent triggering another sync
   */
  const saveDownloadedDataToLocal = async (
    userId: string,
    books: any[],
    entries: any[],
    categories: any[]
  ) => {
    // Temporarily disable auto-sync callback during save
    const originalCallback = asyncStorageService['onDataChangedCallback' as keyof typeof asyncStorageService];
    asyncStorageService.setOnDataChanged(null);

    try {
      // CLOUD-FIRST: Completely replace local data with cloud data
      // This ensures deletions sync properly (no resurrection)
      await AsyncStorage.setItem('budget_app_books', JSON.stringify(books));
      await AsyncStorage.setItem('budget_app_entries', JSON.stringify(entries));
      await AsyncStorage.setItem('budget_app_categories', JSON.stringify(categories));
      
      // Invalidate all caches to force fresh read from storage
      const dataCacheService = (await import('../services/dataCache')).dataCacheService;
      await dataCacheService.invalidatePattern('books');
      await dataCacheService.invalidatePattern('entries');
      await dataCacheService.invalidatePattern('categories');
      
      console.log('✅ Cloud data saved to local storage (replaced completely)');
      console.log(`   📚 Books: ${books.length}, 📝 Entries: ${entries.length}, 🏷️ Categories: ${categories.length}`);
    } finally {
      // Re-enable callback
      asyncStorageService.setOnDataChanged(originalCallback as (() => void) | null);
    }
  };

  /**
   * Converts Date objects to ISO strings for Firestore compatibility
   */
  const sanitizeDataForFirestore = (data: any): any => {
    // Firestore doesn't accept undefined - convert to null or skip
    if (data === undefined) {
      return null; // Convert undefined to null for Firestore
    }
    
    if (data === null) {
      return null;
    }
    
    // Handle Date objects
    if (data instanceof Date) {
      return data.toISOString();
    }
    
    // Handle date strings that look like they came from new Date().toString()
    // or other non-ISO formats - convert to proper ISO
    if (typeof data === 'string') {
      // Try to parse as date if it looks like a date string
      const dateTest = new Date(data);
      if (!isNaN(dateTest.getTime()) && data.includes('T')) {
        // It's a valid date string, ensure it's ISO format
        return dateTest.toISOString();
      }
      return data; // Return as-is if not a date string
    }
    
    if (Array.isArray(data)) {
      return data.map(item => sanitizeDataForFirestore(item));
    }
    
    if (typeof data === 'object') {
      const sanitized: any = {};
      for (const key in data) {
        const value = sanitizeDataForFirestore(data[key]);
        // Skip undefined values in objects (Firestore doesn't accept them)
        if (value !== undefined) {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }
    
    return data;
  };

  /**
   * Uploads local data to Firebase (master database)
   */
  const syncLocalDataToFirestore = async (userId: string) => {
    // IMPORTANT: Use getAllX() methods to include deleted items (tombstones)
    // This ensures deletions sync to Firebase so other devices know about them
    const books = await asyncStorageService.getAllBooks(userId);
    const categories = await asyncStorageService.getAllCategories(userId);
    const allEntries = await asyncStorageService.getAllEntries(userId);

    console.log('📝 Raw data before sanitization:', {
      booksCount: books.length,
      entriesCount: allEntries.length,
      categoriesCount: categories.length,
      sampleBook: books[0] ? {
        id: books[0].id,
        name: books[0].name,
        currency: books[0].currency,
        archived: books[0].archived,
        archivedAt: books[0].archivedAt,
        version: books[0].version,
        hasUndefined: Object.entries(books[0]).filter(([k, v]) => v === undefined).map(([k]) => k)
      } : 'no books',
      sampleEntry: allEntries[0] ? {
        id: allEntries[0].id,
        date: allEntries[0].date,
        dateType: typeof allEntries[0].date,
        hasUndefined: Object.entries(allEntries[0]).filter(([k, v]) => v === undefined).map(([k]) => k)
      } : 'no entries'
    });

    // Sanitize data: Convert Date objects to ISO strings, remove undefined
    const sanitizedBooks = sanitizeDataForFirestore(books);
    const sanitizedEntries = sanitizeDataForFirestore(allEntries);
    const sanitizedCategories = sanitizeDataForFirestore(categories);

    console.log('🧹 Sanitized data ready for upload:', {
      booksCount: sanitizedBooks.length,
      entriesCount: sanitizedEntries.length,
      categoriesCount: sanitizedCategories.length,
      sampleBook: sanitizedBooks[0] ? {
        id: sanitizedBooks[0].id,
        name: sanitizedBooks[0].name,
        currency: sanitizedBooks[0].currency,
        archived: sanitizedBooks[0].archived,
        archivedAt: sanitizedBooks[0].archivedAt,
        version: sanitizedBooks[0].version,
        keys: Object.keys(sanitizedBooks[0]).length,
        allKeys: Object.keys(sanitizedBooks[0])
      } : 'no books',
      sampleEntry: sanitizedEntries[0] ? {
        id: sanitizedEntries[0].id,
        date: sanitizedEntries[0].date,
        dateType: typeof sanitizedEntries[0].date,
        keys: Object.keys(sanitizedEntries[0]).length
      } : 'no entries'
    });

    const userDocRef = doc(firestore, 'users', userId);
    
    // Set flag to prevent listener from re-syncing after this upload
    justUploadedRef.current = true;
    console.log('📤 Setting upload flag to prevent sync loop');
    
    await setDoc(userDocRef, {
      books: sanitizedBooks,
      entries: sanitizedEntries,
      categories: sanitizedCategories,
      lastSyncAt: serverTimestamp(),
    }, { merge: true });
  };

  /**
   * GIT-STYLE SYNC: Pull → Merge → Push
   * Like Git: Always pull (download) before push (upload)
   */
  const gitStyleSync = async (userId: string): Promise<{ success: boolean; message: string; conflicts?: any[] }> => {
    try {
      console.log('🔀 Starting Git-style sync: PULL → MERGE → PUSH');
      
      // STEP 1: PULL (Download from cloud first, like 'git pull')
      console.log('📥 PULL: Downloading latest from cloud...');
      const { books: cloudBooks, entries: cloudEntries, categories: cloudCategories } = 
        await downloadFirestoreData(userId);
      
      // STEP 2: GET LOCAL CHANGES (like 'git status')
      // IMPORTANT: Use getAllX() methods to include deleted items (tombstones)
      console.log('📱 Getting local changes (including deletions)...');
      const localBooks = await asyncStorageService.getAllBooks(userId);
      const localCategories = await asyncStorageService.getAllCategories(userId);
      const localEntries = await asyncStorageService.getAllEntries(userId);
      
      // STEP 3: MERGE (Three-way merge, like 'git merge')
      console.log('🔀 MERGE: Three-way merge (base, local, cloud)...');
      const { GitStyleSyncService } = await import('../services/gitStyleSync');
      
      const booksResult = GitStyleSyncService.mergeArrays(localBooks, cloudBooks, 'book');
      const entriesResult = GitStyleSyncService.mergeArrays(localEntries, cloudEntries, 'entry');
      const categoriesResult = GitStyleSyncService.mergeArrays(localCategories, cloudCategories, 'category');
      
      const allConflicts = [
        ...booksResult.conflicts,
        ...entriesResult.conflicts,
        ...categoriesResult.conflicts
      ];
      
      if (allConflicts.length > 0) {
        console.warn(`⚠️ CONFLICTS DETECTED: ${allConflicts.length} conflicts need resolution`);
        console.warn('Conflicts:', allConflicts);
        
        // Store conflicts in state for UI to display
        setConflicts(allConflicts);
        setConflictCount(allConflicts.length);
        
        // Save merged data locally (with cloud values for conflicts)
        await saveDownloadedDataToLocal(userId, booksResult.merged, entriesResult.merged, categoriesResult.merged);
        
        return {
          success: false,
          message: `⚠️ ${allConflicts.length} conflict(s) detected. Please resolve manually.`,
          conflicts: allConflicts
        };
      }
      
      // STEP 4: SAVE MERGED DATA LOCALLY (like updating working directory after merge)
      console.log('💾 Saving merged data locally...');
      await saveDownloadedDataToLocal(userId, booksResult.merged, entriesResult.merged, categoriesResult.merged);
      
      // STEP 5: PUSH (Upload to cloud, like 'git push')
      console.log('📤 PUSH: Uploading merged data to cloud...');
      await syncLocalDataToFirestore(userId);
      
      console.log('✅ Git-style sync complete: No conflicts');
      return {
        success: true,
        message: '✅ Sync complete'
      };
      
    } catch (error: any) {
      console.error('❌ Git-style sync failed:', error);
      return {
        success: false,
        message: `Sync failed: ${error.message}`
      };
    }
  };

  /**
   * Triggers auto-sync after debounce delay
   * Uses Git-style PULL → MERGE → PUSH
   */
  const triggerAutoSync = () => {
    if (!user) return;
    
    // Check if sync is enabled
    if (!syncEnabled) {
      console.log('⏭️ Auto-sync skipped - sync is disabled');
      return;
    }
    
    // Clear existing timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    // Set new timeout (2 second debounce)
    syncTimeoutRef.current = setTimeout(async () => {
      if (user && !isSyncingRef.current && syncEnabled) {
        console.log('⏰ Auto-sync triggered (2s debounce) - Using Git-style sync');
        
        // Check if auth is still valid
        if (!auth.currentUser) {
          console.error('❌ Auto-sync aborted - No authenticated user');
          console.error('🔐 Session may have expired');
          return;
        }
        
        // GIT-STYLE: Pull → Merge → Push
        try {
          const result = await gitStyleSync(user.id);
          
          if (result.success) {
            console.log('✅ Auto-sync complete');
            setLastSyncTime(new Date());
          } else if (result.conflicts && result.conflicts.length > 0) {
            console.warn('⚠️ Auto-sync: Conflicts detected');
            // TODO: Show conflict resolution UI
            // For now, just log the conflicts
          }
        } catch (error: any) {
          console.error('❌ Auto-sync failed:', error);
          console.error('Error code:', error?.code);
          
          // Handle auth errors
          if (error?.code === 'permission-denied' || 
              error?.code === 'unauthenticated' ||
              error?.message?.includes('Missing or insufficient permissions')) {
            
            console.error('🔐 Auto-sync failed due to permission error - Session expired');
            console.error('🔐 User needs to sign in again');
            
            // Clear session
            await signOut(false, 'permission-error');
          }
        }
      }
    }, 2000);
  };

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

  // ============ EMAIL/PASSWORD AUTHENTICATION ============
  
  const signInWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string; needsOnboarding?: boolean }> => {
    try {
      setIsLoading(true);
      console.log('🔐 Signing in with email:', email);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Email sign-in successful:', userCredential.user.email);
      
      // Sync preferences from Firebase
      await preferencesService.syncWithFirebase(userCredential.user.uid);
      console.log('✅ Preferences synced from Firebase');
      
      // Enable/disable sync based on the autoSync preference
      const prefs = await preferencesService.getPreferences();
      if (prefs.autoSync) {
        console.log('✅ AutoSync enabled in preferences - enabling cloud sync');
        await enableSync();
      } else {
        console.log('⏭️ AutoSync disabled in preferences - keeping sync disabled');
      }
      
      // Check if onboarding is needed
      const needsOnboarding = await checkOnboardingStatus();
      setNeedsOnboarding(needsOnboarding);
      
      // User state will be updated by onAuthStateChanged listener
      return { success: true, needsOnboarding };
      
    } catch (error: any) {
      console.error('❌ Email sign-in error:', error);
      
      let errorMessage = 'Failed to sign in';
      if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later';
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password';
      }
      
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string): Promise<{ success: boolean; error?: string; needsOnboarding?: boolean }> => {
    try {
      setIsLoading(true);
      console.log('📝 Creating account with email:', email);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ Account created:', userCredential.user.email);
      
      // Update display name
      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
        console.log('✅ Display name updated:', displayName);
      }
      
      // New accounts always need onboarding
      setNeedsOnboarding(true);
      
      // User state will be updated by onAuthStateChanged listener
      return { success: true, needsOnboarding: true };
      
    } catch (error: any) {
      console.error('❌ Sign-up error:', error);
      
      let errorMessage = 'Failed to create account';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/password sign-up is not enabled';
      }
      
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // ============ GOOGLE AUTHENTICATION ============
  
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

      if (!request) {
        throw new Error('Failed to create Google auth request');
      }

      // Prompt for authentication - response will be handled by useEffect
      console.log('🔐 Starting Google Sign-In...');
      const result = await promptAsync();

      if (result.type === 'cancel') {
        console.log('📱 User cancelled Google Sign-In');
        return { success: false, error: 'User cancelled sign-in' };
      } else if (result.type === 'error') {
        throw new Error(result.error?.message || 'Google Sign-In failed');
      }

      // Success will be handled by the useEffect that listens to response changes
      return { success: true };

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

  const signOut = async (
    clearAllData: boolean = false, 
    reason: 'manual' | 'token-expired' | 'session-expired' | 'permission-error' = 'manual'
  ): Promise<void> => {
    try {
      setIsLoading(true);
      
      // Log logout reason
      const reasonMessages = {
        'manual': '🚪 User initiated logout',
        'token-expired': '� Automatic logout - Auth token expired',
        'session-expired': '🔐 Automatic logout - Session expired',
        'permission-error': '🔐 Automatic logout - Permission denied'
      };
      console.log(reasonMessages[reason]);
      
      // Step 1: If sync is disabled and there's unsynced data, warn before clearing
      if (clearAllData && !syncEnabled) {
        console.warn('⚠️ Clearing all local data - some data may not be synced to cloud');
      }
      
      // Step 2: Handle automatic logout (don't attempt sync - session already invalid)
      if (reason !== 'manual') {
        console.warn('⚠️ Automatic logout detected - skipping final sync (session invalid)');
        console.warn('💾 Local data will be preserved for next login');
        // For automatic logout, always preserve data (don't clear)
        clearAllData = false;
      }
      
      // Step 3: Optionally sync unsynced data before logout (ONLY for manual logout)
      if (!clearAllData && syncEnabled && user && reason === 'manual') {
        console.log('🔄 Performing final sync before logout...');
        try {
          await syncNow(true); // Manual sync
          console.log('✅ Final sync completed');
        } catch (error) {
          console.error('❌ Final sync failed:', error);
          // Continue with logout even if sync fails
        }
      }
      
      // Step 4: Disable Firebase preferences sync
      preferencesService.disableFirebaseSync();
      console.log('🔓 Disabled Firebase preferences sync');
      
      // Step 5: Disable data sync to prevent any ongoing sync operations
      if (syncEnabled) {
        disableSync();
      }
      
      // Step 6: Cleanup real-time listeners
      cleanupRealtimeListeners();
      
      // Step 7: Clear any pending sync timeouts
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      
      // Step 8: Reset sync state
      isSyncingRef.current = false;
      setLastSyncTime(null);
      setSyncEnabled(false);
      
      // Step 9: Clear user state BEFORE Firebase signout
      setUser(null);
      setNeedsOnboarding(false);
      
      // Step 10: Clear AsyncStorage user data
      await AsyncStorage.removeItem('current_user');
      await AsyncStorage.removeItem('onboarding_completed');
      await AsyncStorage.removeItem('user_preferences');
      
      // Step 11: Clear actual data if requested (books, entries, categories, preferences)
      if (clearAllData) {
        console.log('🗑️ Clearing all local data (books, entries, categories, preferences)...');
        await AsyncStorage.removeItem('budget_app_books');
        await AsyncStorage.removeItem('budget_app_entries');
        await AsyncStorage.removeItem('budget_app_categories');
        await AsyncStorage.removeItem('preferences');
        
        // Clear data cache
        await dataCacheService.clearAll();
        
        console.log('✅ All local data cleared');
      } else {
        console.log('💾 Local data preserved (books, entries, categories remain on device)');
      }
      
      console.log('🗑️ Cleared user session data');
      
      // Step 12: Sign out from Firebase
      await firebaseSignOut(auth);
      
      console.log('✅ Signed out successfully');
    } catch (error: any) {
      console.error('❌ Error signing out:', error);
      // Even if Firebase signout fails, clear local state
      setUser(null);
      setNeedsOnboarding(false);
      await AsyncStorage.removeItem('current_user').catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  // ============ DATA MANAGEMENT ============
  
  /**
   * Delete all user data from Firebase (books, entries, categories, preferences)
   * This is used when the user wants to permanently delete all their cloud data
   * 
   * IMPORTANT: The data structure is:
   * - Main document: users/{userId} with fields: books[], entries[], categories[]
   * - Preferences: users/{userId}/preferences/settings
   */
  const deleteAllFirebaseData = async (): Promise<void> => {
    if (!user) {
      throw new Error('No user signed in');
    }

    console.log('🗑️ Starting deletion of all Firebase data for user:', user.id);

    try {
      // Get reference to main user document
      const userDocRef = doc(firestore, 'users', user.id);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        const booksCount = data.books?.length || 0;
        const entriesCount = data.entries?.length || 0;
        const categoriesCount = data.categories?.length || 0;
        
        console.log('📦 Found user data to delete:', {
          books: booksCount,
          entries: entriesCount,
          categories: categoriesCount,
          total: booksCount + entriesCount + categoriesCount
        });
        
        // Update the document to have empty arrays
        await setDoc(userDocRef, {
          books: [],
          entries: [],
          categories: [],
          lastModified: serverTimestamp()
        }, { merge: true });
        
        console.log('✅ Cleared all data arrays in main user document');
        
        // Verify deletion
        const verifyDoc = await getDoc(userDocRef);
        if (verifyDoc.exists()) {
          const verifyData = verifyDoc.data();
          console.log('🔍 Verification - Current data in Firebase:', {
            books: verifyData.books?.length || 0,
            entries: verifyData.entries?.length || 0,
            categories: verifyData.categories?.length || 0
          });
        }
      } else {
        console.log('✓ No user document found - nothing to delete');
      }

      // Delete preferences document
      try {
        const preferencesRef = doc(firestore, 'users', user.id, 'preferences', 'settings');
        const prefsSnapshot = await getDoc(preferencesRef);
        if (prefsSnapshot.exists()) {
          await deleteDoc(preferencesRef);
          console.log('🗑️ Deleted preferences document');
        } else {
          console.log('✓ No preferences document found');
        }
      } catch (prefsError) {
        console.warn('⚠️ Error deleting preferences (may not exist):', prefsError);
      }

      console.log('✅ Successfully deleted all Firebase data for user');
    } catch (error) {
      console.error('❌ Error deleting Firebase data:', error);
      throw error;
    }
  };

  // ============ ONBOARDING METHODS ============
  
  /**
   * Check if user needs onboarding
   * Returns true ONLY if user is truly new (no data in Firebase)
   * Existing users with data skip onboarding
   */
  const checkOnboardingStatus = async (): Promise<boolean> => {
    try {
      console.log('🔍 Checking onboarding status...');
      
      // Check local storage first
      const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');
      
      if (onboardingCompleted === 'true') {
        console.log('✅ Onboarding already completed (local flag)');
        return false; // No onboarding needed
      }
      
      // Check Firebase if user is authenticated
      if (auth.currentUser) {
        const userDocRef = doc(firestore, 'users', auth.currentUser.uid, 'preferences', 'settings');
        const prefsDoc = await getDoc(userDocRef);
        
        // If preferences exist in Firebase, user has used the app before
        if (prefsDoc.exists()) {
          console.log('✅ User has preferences in Firebase - skipping onboarding');
          // Mark onboarding as completed locally
          await AsyncStorage.setItem('onboarding_completed', 'true');
          return false;
        }
        
        // Check if user has any data (books, entries, categories)
        const userDataRef = doc(firestore, 'userData', auth.currentUser.uid);
        const userDataDoc = await getDoc(userDataRef);
        
        if (userDataDoc.exists()) {
          const data = userDataDoc.data();
          // If user has any data, they're not new
          const hasData = 
            (data.books && data.books.length > 0) ||
            (data.entries && data.entries.length > 0) ||
            (data.categories && data.categories.length > 0);
          
          if (hasData) {
            console.log('✅ User has existing data - skipping onboarding');
            await AsyncStorage.setItem('onboarding_completed', 'true');
            return false;
          }
        }
      }
      
      console.log('⚠️ New user - onboarding needed');
      return true; // Onboarding needed for truly new users
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // On error, skip onboarding to avoid blocking users
      return false;
    }
  };

  /**
   * Complete onboarding and save user preferences
   */
  const completeOnboarding = async (preferences: any): Promise<void> => {
    try {
      console.log('✅ Completing onboarding with preferences:', preferences);
      
      // Save preferences to AsyncStorage
      await AsyncStorage.setItem('user_preferences', JSON.stringify(preferences));
      await AsyncStorage.setItem('onboarding_completed', 'true');
      
      // Update user currency in local state
      if (user) {
        const updatedUser = {
          ...user,
          defaultCurrency: preferences.currency,
        };
        setUser(updatedUser);
        await AsyncStorage.setItem('current_user', JSON.stringify(updatedUser));
      }
      
      // Create default categories if they don't exist
      if (user) {
        const existingCategories = await asyncStorageService.getCategories(user.id);
        if (existingCategories.length === 0) {
          console.log('📝 Creating default categories...');
          const defaultCategories = [
            { userId: user.id, name: 'Food & Dining', icon: 'food', color: '#FF6B6B', version: 1, lastModifiedBy: user.id },
            { userId: user.id, name: 'Transportation', icon: 'car', color: '#4ECDC4', version: 1, lastModifiedBy: user.id },
            { userId: user.id, name: 'Shopping', icon: 'shopping-bag', color: '#FFD93D', version: 1, lastModifiedBy: user.id },
            { userId: user.id, name: 'Entertainment', icon: 'ticket', color: '#95E1D3', version: 1, lastModifiedBy: user.id },
            { userId: user.id, name: 'Bills & Utilities', icon: 'receipt', color: '#F38181', version: 1, lastModifiedBy: user.id },
            { userId: user.id, name: 'Healthcare', icon: 'medical-bag', color: '#AA96DA', version: 1, lastModifiedBy: user.id },
            { userId: user.id, name: 'Education', icon: 'school', color: '#FCBAD3', version: 1, lastModifiedBy: user.id },
            { userId: user.id, name: 'Others', icon: 'dots-horizontal', color: '#A8D8EA', version: 1, lastModifiedBy: user.id },
          ];
          
          for (const category of defaultCategories) {
            await asyncStorageService.createCategory(category);
          }
        }
      }
      
      // Enable cloud sync if user chose to
      if (preferences.enableCloudSync && user) {
        console.log('☁️ Enabling cloud sync...');
        await enableSync();
      }
      
      // Save to Firestore
      if (auth.currentUser) {
        const userDocRef = doc(firestore, 'userData', auth.currentUser.uid);
        await setDoc(userDocRef, {
          preferences,
          onboardingCompletedAt: serverTimestamp(),
        }, { merge: true });
      }
      
      setNeedsOnboarding(false);
      console.log('🎉 Onboarding completed successfully!');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  };

  /**
   * Skip onboarding and use default preferences
   */
  const skipOnboarding = async (): Promise<void> => {
    try {
      console.log('⏭️ Skipping onboarding - using defaults');
      
      // Get current preferences (already synced from Firebase if they exist)
      const currentPrefs = await preferencesService.getPreferences();
      
      // Mark onboarding as completed
      await AsyncStorage.setItem('onboarding_completed', 'true');
      
      // Create default categories if they don't exist
      if (user) {
        const existingCategories = await asyncStorageService.getCategories(user.id);
        if (existingCategories.length === 0) {
          console.log('📝 Creating default categories...');
          const defaultCategories = [
            { userId: user.id, name: 'Food & Dining', icon: 'food', color: '#FF6B6B', version: 1, lastModifiedBy: user.id },
            { userId: user.id, name: 'Transportation', icon: 'car', color: '#4ECDC4', version: 1, lastModifiedBy: user.id },
            { userId: user.id, name: 'Shopping', icon: 'shopping-bag', color: '#FFD93D', version: 1, lastModifiedBy: user.id },
            { userId: user.id, name: 'Entertainment', icon: 'ticket', color: '#95E1D3', version: 1, lastModifiedBy: user.id },
            { userId: user.id, name: 'Bills & Utilities', icon: 'receipt', color: '#F38181', version: 1, lastModifiedBy: user.id },
            { userId: user.id, name: 'Healthcare', icon: 'medical-bag', color: '#AA96DA', version: 1, lastModifiedBy: user.id },
            { userId: user.id, name: 'Education', icon: 'school', color: '#FCBAD3', version: 1, lastModifiedBy: user.id },
            { userId: user.id, name: 'Others', icon: 'dots-horizontal', color: '#A8D8EA', version: 1, lastModifiedBy: user.id },
          ];
          
          for (const category of defaultCategories) {
            await asyncStorageService.createCategory(category);
          }
        }
      }
      
      // Enable cloud sync with default preferences
      if (currentPrefs.autoSync && user) {
        console.log('☁️ Enabling cloud sync with defaults...');
        await enableSync();
      }
      
      setNeedsOnboarding(false);
      console.log('✅ Onboarding skipped - using existing preferences');
    } catch (error) {
      console.error('Error skipping onboarding:', error);
      throw error;
    }
  };

  const enableSync = async (): Promise<void> => {
    console.log('✅ Auto-sync enabled');
    
    if (!user) {
      console.error('❌ Cannot enable sync - no user');
      return;
    }
    
    // Update the autoSync preference
    await preferencesService.updatePreferences({ autoSync: true });
    console.log('✅ Updated autoSync preference to true');
    
    // Register callback with asyncStorage for data changes
    asyncStorageService.setOnDataChanged(triggerAutoSync);
    setSyncEnabled(true);
    
    // Setup real-time listeners for multi-device sync
    setupRealtimeListeners(user.id);
    
    // CRITICAL: Use Git-style sync when re-enabling to preserve local changes
    // This prevents data loss when user:
    // 1. Disables sync
    // 2. Makes local changes (creates books, entries, etc.)
    // 3. Re-enables sync
    // Without this, cloud would overwrite local changes!
    console.log('🔀 Enabling sync with Git-style merge to preserve local changes...');
    const result = await gitStyleSync(user.id);
    
    if (result.success) {
      console.log('✅ Sync enabled successfully - local changes preserved');
    } else if (result.conflicts && result.conflicts.length > 0) {
      console.warn(`⚠️ ${result.conflicts.length} conflicts detected while enabling sync`);
      console.warn('User will need to resolve these conflicts');
    } else {
      console.error('❌ Failed to enable sync:', result.message);
    }
  };

  const disableSync = (): void => {
    console.log('🛑 Auto-sync disabled');
    
    // Update the autoSync preference (async but we don't await to keep function sync)
    preferencesService.updatePreferences({ autoSync: false })
      .then(() => console.log('✅ Updated autoSync preference to false'))
      .catch((error) => console.error('❌ Error updating autoSync preference:', error));
    
    // Clear timeout and remove callback
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    asyncStorageService.setOnDataChanged(null);
    setSyncEnabled(false);
    
    // Cleanup real-time listeners
    cleanupRealtimeListeners();
  };

  const syncNow = async (isManual: boolean = false): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: 'No user authenticated' };
    }

    // If this is an automatic sync (not manual), check if sync is enabled
    if (!isManual && !syncEnabled) {
      console.log('⏭️ Auto-sync skipped - sync is disabled by user preference');
      return { success: false, message: 'Sync is disabled' };
    }

    if (isSyncingRef.current) {
      console.log('⏭️ Sync already in progress, skipping...');
      return { success: false, message: 'Sync already in progress' };
    }

    try {
      isSyncingRef.current = true;
      console.log('🔄 Starting cloud-first sync...');

      // Wait for auth to be ready (up to 3 seconds)
      let attempts = 0;
      while (!auth.currentUser && attempts < 6) {
        console.log(`⏳ Waiting for auth... (${attempts + 1}/6)`);
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      if (!auth.currentUser) {
        console.error('❌ Auth session expired or not initialized');
        console.error('🔐 User needs to sign in again');
        
        // Clear local auth state
        setUser(null);
        setNeedsOnboarding(false);
        setSyncEnabled(false);
        await AsyncStorage.removeItem('current_user');
        
        return { 
          success: false, 
          message: '🔐 Session expired. Please sign in again.' 
        };
      }

      // Force token refresh to prevent permission errors
      console.log('🔑 Refreshing auth token...');
      try {
        await auth.currentUser.getIdToken(true);
        console.log('✅ Auth token refreshed successfully');
      } catch (tokenError: any) {
        console.error('❌ Token refresh failed:', tokenError.message);
        
        // Token refresh failed - likely session expired
        if (tokenError.code === 'auth/user-token-expired' || 
            tokenError.code === 'auth/invalid-user-token' ||
            tokenError.code === 'auth/user-disabled') {
          
          console.error('🔐 Session invalid - signing out user');
          
          // Force sign out
          await signOut();
          
          return { 
            success: false, 
            message: '🔐 Your session has expired. Please sign in again.' 
          };
        }
        
        // Other token error - retry might work
        throw tokenError;
      }

      // Retry logic with backoff (3 attempts)
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`📡 Sync attempt ${attempt}/3...`);

          // Check if this is first-time sync
          const userDocRef = doc(firestore, 'users', user.id);
          const userDataDoc = await getDoc(userDocRef);

          if (!userDataDoc.exists()) {
            // First time ever - upload local data to create master database
            console.log('📤 First sync: Creating master database in Firebase');
            await syncLocalDataToFirestore(user.id);
            console.log('✅ First sync complete');
            setLastSyncTime(new Date());
            return { success: true, message: 'First sync complete' };
          }

          // ============ PURE CLOUD-FIRST STRATEGY ============
          // Cloud is the single source of truth - just download and replace local data
          console.log('� Step 1: Downloading data from Firebase (cloud is source of truth)...');
          const { books: cloudBooks, entries: cloudEntries, categories: cloudCategories } = 
            await downloadFirestoreData(user.id);

          console.log('📊 Cloud data:', { 
            books: cloudBooks.length, 
            entries: cloudEntries.length, 
            categories: cloudCategories.length 
          });

          console.log('📱 Step 2: Getting local data for merge...');
          // CRITICAL: Use getAllX() methods to include deleted items (tombstones)
          // Without tombstones, merge can't detect local deletions!
          const localBooks = await asyncStorageService.getAllBooks(user.id);
          const localCategories = await asyncStorageService.getAllCategories(user.id);
          const localEntries = await asyncStorageService.getAllEntries(user.id);

          console.log('📱 Local data:', { 
            books: localBooks.length, 
            entries: localEntries.length, 
            categories: localCategories.length,
            deletedBooks: localBooks.filter((b: any) => b.deleted).length,
            deletedEntries: localEntries.filter((e: any) => e.deleted).length,
            deletedCategories: localCategories.filter((c: any) => c.deleted).length,
            archivedBooks: localBooks.filter((b: any) => b.archived).length
          });
          
          // DEBUG: Log archived books details
          const archivedBooks = localBooks.filter((b: any) => b.archived);
          if (archivedBooks.length > 0) {
            console.log('📦 Archived books in local data:');
            archivedBooks.forEach((b: any) => {
              console.log(`   - ${b.name}: archived=${b.archived}, archivedAt=${b.archivedAt}, version=${b.version}`);
            });
          }

          console.log('🔀 Step 3: MERGE - Three-way merge (like Git merge)...');
          const { GitStyleSyncService } = await import('../services/gitStyleSync');
          
          const booksResult = GitStyleSyncService.mergeArrays(localBooks, cloudBooks, 'book');
          const entriesResult = GitStyleSyncService.mergeArrays(localEntries, cloudEntries, 'entry');
          const categoriesResult = GitStyleSyncService.mergeArrays(localCategories, cloudCategories, 'category');

          let allConflicts = [
            ...booksResult.conflicts,
            ...entriesResult.conflicts,
            ...categoriesResult.conflicts
          ];

          console.log('🔀 Merge complete:', {
            books: booksResult.merged.length,
            entries: entriesResult.merged.length,
            categories: categoriesResult.merged.length,
            conflicts: allConflicts.length
          });
          
          // DEBUG: Log merged archived books
          const mergedArchivedBooks = booksResult.merged.filter((b: any) => b.archived);
          if (mergedArchivedBooks.length > 0) {
            console.log('📦 Archived books after merge:');
            mergedArchivedBooks.forEach((b: any) => {
              console.log(`   - ${b.name}: archived=${b.archived}, archivedAt=${b.archivedAt}, version=${b.version}`);
            });
          }

          // Filter out false conflicts (where values are actually the same but detected as different due to object comparison)
          // This can happen with Date objects or when values are serialized differently
          const realConflicts = allConflicts.filter(conflict => {
            const localStr = JSON.stringify(conflict.localValue);
            const cloudStr = JSON.stringify(conflict.cloudValue);
            const isDifferent = localStr !== cloudStr;
            
            if (!isDifferent) {
              console.log(`   ℹ️ Ignoring false conflict on ${conflict.entityType} ${conflict.field} (values are actually the same)`);
            }
            
            return isDifferent;
          });

          if (realConflicts.length > 0) {
            console.warn(`⚠️ CONFLICTS DETECTED: ${realConflicts.length} conflicts found!`);
            realConflicts.forEach((conflict, idx) => {
              console.warn(`  Conflict ${idx + 1}: ${conflict.entityType} ${conflict.entityId}.${conflict.field}`);
              console.warn(`    Local: ${JSON.stringify(conflict.localValue)}`);
              console.warn(`    Cloud: ${JSON.stringify(conflict.cloudValue)}`);
            });
            
            // Store conflicts for UI to display
            setConflicts(realConflicts);
            setConflictCount(realConflicts.length);
            
            console.warn('⚠️ Using cloud values for conflicts by default (can be changed in settings)');
            // Merged data already has cloud values for conflicts, so we can proceed
          } else {
            console.log('✅ No conflicts - clean merge!');
            setConflicts([]);
            setConflictCount(0);
          }

          console.log('💾 Step 4: Saving merged data locally...');
          await saveDownloadedDataToLocal(user.id, booksResult.merged, entriesResult.merged, categoriesResult.merged);

          console.log('📤 Step 5: PUSH - Uploading merged data to cloud...');
          // Mark that we're uploading to prevent listener from triggering
          justUploadedRef.current = true;
          
          // Upload the merged data (it will read from local storage which we just updated)
          await syncLocalDataToFirestore(user.id);

          console.log('✅ Git-style sync complete - Data merged and synced across devices!');
          setLastSyncTime(new Date());
          
          if (allConflicts.length > 0) {
            return { 
              success: true, 
              message: `Sync complete with ${allConflicts.length} conflicts (using cloud values)`
            };
          } else {
            return { success: true, message: 'Sync complete' };
          }

        } catch (error: any) {
          lastError = error;
          console.error(`❌ Sync attempt ${attempt} failed:`, error.message);
          console.error('Error code:', error.code);
          console.error('Error details:', error);
          
          // Check for authentication/permission errors
          if (error.code === 'permission-denied' || 
              error.code === 'unauthenticated' ||
              error.message?.includes('Missing or insufficient permissions') ||
              error.message?.includes('PERMISSION_DENIED')) {
            
            console.error('🔐 Permission denied - Session may have expired');
            
            // Clear auth state and force re-login
            await signOut();
            
            return {
              success: false,
              message: '🔐 Session expired. Please sign in again to continue syncing.'
            };
          }
          
          // Check for network errors
          if (error.code === 'unavailable' || 
              error.message?.includes('network') ||
              error.message?.includes('offline')) {
            
            console.error('📡 Network error detected');
            
            if (attempt >= 3) {
              return {
                success: false,
                message: '📡 Network error. Please check your internet connection and try again.'
              };
            }
          }
          
          if (attempt < 3) {
            const delay = attempt * 500; // 500ms, 1000ms
            console.log(`⏳ Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // All attempts failed
      console.error('❌ All sync attempts failed');
      console.error('Last error:', lastError);
      
      // Provide user-friendly error message
      let userMessage = 'Sync failed. Please try again.';
      
      if (lastError?.message) {
        if (lastError.message.includes('network') || lastError.message.includes('fetch')) {
          userMessage = '📡 Network error. Please check your internet connection.';
        } else if (lastError.message.includes('permission') || lastError.message.includes('auth')) {
          userMessage = '🔐 Authentication error. Please sign in again.';
        } else {
          userMessage = `Sync failed: ${lastError.message}`;
        }
      }
      
      return { 
        success: false, 
        message: userMessage
      };

    } catch (error: any) {
      console.error('❌ Sync error:', error);
      return { success: false, message: error.message || 'Sync failed' };
    } finally {
      isSyncingRef.current = false;
    }
  };

  /**
   * Check if current auth session is healthy and valid
   * Returns error message if session is invalid, null if healthy
   */
  const checkAuthHealth = async (): Promise<{ healthy: boolean; message: string | null }> => {
    try {
      // Check if user exists in context
      if (!user) {
        return { healthy: false, message: '🔐 No user session. Please sign in.' };
      }
      
      // Check if Firebase auth exists
      if (!auth.currentUser) {
        return { healthy: false, message: '🔐 Session expired. Please sign in again.' };
      }
      
      // Try to refresh token
      try {
        await auth.currentUser.getIdToken(true);
        console.log('✅ Auth health check passed');
        return { healthy: true, message: null };
      } catch (tokenError: any) {
        console.error('❌ Token refresh failed during health check:', tokenError);
        
        if (tokenError.code === 'auth/user-token-expired' || 
            tokenError.code === 'auth/invalid-user-token' ||
            tokenError.code === 'auth/user-disabled' ||
            tokenError.code === 'auth/user-not-found') {
          
          return { 
            healthy: false, 
            message: '🔐 Your session has expired. Please sign in again.' 
          };
        }
        
        return { 
          healthy: false, 
          message: `🔐 Authentication error: ${tokenError.message}` 
        };
      }
    } catch (error: any) {
      console.error('❌ Auth health check failed:', error);
      return { 
        healthy: false, 
        message: `🔐 Session check failed: ${error.message}` 
      };
    }
  };

  /**
   * Clear all conflicts
   */
  const clearConflicts = () => {
    setConflicts([]);
    setConflictCount(0);
    console.log('✅ Conflicts cleared');
  };

  /**
   * Resolve conflicts with user's choices
   */
  const resolveConflicts = async (resolutions: Map<string, 'use-local' | 'use-cloud' | any>): Promise<void> => {
    if (!user) {
      console.error('❌ Cannot resolve conflicts - no user');
      return;
    }

    try {
      console.log(`🔧 Resolving ${conflicts.length} conflicts...`);
      
      // Import Git-style sync service
      const { GitStyleSyncService } = await import('../services/gitStyleSync');
      
      // Get current data (including deleted items for deletion conflict resolution)
      const books = await asyncStorageService.getAllBooks(user.id);
      const categories = await asyncStorageService.getAllCategories(user.id);
      const entries = await asyncStorageService.getAllEntries(user.id);
      
      // Apply resolutions
      const resolvedBooks = GitStyleSyncService.resolveConflicts(
        books,
        conflicts.filter(c => c.entityType === 'book'),
        resolutions
      );
      
      const resolvedEntries = GitStyleSyncService.resolveConflicts(
        entries,
        conflicts.filter(c => c.entityType === 'entry'),
        resolutions
      );
      
      const resolvedCategories = GitStyleSyncService.resolveConflicts(
        categories,
        conflicts.filter(c => c.entityType === 'category'),
        resolutions
      );
      
      // Save resolved data locally
      await saveDownloadedDataToLocal(user.id, resolvedBooks, resolvedEntries, resolvedCategories);
      
      // Upload to cloud
      await syncLocalDataToFirestore(user.id);
      
      // Clear conflicts
      clearConflicts();
      
      console.log('✅ Conflicts resolved and synced');
    } catch (error) {
      console.error('❌ Failed to resolve conflicts:', error);
      throw error;
    }
  };

  const getSyncStatus = () => {
    return {
      syncEnabled: syncEnabled,
      isOnline: true,
      lastSyncTime: lastSyncTime,
      isSyncing: isSyncingRef.current,
      pendingChanges: 0,
      conflictCount: conflictCount,
      hasConflicts: conflictCount > 0,
      error: null
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
    needsOnboarding,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    linkGoogleAccount,
    unlinkGoogleAccount,
    signOut,
    completeOnboarding,
    skipOnboarding,
    checkOnboardingStatus,
    enableSync,
    disableSync,
    syncNow,
    getSyncStatus,
    onSyncStatusChange,
    checkAuthHealth,
    deleteAllFirebaseData,
    conflicts,
    conflictCount,
    clearConflicts,
    resolveConflicts,
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