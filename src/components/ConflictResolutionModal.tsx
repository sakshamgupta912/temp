import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

interface ConflictResolutionModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({ visible, onClose }) => {
  const { conflicts, resolveConflicts, clearConflicts } = useAuth();
  const [resolutions, setResolutions] = useState<Map<string, 'use-local' | 'use-cloud' | any>>(new Map());
  const [customValues, setCustomValues] = useState<Map<string, string>>(new Map());
  const [isResolving, setIsResolving] = useState(false);

  // Group conflicts by entity for better display
  const groupedConflicts = conflicts.reduce((acc, conflict) => {
    const key = `${conflict.entityType}-${conflict.entityId}`;
    if (!acc[key]) {
      acc[key] = {
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        conflicts: []
      };
    }
    acc[key].conflicts.push(conflict);
    return acc;
  }, {} as Record<string, { entityType: string; entityId: string; conflicts: any[] }>);

  const handleResolution = (conflictKey: string, resolution: 'use-local' | 'use-cloud' | 'custom') => {
    const newResolutions = new Map(resolutions);
    
    if (resolution === 'custom') {
      // Don't set resolution yet - wait for user to enter custom value
      return;
    }
    
    newResolutions.set(conflictKey, resolution);
    setResolutions(newResolutions);
  };

  const handleCustomValue = (conflictKey: string, value: string) => {
    const newCustomValues = new Map(customValues);
    newCustomValues.set(conflictKey, value);
    setCustomValues(newCustomValues);
    
    const newResolutions = new Map(resolutions);
    newResolutions.set(conflictKey, value);
    setResolutions(newResolutions);
  };

  const handleResolveAll = async () => {
    setIsResolving(true);
    try {
      // Auto-select "use-cloud" for any unresolved conflicts
      const finalResolutions = new Map(resolutions);
      conflicts.forEach(conflict => {
        const key = `${conflict.entityType}-${conflict.entityId}-${conflict.field}`;
        if (!finalResolutions.has(key)) {
          finalResolutions.set(key, 'use-cloud');
        }
      });

      await resolveConflicts(finalResolutions);
      onClose();
    } catch (error) {
      console.error('Failed to resolve conflicts:', error);
      alert('Failed to resolve conflicts. Please try again.');
    } finally {
      setIsResolving(false);
    }
  };

  const handleCancel = () => {
    setResolutions(new Map());
    setCustomValues(new Map());
    onClose();
  };

