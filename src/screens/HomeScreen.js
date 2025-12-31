import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();

  const handleTakePicture = () => {
    navigation.navigate('Camera');
  };

  const handleFindObject = () => {
    navigation.navigate('Search');
  };

  const handleViewGallery = () => {
    navigation.navigate('Gallery');
  };

  const handleProfile = () => {
    navigation.navigate('Profile');
  };

  return (
    <LinearGradient 
      colors={['#667eea', '#764ba2']} 
      style={styles.container}
    >
      <SafeAreaView style={styles.safeContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>SnapFindMy</Text>
            <Text style={styles.subtitle}>AI-powered object discovery</Text>
          </View>
        </View>

        {/* Welcome Message */}
        {user && (
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>
              Welcome back, {user.user_metadata?.full_name || 'Explorer'}! 👋
            </Text>
          </View>
        )}

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Central Camera Button */}
          <View style={styles.cameraSection}>
            <TouchableOpacity 
              style={styles.cameraButton}
              onPress={handleTakePicture}
              activeOpacity={0.8}
            >
              <View style={styles.cameraButtonInner}>
                <Ionicons name="camera" size={48} color="white" />
              </View>
              <View style={styles.cameraButtonRing} />
            </TouchableOpacity>
            <Text style={styles.cameraButtonLabel}>Tap to capture</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleFindObject}
            >
              <View style={styles.actionButtonContent}>
                <Ionicons name="search" size={24} color="#667eea" />
                <Text style={styles.actionButtonText}>Find Objects</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleViewGallery}
            >
              <View style={styles.actionButtonContent}>
                <Ionicons name="images" size={24} color="#667eea" />
                <Text style={styles.actionButtonText}>View Gallery</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleProfile}
            >
              <View style={styles.actionButtonContent}>
                <Ionicons name="person" size={24} color="#667eea" />
                <Text style={styles.actionButtonText}>Profile</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>powered by CyberSky AI</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerCenter: {
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: 'white',
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '300',
  },
  welcomeContainer: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '400',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  cameraButton: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cameraButtonInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
    zIndex: 2,
  },
  cameraButtonRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    zIndex: 1,
  },
  cameraButtonLabel: {
    fontSize: 18,
    color: 'white',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 5,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  actionButtonContent: {
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '300',
  },
}); 