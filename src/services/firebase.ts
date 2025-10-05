// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Demo Firebase configuration - replace with your actual config when ready
const firebaseConfig = {
  apiKey: "demo-api-key",
  authDomain: "demo-project.firebaseapp.com",
  projectId: "demo-project", 
  storageBucket: "demo-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "demo-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);

// Enable persistence for offline support
import { enableNetwork, disableNetwork } from 'firebase/firestore';

export const enableOfflineSupport = () => {
  // Firestore automatically enables offline support in React Native
  console.log('Firestore offline support is enabled by default');
};

export const goOffline = () => disableNetwork(firestore);
export const goOnline = () => enableNetwork(firestore);

export default app;