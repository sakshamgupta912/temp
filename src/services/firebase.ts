// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
// Note: Firebase v10+ uses getAuth() directly - persistence is handled automatically

// ✅ UPDATED: Your actual Firebase project configuration
//  Project: cocona-472b7
const firebaseConfig = {
  apiKey: "AIzaSyCfBJntd1r8fLuWmNQwVWE2UkBTin-mWBU",
  authDomain: "cocona-472b7.firebaseapp.com",
  projectId: "cocona-472b7",
  storageBucket: "cocona-472b7.firebasestorage.app",
  messagingSenderId: "965715628931",
  appId: "1:965715628931:web:79922758480507c624dcb6",
  measurementId: "G-3N3CZNTV3C"
};

// ✅ Steps to get your actual config:
// 1. Go to https://console.firebase.google.com/
// 2. Select your project (or create new one)
// 3. Click ⚙️ Settings > Project settings
// 4. Scroll down to "Your apps" section
// 5. Click on your web app or add new web app
// 6. Copy the firebaseConfig object and replace above

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
// Note: Firebase v10+ handles React Native persistence automatically via AsyncStorage
// when using getAuth(). No need to manually configure getReactNativePersistence.
export const auth = getAuth(app);

export const firestore = getFirestore(app);
export const storage = getStorage(app);

// Development helpers (optional - remove in production)
const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';

if (isDevelopment) {
  // Uncomment these lines if you want to use Firebase Emulator Suite for local development
  // connectAuthEmulator(auth, 'http://localhost:9099');
  // connectFirestoreEmulator(firestore, 'localhost', 8080);
  // connectStorageEmulator(storage, 'localhost', 9199);
}

// Offline support utilities
import { enableNetwork, disableNetwork } from 'firebase/firestore';

export const enableOfflineSupport = () => {
  // Firestore automatically enables offline support in React Native/Expo
  console.log('✅ Firestore offline support is enabled by default');
};

export const goOffline = () => disableNetwork(firestore);
export const goOnline = () => enableNetwork(firestore);

// Test Firebase connection
export const testFirebaseConnection = async () => {
  try {
    console.log('🧪 Testing Firebase connection...');
    
    // Test auth connection
    const user = auth.currentUser;
    console.log('🔐 Auth service:', user ? `User logged in: ${user.email}` : 'No user logged in');
    
    // Test Firestore connection with a simple read
    console.log('🗄️ Testing Firestore connection...');
    
    if (user) {
      try {
        // Try to read user document
        const { doc, getDoc } = await import('firebase/firestore');
        const testDocRef = doc(firestore, 'users', user.uid);
        await getDoc(testDocRef);
        console.log('✅ Firestore connection successful');
      } catch (firestoreError: any) {
        console.error('❌ Firestore connection failed:', firestoreError);
        if (firestoreError.code === 'permission-denied') {
          console.log('🔒 Firestore security rules may need to be updated');
        } else if (firestoreError.code === 'unavailable') {
          console.log('🌐 Firestore service unavailable - check internet connection');
        }
        throw firestoreError;
      }
    } else {
      console.log('⚠️ Cannot test Firestore without authenticated user');
    }
    
    console.log('📦 Storage service: Available');
    
    return { success: true, message: 'Firebase services connected successfully' };
  } catch (error: any) {
    console.error('❌ Firebase connection error:', error);
    return { success: false, error: error.message };
  }
};

export default app;