  const getEntityName = (conflict: any): string => {
    // Try to get a human-readable name from the conflict
    if (conflict.localValue && typeof conflict.localValue === 'object' && conflict.localValue.name) {
      return conflict.localValue.name;
    }
    if (conflict.cloudValue && typeof conflict.cloudValue === 'object' && conflict.cloudValue.name) {
      return conflict.cloudValue.name;
    }
    return conflict.entityId.substring(0, 8) + '...';
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'Not set';
    
    // Handle deletion conflicts
    if (value === 'DELETED') return '🗑️ Deleted';
    if (value === 'EDITED') return '✏️ Modified';
    
    if (typeof value === 'object') {
      if (value instanceof Date) return value.toLocaleDateString();
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const getConflictKey = (conflict: any): string => {
    return `${conflict.entityType}-${conflict.entityId}-${conflict.field}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleCancel}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <MaterialCommunityIcons name="alert-octagon" size={32} color="#FF6B6B" />
          <Text style={styles.headerTitle}>Sync Conflicts Detected</Text>
          <Text style={styles.headerSubtitle}>
            {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} need{conflicts.length === 1 ? 's' : ''} your attention
          </Text>
        </View>

        {/* Conflicts List */}
        <ScrollView style={styles.conflictsList}>
          {Object.entries(groupedConflicts).map(([key, group]: [string, any]) => (
            <View key={key} style={styles.entityGroup}>
              <View style={styles.entityHeader}>
                <MaterialCommunityIcons 
                  name={group.entityType === 'book' ? 'book' : group.entityType === 'entry' ? 'receipt' : 'tag'}
                  size={24} 
                  color="#4ECDC4"
                />
                <Text style={styles.entityTitle}>
                  {group.entityType.charAt(0).toUpperCase() + group.entityType.slice(1)}
                </Text>
              </View>

              {group.conflicts.map((conflict: any, index: number) => {
                const conflictKey = getConflictKey(conflict);
                const currentResolution = resolutions.get(conflictKey);
                const isCustom = currentResolution && currentResolution !== 'use-local' && currentResolution !== 'use-cloud';

                // Special labels for deletion conflicts
                const isDeletionConflict = conflict.field === 'deleted';
                const localLabel = isDeletionConflict ? 
                  (conflict.localValue === 'DELETED' ? 'Delete Item' : 'Keep Item') : 
                  'Keep Mine';
                const cloudLabel = isDeletionConflict ? 
                  (conflict.cloudValue === 'DELETED' ? 'Delete Item' : 'Keep Item') : 
                  'Use Theirs';

                return (
                  <View key={index} style={styles.conflictItem}>
                    <Text style={styles.fieldName}>
                      {isDeletionConflict ? '⚠️ Deletion Conflict' : `Field: ${conflict.field}`}
                    </Text>
                    
                    <View style={styles.valuesContainer}>
                      {/* Your Change */}
                      <View style={[
                        styles.valueBox,
                        currentResolution === 'use-local' && styles.valueBoxSelected
                      ]}>
                        <Text style={styles.valueLabel}>Your Change</Text>
                        <Text style={styles.valueText}>{formatValue(conflict.localValue)}</Text>
                        <TouchableOpacity 
                          style={[
                            styles.choiceButton,
                            currentResolution === 'use-local' && styles.choiceButtonSelected
                          ]}
                          onPress={() => handleResolution(conflictKey, 'use-local')}
                        >
                          <Text style={[
                            styles.choiceButtonText,
                            currentResolution === 'use-local' && styles.choiceButtonTextSelected
                          ]}>
                            {localLabel}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Their Change */}
                      <View style={[
                        styles.valueBox,
                        currentResolution === 'use-cloud' && styles.valueBoxSelected
                      ]}>
                        <Text style={styles.valueLabel}>Their Change</Text>
                        <Text style={styles.valueText}>{formatValue(conflict.cloudValue)}</Text>
                        <TouchableOpacity 
                          style={[
                            styles.choiceButton,
                            currentResolution === 'use-cloud' && styles.choiceButtonSelected
                          ]}
                          onPress={() => handleResolution(conflictKey, 'use-cloud')}
                        >
                          <Text style={[
                            styles.choiceButtonText,
                            currentResolution === 'use-cloud' && styles.choiceButtonTextSelected
                          ]}>
                            {cloudLabel}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Custom Value Option (only for non-deletion conflicts) */}
                    {conflict.field !== 'deleted' && (
                      <View style={styles.customValueContainer}>
                        <Text style={styles.customValueLabel}>Or enter custom value:</Text>
                        <TextInput
                          style={[
                            styles.customValueInput,
                            isCustom && styles.customValueInputSelected
                          ]}
                          placeholder="Custom value..."
                          value={customValues.get(conflictKey) || ''}
                          onChangeText={(text) => handleCustomValue(conflictKey, text)}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={isResolving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.resolveButton, isResolving && styles.resolveButtonDisabled]}
            onPress={handleResolveAll}
            disabled={isResolving}
          >
            {isResolving ? (
              <Text style={styles.resolveButtonText}>Resolving...</Text>
            ) : (
              <>
                <MaterialCommunityIcons name="check-circle" size={20} color="white" />
                <Text style={styles.resolveButtonText}>Resolve All Conflicts</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  conflictsList: {
    flex: 1,
    padding: 16,
  },
  entityGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  entityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  entityTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  conflictItem: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  fieldName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444',
    marginBottom: 12,
  },
  valuesContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  valueBox: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  valueBoxSelected: {
    borderColor: '#4ECDC4',
    backgroundColor: '#E8F8F7',
  },
  valueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  valueText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  choiceButton: {
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  choiceButtonSelected: {
    backgroundColor: '#4ECDC4',
  },
  choiceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  choiceButtonTextSelected: {
    color: '#FFFFFF',
  },
  customValueContainer: {
    marginTop: 12,
  },
  customValueLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  customValueInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 10,
    fontSize: 14,
  },
  customValueInputSelected: {
    borderColor: '#4ECDC4',
    borderWidth: 2,
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  resolveButton: {
    flex: 2,
    backgroundColor: '#4ECDC4',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resolveButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  resolveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
