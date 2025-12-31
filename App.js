import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
enableScreens();
import React from 'react';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';

function MainApp() {
  const [isReady, setIsReady] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    // Simulate a minimum loading time to prevent flashing
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Starting SnapFind...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <AuthProvider>
        <StatusBar style="auto" />
        <AppContent />
      </AuthProvider>
    </NavigationContainer>
  );
}

function AppContent() {
  const { user, loading, initialized, error } = useAuth();

  console.log('App State:', { loading, initialized, hasUser: !!user, hasError: !!error });

  if (loading || !initialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error.message || 'An unknown error occurred'}</Text>
      </View>
    );
  }

  return user ? <AppNavigator /> : <AuthNavigator />;
}

export default function App() {
  return <MainApp />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'red',
    marginBottom: 10,
  },
  errorText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 16,
  },
});
