// Firebase Connection Test Component
// Use this to test your Firebase setup before implementing full features

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { testFirebaseConnection } from '../services/firebase';

interface ConnectionStatus {
  firebase: 'testing' | 'connected' | 'error';
  auth: 'testing' | 'connected' | 'error';
  firestore: 'testing' | 'connected' | 'error';
  message: string;
}

const FirebaseTestScreen: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>({
    firebase: 'testing',
    auth: 'testing', 
    firestore: 'testing',
    message: 'Testing Firebase connection...'
  });

  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev]);
  };

  const testConnection = async () => {
    addLog('Starting Firebase connection test...');
    
    try {
      // Test basic Firebase connection
      setStatus(prev => ({ ...prev, firebase: 'testing', message: 'Testing Firebase...' }));
      const result = await testFirebaseConnection();
      
      if (result.success) {
        setStatus(prev => ({ 
          ...prev, 
          firebase: 'connected',
          auth: 'connected',
          firestore: 'connected',
          message: result.message || 'Connected successfully'
        }));
        addLog('✅ Firebase connection successful');
      } else {
        setStatus(prev => ({ 
          ...prev, 
          firebase: 'error',
          auth: 'error', 
          firestore: 'error',
          message: result.error || 'Connection failed'
        }));
        addLog(`❌ Firebase connection failed: ${result.error}`);
      }
    } catch (error: any) {
      addLog(`❌ Test error: ${error.message}`);
      setStatus(prev => ({
        ...prev,
        firebase: 'error',
        auth: 'error',
        firestore: 'error', 
        message: error.message
      }));
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  const getStatusIcon = (status: 'testing' | 'connected' | 'error') => {
    switch (status) {
      case 'testing': return '⏳';
      case 'connected': return '✅';
      case 'error': return '❌';
    }
  };

  const getStatusColor = (status: 'testing' | 'connected' | 'error') => {
    switch (status) {
      case 'testing': return '#FFA500';
      case 'connected': return '#4CAF50';
      case 'error': return '#F44336';
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const showConfigHelp = () => {
    Alert.alert(
      'Firebase Configuration Help',
      '1. Go to Firebase Console (https://console.firebase.google.com/)\n' +
      '2. Create or select your project\n' +
      '3. Add a web app to your project\n' +
      '4. Copy the configuration and update src/services/firebase.ts\n' +
      '5. Enable Authentication and Firestore in Firebase Console\n' +
      '6. Set up Google Sign-In provider',
      [{ text: 'OK' }]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="cloud" size={48} color="#FFA000" />
        <Text style={styles.title}>Firebase Connection Test</Text>
      </View>

      <View style={styles.statusContainer}>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Firebase Core:</Text>
          <View style={styles.statusIndicator}>
            <Text style={[styles.statusIcon, { color: getStatusColor(status.firebase) }]}>
              {getStatusIcon(status.firebase)}
            </Text>
            <Text style={styles.statusText}>{status.firebase}</Text>
          </View>
        </View>

        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Authentication:</Text>
          <View style={styles.statusIndicator}>
            <Text style={[styles.statusIcon, { color: getStatusColor(status.auth) }]}>
              {getStatusIcon(status.auth)}
            </Text>
            <Text style={styles.statusText}>{status.auth}</Text>
          </View>
        </View>

        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Firestore:</Text>
          <View style={styles.statusIndicator}>
            <Text style={[styles.statusIcon, { color: getStatusColor(status.firestore) }]}>
              {getStatusIcon(status.firestore)}
            </Text>
            <Text style={styles.statusText}>{status.firestore}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.message}>{status.message}</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={testConnection}>
          <MaterialIcons name="refresh" size={20} color="white" />
          <Text style={styles.buttonText}>Test Again</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.helpButton]} onPress={showConfigHelp}>
          <MaterialIcons name="help" size={20} color="white" />
          <Text style={styles.buttonText}>Setup Help</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.logsContainer}>
        <View style={styles.logsHeader}>
          <Text style={styles.logsTitle}>Test Logs</Text>
          <TouchableOpacity onPress={clearLogs}>
            <MaterialIcons name="clear" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.logsContent}>
          {logs.length === 0 ? (
            <Text style={styles.noLogs}>No logs yet...</Text>
          ) : (
            logs.map((log, index) => (
              <Text key={index} style={styles.logItem}>{log}</Text>
            ))
          )}
        </View>
      </View>

      <View style={styles.configInfo}>
        <Text style={styles.configTitle}>📋 Next Steps:</Text>
        <Text style={styles.configStep}>1. Update firebase.ts with your project config</Text>
        <Text style={styles.configStep}>2. Enable Auth & Firestore in Firebase Console</Text>
        <Text style={styles.configStep}>3. Set up Google Sign-In provider</Text>
        <Text style={styles.configStep}>4. Test Google authentication</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#333',
  },
  statusContainer: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    margin: 16,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    margin: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6750A4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
  },
  helpButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  logsContainer: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 8,
    elevation: 2,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  logsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  logsContent: {
    maxHeight: 200,
    padding: 16,
  },
  noLogs: {
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  logItem: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
    marginBottom: 4,
  },
  configInfo: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    marginBottom: 40,
  },
  configTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  configStep: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    paddingLeft: 16,
  },
});

export default FirebaseTestScreen;