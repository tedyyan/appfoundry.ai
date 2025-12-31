import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { clearAndSyncFromSupabase, getDailyUsageStats } from '../services/localStorage';
import { supabase } from '../services/supabase';
import { getUserStorageStats } from '../services/storageService';
import { SyncButton } from '../components/SyncButton';

export default function ProfileScreen({ navigation }) {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [stats, setStats] = useState({
    totalImages: 0,
    totalObjects: 0,
    lastActivity: null,
    storageUsed: '0.00',
  });
  const [dailyStats, setDailyStats] = useState({
    todayCount: 0,
    weekCount: 0,
    monthCount: 0,
    limit: 10,
  });
  const [loading, setLoading] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactTitle, setContactTitle] = useState('');
  const [contactMessage, setContactMessage] = useState('');

  const { user, signOut, updateProfile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || '');
      loadUserStats();
    }
  }, [user]);

  const loadUserStats = async () => {
    try {
      console.log('📊 Loading user statistics (active items only)...');
      
      // Get updated stats from the improved storage service (active items only)
      const storageStats = await getUserStorageStats(user.id);
      
      // Get daily usage stats
      const usageStats = await getDailyUsageStats(user.id);
      
      // Get last activity from database using the normalized structure
      const { data: recentActivity } = await supabase
        .from('objects_with_pictures')
        .select('object_created_at')
        .eq('user_id', user.id)
        .order('object_created_at', { ascending: false })
        .limit(1);

      setStats({
        totalImages: storageStats.totalImages,
        totalObjects: storageStats.totalObjects, 
        lastActivity: recentActivity?.[0]?.object_created_at || null,
        storageUsed: storageStats.totalSizeMB,
      });

      setDailyStats(usageStats);
      
      console.log('📊 Stats loaded (active only):', {
        totalImages: storageStats.totalImages,
        totalObjects: storageStats.totalObjects,
        storageUsed: storageStats.totalSizeMB + ' MB',
        dailyUsage: `${usageStats.todayCount}/${usageStats.limit}`,
      });
    } catch (error) {
      console.error('❌ Error loading user stats:', error);
      // Set fallback stats if there's an error
      setStats({
        totalImages: 0,
        totalObjects: 0,
        lastActivity: null,
        storageUsed: '0.00',
      });
      setDailyStats({
        todayCount: 0,
        weekCount: 0,
        monthCount: 0,
        limit: 10,
      });
    }
  };

  const handleUpdateProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Full name cannot be empty');
      return;
    }

    setLoading(true);
    const result = await updateProfile({ full_name: fullName.trim() });
    setLoading(false);

    if (result.success) {
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const result = await signOut();
            if (result.success) {
              // Sign out successful
            } else {
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Deletion',
              'Please contact support to delete your account.',
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown';
    }
  };

  const handleContactUs = () => {
    setShowContactModal(true);
  };

  const handleSendEmail = async () => {
    if (!contactTitle.trim() || !contactMessage.trim()) {
      Alert.alert('Error', 'Please fill in both title and message fields.');
      return;
    }

    const emailSubject = `SnapFindMy Support: ${contactTitle.trim()}`;
    const emailBody = `Hello SnapFindMy Team,

${contactMessage.trim()}

---
User Details:
- Email: ${user.email}
- User ID: ${user.id}
- App Version: 1.0.4
- Date: ${new Date().toISOString()}

Best regards,
${fullName || 'SnapFindMy User'}`;

    const emailUrl = `mailto:tedy.yan@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    try {
      const canOpen = await Linking.canOpenURL(emailUrl);
      if (canOpen) {
        await Linking.openURL(emailUrl);
        setShowContactModal(false);
        setContactTitle('');
        setContactMessage('');
        Alert.alert('Email Opened', 'Your default email app has been opened with the message.');
      } else {
        Alert.alert('Error', 'Could not open email app. Please email us directly at tedy.yan@gmail.com');
      }
    } catch (error) {
      console.error('Error opening email:', error);
      Alert.alert('Error', 'Could not open email app. Please email us directly at tedy.yan@gmail.com');
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsEditing(!isEditing)}
          >
            <Ionicons name={isEditing ? "close" : "create-outline"} size={24} color="#2196F3" />
          </TouchableOpacity>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>


          {isEditing ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.nameInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Full Name"
                autoCapitalize="words"
              />
              <TouchableOpacity
                style={[styles.saveButton, loading && styles.disabledButton]}
                onPress={handleUpdateProfile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.profileInfo}>
              <Text style={styles.fullName}>{fullName || 'No name set'}</Text>
              <Text style={styles.email}>{user.email}</Text>
              <Text style={styles.joinDate}>
                Joined {formatDate(user.created_at)}
              </Text>
            </View>
          )}
        </View>

        {/* Statistics */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Activity Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="images-outline" size={30} color="#2196F3" />
              <Text style={styles.statNumber}>{stats.totalImages}</Text>
              <Text style={styles.statLabel}>Images</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="cube-outline" size={30} color="#4CAF50" />
              <Text style={styles.statNumber}>{stats.totalObjects}</Text>
              <Text style={styles.statLabel}>Objects</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="cloud-outline" size={30} color="#9C27B0" />
              <Text style={styles.statNumber}>{stats.storageUsed}</Text>
              <Text style={styles.statLabel}>MB Used</Text>
            </View>
          </View>
          <View style={styles.lastActivityContainer}>
            <Ionicons name="time-outline" size={20} color="#FF9800" />
            <Text style={styles.lastActivityLabel}>Last Activity: </Text>
            <Text style={styles.lastActivityDate}>{formatDate(stats.lastActivity)}</Text>
          </View>
        </View>

        {/* Daily Usage Stats */}
        <View style={styles.dailyStatsSection}>
          <Text style={styles.sectionTitle}>Daily Usage Limit</Text>
          <View style={styles.dailyUsageProgress}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Today's Pictures</Text>
              <Text style={styles.progressCount}>{dailyStats.todayCount} / {dailyStats.limit}</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBar, 
                  { width: `${Math.min((dailyStats.todayCount / dailyStats.limit) * 100, 100)}%` }
                ]} 
              />
            </View>
            <View style={styles.progressFooter}>
              <Text style={styles.remainingText}>
                {dailyStats.limit - dailyStats.todayCount} pictures remaining today
              </Text>
              <Text style={styles.resetText}>Resets at midnight</Text>
            </View>
          </View>
          <View style={styles.weeklyStats}>
            <View style={styles.weeklyStatItem}>
              <Text style={styles.weeklyStatNumber}>{dailyStats.weekCount}</Text>
              <Text style={styles.weeklyStatLabel}>This Week</Text>
            </View>
            <View style={styles.weeklyStatItem}>
              <Text style={styles.weeklyStatNumber}>{dailyStats.monthCount}</Text>
              <Text style={styles.weeklyStatLabel}>This Month</Text>
            </View>
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('Gallery')}
          >
            <Ionicons name="images-outline" size={24} color="#2196F3" />
            <Text style={styles.actionText}>View My Pictures</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={loadUserStats}
          >
            <Ionicons name="refresh-outline" size={24} color="#4CAF50" />
            <Text style={styles.actionText}>Refresh Stats</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleContactUs}
          >
            <Ionicons name="mail-outline" size={24} color="#FF9800" />
            <Text style={styles.actionText}>Contact Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          {/* Sync Button */}
          <View style={styles.syncContainer}>
            <SyncButton 
              onSyncComplete={(syncedObjects) => {
                console.log(`✅ Sync complete: ${syncedObjects.length} objects`);
                loadUserStats(); // Refresh stats after sync
              }}
            />
            <Text style={styles.syncDescription}>
              Clear local data and sync with server (Supabase is authoritative)
            </Text>
          </View>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleSignOut}
            disabled={authLoading}
          >
            <Ionicons name="log-out-outline" size={24} color="#FF5722" />
            <Text style={[styles.actionText, { color: '#FF5722' }]}>Sign Out</Text>
            {authLoading ? (
              <ActivityIndicator size="small" color="#FF5722" />
            ) : (
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleDeleteAccount}
          >
            <Ionicons name="trash-outline" size={24} color="#F44336" />
            <Text style={[styles.actionText, { color: '#F44336' }]}>Delete Account</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.appInfoSection}>
          <Text style={styles.appInfo}>SnapFindMy v1.0.4</Text>
          <Text style={styles.appInfo}>AI-powered object recognition</Text>
        </View>
      </ScrollView>

      {/* Contact Modal */}
      <Modal
        visible={showContactModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowContactModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Contact Support</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowContactModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalDescription}>
                Send us a message and we'll get back to you as soon as possible!
              </Text>

              <Text style={styles.inputLabel}>Subject *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="What's this about?"
                value={contactTitle}
                onChangeText={setContactTitle}
                maxLength={100}
              />
              <Text style={styles.characterCount}>{contactTitle.length}/100</Text>

              <Text style={styles.inputLabel}>Message *</Text>
              <TextInput
                style={[styles.modalInput, styles.messageInput]}
                placeholder="Tell us more about your question or feedback..."
                value={contactMessage}
                onChangeText={setContactMessage}
                multiline={true}
                numberOfLines={6}
                maxLength={1000}
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>{contactMessage.length}/1000</Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowContactModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sendButton, (!contactTitle.trim() || !contactMessage.trim()) && styles.disabledButton]}
                  onPress={handleSendEmail}
                  disabled={!contactTitle.trim() || !contactMessage.trim()}
                >
                  <Ionicons name="mail" size={16} color="white" />
                  <Text style={styles.sendButtonText}>Send Email</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  backButton: {
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  editButton: {
    width: 40,
    alignItems: 'flex-end',
  },
  profileSection: {
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },

  editContainer: {
    width: '100%',
    alignItems: 'center',
  },
  nameInput: {
    width: '100%',
    height: 45,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  profileInfo: {
    alignItems: 'center',
  },
  fullName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  joinDate: {
    fontSize: 14,
    color: '#999',
  },
  statsSection: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statDate: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  lastActivityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  lastActivityLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  lastActivityDate: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  actionsSection: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  appInfoSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  appInfo: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  syncContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    alignItems: 'center',
  },
  syncDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  dailyStatsSection: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
  },
  dailyUsageProgress: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  progressCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  remainingText: {
    fontSize: 12,
    color: '#666',
  },
  resetText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  weeklyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weeklyStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  weeklyStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  weeklyStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 5,
  },
  modalBody: {
    padding: 20,
  },
  modalDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 15,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  messageInput: {
    height: 120,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 5,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  sendButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  sendButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
}); 