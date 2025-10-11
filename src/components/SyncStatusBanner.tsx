import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { ConflictResolutionModal } from './ConflictResolutionModal';

export const SyncStatusBanner: React.FC = () => {
  const { getSyncStatus, conflictCount, syncNow } = useAuth();
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [opacity] = useState(new Animated.Value(1));

  useEffect(() => {
    const updateStatus = () => {
      const status = getSyncStatus();
      setSyncStatus(status);
    };

    // Initial update
    updateStatus();

    // Update every 5 seconds
    const interval = setInterval(updateStatus, 5000);

    return () => clearInterval(interval);
  }, [getSyncStatus]);

  useEffect(() => {
    // Pulse animation when syncing
    if (syncStatus?.isSyncing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.5,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      opacity.setValue(1);
    }
  }, [syncStatus?.isSyncing]);

  if (!syncStatus || !syncStatus.syncEnabled) {
    return null; // Don't show banner if sync is disabled
  }

  const getStatusInfo = () => {
    if (syncStatus.hasConflicts) {
      return {
        icon: 'alert-octagon',
        text: `⚠️ ${conflictCount} conflict${conflictCount !== 1 ? 's' : ''} need resolution`,
        color: '#FF6B6B',
        backgroundColor: '#FFE5E5',
        action: 'Resolve',
        onAction: () => setShowConflictModal(true),
      };
    }

    if (syncStatus.isSyncing) {
      return {
        icon: 'sync',
        text: 'Syncing...',
        color: '#4ECDC4',
        backgroundColor: '#E8F8F7',
        action: null,
        onAction: null,
      };
    }

    if (syncStatus.error) {
      return {
        icon: 'alert-circle',
        text: 'Sync error - Tap to retry',
        color: '#FF6B6B',
        backgroundColor: '#FFE5E5',
        action: 'Retry',
        onAction: syncNow,
      };
    }

    if (syncStatus.lastSyncTime) {
      const now = new Date();
      const lastSync = new Date(syncStatus.lastSyncTime);
      const diffMinutes = Math.floor((now.getTime() - lastSync.getTime()) / 60000);

      let timeText = 'Just now';
      if (diffMinutes >= 60) {
        const hours = Math.floor(diffMinutes / 60);
        timeText = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      } else if (diffMinutes > 0) {
        timeText = `${diffMinutes} min${diffMinutes !== 1 ? 's' : ''} ago`;
      }

      return {
        icon: 'check-circle',
        text: `✅ Up to date • Last synced ${timeText}`,
        color: '#51CF66',
        backgroundColor: '#E9F9EC',
        action: null,
        onAction: null,
      };
    }

    return {
      icon: 'cloud-outline',
      text: 'Sync enabled',
      color: '#4ECDC4',
      backgroundColor: '#E8F8F7',
      action: null,
      onAction: null,
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <>
      <Animated.View style={[styles.banner, { backgroundColor: statusInfo.backgroundColor, opacity }]}>
        <TouchableOpacity
          style={styles.content}
          onPress={statusInfo.onAction || undefined}
          disabled={!statusInfo.onAction}
          activeOpacity={statusInfo.onAction ? 0.7 : 1}
        >
          <View style={styles.leftContent}>
            <MaterialCommunityIcons 
              name={statusInfo.icon as any}
              size={20} 
              color={statusInfo.color}
              style={syncStatus.isSyncing ? styles.rotatingIcon : undefined}
            />
            <Text style={[styles.text, { color: statusInfo.color }]}>
              {statusInfo.text}
            </Text>
          </View>

          {statusInfo.action && (
            <View style={[styles.actionButton, { backgroundColor: statusInfo.color }]}>
              <Text style={styles.actionButtonText}>{statusInfo.action}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Conflict Resolution Modal */}
      <ConflictResolutionModal 
        visible={showConflictModal}
        onClose={() => setShowConflictModal(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  rotatingIcon: {
    // Animation handled by Animated.View
  },
});
