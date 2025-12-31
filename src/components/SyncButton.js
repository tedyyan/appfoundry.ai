import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { clearAndSyncFromSupabase } from '../services/localStorage';
import { useAuth } from '../contexts/AuthContext';

export const SyncButton = ({ onSyncComplete, style }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { user } = useAuth();

  const handleSync = async () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please sign in to sync your data.');
      return;
    }

    Alert.alert(
      'Sync with Supabase',
      'This will clear your local data and sync with the server. Your local changes may be lost. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sync',
          style: 'destructive',
          onPress: async () => {
            setIsSyncing(true);
            try {
              console.log('🔄 Starting clear and sync from Supabase...');
              const syncedObjects = await clearAndSyncFromSupabase(user.id);
              
              Alert.alert(
                'Sync Complete',
                `Successfully synced ${syncedObjects.length} objects from Supabase.`,
                [{ text: 'OK', onPress: () => onSyncComplete?.(syncedObjects) }]
              );
            } catch (error) {
              console.error('❌ Sync error:', error);
              Alert.alert(
                'Sync Failed',
                `Failed to sync: ${error.message}`,
                [{ text: 'OK' }]
              );
            } finally {
              setIsSyncing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[styles.syncButton, style]}
      onPress={handleSync}
      disabled={isSyncing}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color="white" />
      ) : (
        <Ionicons name="cloud-download" size={20} color="white" />
      )}
      <Text style={styles.syncButtonText}>
        {isSyncing ? 'Syncing...' : 'Sync with Server'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 25,
    marginVertical: 10,
  },
  syncButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
}); 