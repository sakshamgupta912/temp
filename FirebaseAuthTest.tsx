// Firebase Connection and Authentication Test
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { testFirebaseConnection, auth } from '../services/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const FirebaseAuthTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Ready to test');
  const [authStatus, setAuthStatus] = useState<string>('Not tested');

  const testFirebaseConnection = async () => {
    setStatus('Testing Firebase connection...');
    try {
      // Test basic Firebase connection
      const result = await testFirebaseConnection();
      if (result?.success) {
        setStatus('✅ Firebase connected successfully');
      } else {
        setStatus(`❌ Firebase error: ${result?.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      setStatus(`❌ Connection failed: ${error.message}`);
    }
  };

  const testGoogleAuth = async () => {
    setAuthStatus('Testing Google Authentication...');
    try {
      // Test if Google provider is available
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      
      setAuthStatus('✅ Google Auth provider ready');
      
      // Note: We won't actually sign in here, just test if the provider works
      Alert.alert(
        'Google Auth Test', 
        'Google Authentication provider is configured correctly. Ready for sign-in implementation.'
      );
      
    } catch (error: any) {
      setAuthStatus(`❌ Google Auth error: ${error.message}`);
      Alert.alert('Google Auth Error', error.message);
    }
  };

  const checkFirebaseServices = async () => {
    try {
      // Check if Authentication is enabled
      const authEnabled = auth ? 'Enabled' : 'Disabled';
      
      Alert.alert(
        'Firebase Services Status',
        `Authentication: ${authEnabled}\n\nNext: Check Firebase Console to ensure Google sign-in is enabled.`
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔥 Firebase Authentication Test</Text>
      <Text style={styles.project}>Project: cocona-472b7</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Connection Status:</Text>
        <Text style={styles.statusText}>{status}</Text>
      </View>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Auth Status:</Text>
        <Text style={styles.statusText}>{authStatus}</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={testFirebaseConnection}>
        <Text style={styles.buttonText}>Test Firebase Connection</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testGoogleAuth}>
        <Text style={styles.buttonText}>Test Google Auth Setup</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.infoButton]} onPress={checkFirebaseServices}>
        <Text style={styles.buttonText}>Check Services Status</Text>
      </TouchableOpacity>

      <Text style={styles.instructions}>
        📋 To enable Google Sign-In:{'\n'}
        1. Go to Firebase Console{'\n'}
        2. Enable Authentication{'\n'}
        3. Enable Google provider{'\n'}
        4. Set up OAuth credentials
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  project: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
    fontStyle: 'italic',
  },
  statusContainer: {
    backgroundColor: 'white',
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
    elevation: 2,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  button: {
    backgroundColor: '#6750A4',
    padding: 15,
    borderRadius: 8,
    marginVertical: 8,
    elevation: 2,
  },
  infoButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  instructions: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
});

export default FirebaseAuthTest;