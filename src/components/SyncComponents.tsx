// Sync Status Indicator Component
// Shows current sync status with visual indicators

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Icon, useTheme, Surface, ActivityIndicator } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import firebaseSyncService, { SyncStatus } from '../services/firebaseSyncService';

export interface SyncIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  onPress?: () => void;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  size = 'medium',
  showText = true,
  onPress
}) => {
  const theme = useTheme();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(firebaseSyncService.getSyncStatus());

  useEffect(() => {
    const unsubscribe = firebaseSyncService.onStatusChanged(setSyncStatus);
    return unsubscribe;
  }, []);

  const getStatusIcon = () => {
    if (syncStatus.isSyncing) {
      return 'sync';
    }
    if (!syncStatus.isOnline) {
      return 'cloud-off';
    }
    if (syncStatus.syncError) {
      return 'cloud-alert';
    }
    if (syncStatus.pendingChanges > 0) {
      return 'cloud-upload';
    }
    return 'cloud-done';
  };

  const getStatusColor = () => {
    if (syncStatus.isSyncing) {
      return theme.colors.primary;
    }
    if (!syncStatus.isOnline) {
      return theme.colors.onSurfaceVariant;
    }
    if (syncStatus.syncError) {
      return theme.colors.error;
    }
    if (syncStatus.pendingChanges > 0) {
      return theme.colors.tertiary;
    }
    return theme.colors.primary;
  };

  const getStatusText = () => {
    if (syncStatus.isSyncing) {
      return 'Syncing...';
    }
    if (!syncStatus.isOnline) {
      return 'Offline';
    }
    if (syncStatus.syncError) {
      return 'Sync Error';
    }
    if (syncStatus.pendingChanges > 0) {
      return `${syncStatus.pendingChanges} pending`;
    }
    if (syncStatus.lastSyncTime) {
      const timeDiff = Date.now() - syncStatus.lastSyncTime.getTime();
      const minutesAgo = Math.floor(timeDiff / (1000 * 60));
      if (minutesAgo < 1) {
        return 'Just synced';
      } else if (minutesAgo < 60) {
        return `${minutesAgo}m ago`;
      } else {
        const hoursAgo = Math.floor(minutesAgo / 60);
        return `${hoursAgo}h ago`;
      }
    }
    return 'Never synced';
  };

  const iconSize = size === 'small' ? 16 : size === 'medium' ? 20 : 24;
  const textVariant = size === 'small' ? 'bodySmall' : size === 'medium' ? 'bodyMedium' : 'bodyLarge';

  const content = (
    <View style={[styles.container, styles[size]]}>
      {syncStatus.isSyncing ? (
        <ActivityIndicator 
          size={iconSize} 
          color={getStatusColor()} 
          style={styles.spinner}
        />
      ) : (
        <MaterialIcons 
          name={getStatusIcon() as any} 
          size={iconSize} 
          color={getStatusColor()} 
        />
      )}
      {showText && (
        <Text 
          variant={textVariant} 
          style={[styles.text, { color: getStatusColor() }]}
        >
          {getStatusText()}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} style={styles.touchable}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

// Detailed Sync Status Card
export interface SyncStatusCardProps {
  onManualSync?: () => void;
  onSettingsPress?: () => void;
}

export const SyncStatusCard: React.FC<SyncStatusCardProps> = ({
  onManualSync,
  onSettingsPress
}) => {
  const theme = useTheme();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(firebaseSyncService.getSyncStatus());

  useEffect(() => {
    const unsubscribe = firebaseSyncService.onStatusChanged(setSyncStatus);
    return unsubscribe;
  }, []);

  const handleManualSync = async () => {
    if (onManualSync) {
      onManualSync();
    } else {
      try {
        await firebaseSyncService.syncAll();
      } catch (error) {
        console.error('Manual sync failed:', error);
      }
    }
  };

  return (
    <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <MaterialIcons 
            name="cloud" 
            size={24} 
            color={theme.colors.primary} 
            style={styles.cardIcon}
          />
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            Cloud Sync
          </Text>
        </View>
        
        {onSettingsPress && (
          <TouchableOpacity onPress={onSettingsPress}>
            <MaterialIcons 
              name="settings" 
              size={20} 
              color={theme.colors.onSurfaceVariant} 
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.cardContent}>
        <View style={styles.statusRow}>
          <SyncIndicator size="medium" showText={true} />
        </View>

        {syncStatus.syncError && (
          <View style={[styles.errorContainer, { backgroundColor: theme.colors.errorContainer }]}>
            <MaterialIcons 
              name="error-outline" 
              size={16} 
              color={theme.colors.onErrorContainer} 
            />
            <Text 
              variant="bodySmall" 
              style={[styles.errorText, { color: theme.colors.onErrorContainer }]}
            >
              {syncStatus.syncError}
            </Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Status
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
              {syncStatus.isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>

          <View style={styles.stat}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Pending
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
              {syncStatus.pendingChanges}
            </Text>
          </View>

          <View style={styles.stat}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Last Sync
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
              {syncStatus.lastSyncTime 
                ? new Date(syncStatus.lastSyncTime).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })
                : 'Never'
              }
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[
            styles.syncButton, 
            { backgroundColor: theme.colors.primary },
            syncStatus.isSyncing && styles.syncButtonDisabled
          ]}
          onPress={handleManualSync}
          disabled={syncStatus.isSyncing || !syncStatus.isOnline}
        >
          {syncStatus.isSyncing ? (
            <ActivityIndicator size={16} color={theme.colors.onPrimary} />
          ) : (
            <MaterialIcons 
              name="sync" 
              size={16} 
              color={theme.colors.onPrimary} 
            />
          )}
          <Text 
            variant="bodyMedium" 
            style={[styles.syncButtonText, { color: theme.colors.onPrimary }]}
          >
            {syncStatus.isSyncing ? 'Syncing...' : 'Sync Now'}
          </Text>
        </TouchableOpacity>
      </View>
    </Surface>
  );
};

// Minimal floating sync indicator for screens
export const FloatingSyncIndicator: React.FC = () => {
  const theme = useTheme();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(firebaseSyncService.getSyncStatus());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = firebaseSyncService.onStatusChanged((status) => {
      setSyncStatus(status);
      // Show indicator when syncing or have pending changes
      setIsVisible(status.isSyncing || status.pendingChanges > 0 || !!status.syncError);
    });
    return unsubscribe;
  }, []);

  if (!isVisible) return null;

  return (
    <Surface 
      style={[
        styles.floatingIndicator, 
        { backgroundColor: theme.colors.surface }
      ]} 
      elevation={3}
    >
      <SyncIndicator size="small" showText={false} />
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  small: {
    gap: 4,
  },
  medium: {
    gap: 6,
  },
  large: {
    gap: 8,
  },
  touchable: {
    borderRadius: 8,
    padding: 4,
  },
  text: {
    fontWeight: '500',
  },
  spinner: {
    marginRight: 0,
  },
  
  // Card styles
  card: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    marginRight: 8,
  },
  cardContent: {
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    gap: 6,
  },
  errorText: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    fontWeight: '600',
  },
  
  // Floating indicator
  floatingIndicator: {
    position: 'absolute',
    top: 60,
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    zIndex: 1000,
  },
});

export default {
  SyncIndicator,
  SyncStatusCard,
  FloatingSyncIndicator,
};