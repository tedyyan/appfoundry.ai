import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  createTestUser, 
  setupDefaultTestUsers, 
  DEFAULT_TEST_USERS 
} from '../services/testUsers';

export const TestUserManager = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [fullName, setFullName] = useState('Test User');

  const handleCreateDefaultUsers = async () => {
    setLoading(true);
    try {
      const results = await setupDefaultTestUsers();
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      Alert.alert(
        'Test Users Created',
        `✅ Created ${successful.length} users successfully\n${failed.length > 0 ? `❌ ${failed.length} failed` : ''}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomUser = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      const result = await createTestUser(email, password, fullName);
      
      if (result.success) {
        Alert.alert(
          'Success', 
          `Test user created successfully!\n\nEmail: ${email}\nPassword: ${password}\n\nYou can now login with these credentials.`
        );
        // Reset form
        setEmail('');
        setFullName('Test User');
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="flask" size={24} color="#007AFF" />
        <Text style={styles.title}>Test User Manager</Text>
      </View>
      
      <Text style={styles.subtitle}>
        Create test users that can login immediately without email verification
      </Text>

      {/* Quick Setup Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Setup</Text>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleCreateDefaultUsers}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="people" size={20} color="white" />
              <Text style={styles.buttonText}>Create Default Test Users</Text>
            </>
          )}
        </TouchableOpacity>
        
        <View style={styles.usersList}>
          <Text style={styles.usersListTitle}>Default users that will be created:</Text>
          {DEFAULT_TEST_USERS.map((user, index) => (
            <View key={index} style={styles.userItem}>
              <Text style={styles.userEmail}>{user.email}</Text>
              <Text style={styles.userPassword}>Password: {user.password}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Custom User Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Create Custom Test User</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={fullName}
          onChangeText={setFullName}
        />
        
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleCreateCustomUser}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#007AFF" />
          ) : (
            <>
              <Ionicons name="person-add" size={20} color="#007AFF" />
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                Create Custom User
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.warning}>
        <Ionicons name="warning" size={20} color="#FF6B35" />
        <Text style={styles.warningText}>
          This component is for development only. Remove before production deployment.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    lineHeight: 22,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: '#007AFF',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  usersList: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  usersListTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    color: '#555',
  },
  userItem: {
    marginBottom: 8,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  userPassword: {
    fontSize: 12,
    color: '#666',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  warningText: {
    fontSize: 14,
    color: '#FF6B35',
    marginLeft: 10,
    flex: 1,
  },
}); 