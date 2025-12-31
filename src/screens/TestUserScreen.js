import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { TestUserManager } from '../components/TestUserManager';

export default function TestUserScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <TestUserManager />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
}); 