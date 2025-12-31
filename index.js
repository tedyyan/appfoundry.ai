import { registerRootComponent } from 'expo';
import { View, Text } from 'react-native';
import { ErrorBoundary } from 'react-error-boundary';
import React from 'react';

import App from './App';

// Add startup logging
console.log('App starting...');
console.log('Environment:', __DEV__ ? 'Development' : 'Production');

function ErrorFallback({ error }) {
  console.error('App Error:', error);
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' }}>
      <Text style={{ color: 'red', marginBottom: 10, fontSize: 18, fontWeight: 'bold' }}>Something went wrong</Text>
      <Text style={{ color: 'red', textAlign: 'center' }}>{error?.message || 'Unknown error occurred'}</Text>
    </View>
  );
}

function AppWithErrorBoundary() {
  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        console.error('Error caught by boundary:', error);
      }}
    >
      <App />
    </ErrorBoundary>
  );
}

try {
  registerRootComponent(AppWithErrorBoundary);
} catch (error) {
  console.error('Failed to register root component:', error);
  // Show a basic error screen if registration fails
  registerRootComponent(() => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' }}>
      <Text style={{ color: 'red', marginBottom: 10, fontSize: 18, fontWeight: 'bold' }}>Startup Error</Text>
      <Text style={{ color: 'red', textAlign: 'center' }}>{error?.message || 'Failed to start the app'}</Text>
    </View>
  ));
}
