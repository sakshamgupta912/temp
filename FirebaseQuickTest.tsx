// Quick Firebase Test - Add this to your App.tsx temporarily to test
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { testFirebaseConnection } from './src/services/firebase';

const FirebaseQuickTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Testing Firebase...');

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      const result = await testFirebaseConnection();
      if (result.success) {
        setStatus('✅ Firebase Connected Successfully!');
      } else {
        setStatus(`❌ Firebase Error: ${result.error}`);
      }
    } catch (error: any) {
      setStatus(`❌ Test Failed: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔥 Firebase Status</Text>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.project}>Project: cocona-472b7</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  status: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  project: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default FirebaseQuickTest;

// To use this test:
// 1. Import this component in your App.tsx
// 2. Replace your main component temporarily with <FirebaseQuickTest />
// 3. Run your app to see if Firebase connects
// 4. Remove when done testing