import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchObjectsWithPictureNames, getAllObjectsWithPictureNames } from '../services/localStorage';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { generateSignedUrlForDisplay } from '../services/storageService';

export default function SearchScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const searchObjectsLocal = async (query) => {
    setIsLoading(true);
    try {
      if (!query.trim()) {
        // If no query, show all objects
        console.log('No search query - showing all objects');
        const results = await getAllObjectsWithPictureNames();
        
        // Generate display URLs for each result
        const resultsWithDisplayUrls = await Promise.all(
          results.map(async (result) => {
            const displayUrl = await generateSignedUrlForDisplay(result.image_url);
            return {
              ...result,
              displayUrl: displayUrl || result.image_url,
            };
          })
        );
        
        setSearchResults(resultsWithDisplayUrls);
        return;
      }

      console.log('Searching for:', query);
      
      // Search objects with picture names
      const results = await searchObjectsWithPictureNames(query);
      
      // Generate display URLs for each result
      const resultsWithDisplayUrls = await Promise.all(
        results.map(async (result) => {
          const displayUrl = await generateSignedUrlForDisplay(result.image_url);
          return {
            ...result,
            displayUrl: displayUrl || result.image_url, // Fallback to original if generation fails
          };
        })
      );
      
      setSearchResults(resultsWithDisplayUrls);
    } catch (error) {
      console.error('Error searching objects:', error);
      Alert.alert('Error', 'Failed to search objects. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    searchObjectsLocal(searchQuery);
  };

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => {
        // Navigate to full image view
        navigation.navigate('ImageViewer', {
          imageUri: item.displayUrl || item.image_url, // Use displayUrl for navigation too
          objectName: item.object_name,
          pictureName: item.picture_name || `Picture ${new Date(item.created_at).toLocaleDateString()}`,
        });
      }}
    >
      <Image source={{ uri: item.displayUrl || item.image_url }} style={styles.resultImage} />
      <View style={styles.resultContent}>
        <Text style={styles.resultObjectName}>{item.object_name}</Text>
        <Text style={styles.resultPictureName}>
          📷 {item.picture_name || `Picture ${new Date(item.created_at).toLocaleDateString()}`}
        </Text>
        <Text style={styles.resultDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Find Objects</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for objects..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.searchButton, isLoading && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={isLoading}
          >
            <Ionicons name="search" size={16} color="white" />
            <Text style={styles.searchButtonText}>
              {isLoading ? 'Searching...' : 'Search'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.showAllButton, isLoading && styles.searchButtonDisabled]}
            onPress={() => {
              setSearchQuery('');
              searchObjectsLocal('');
            }}
            disabled={isLoading}
          >
            <Ionicons name="list" size={16} color="#2196F3" />
            <Text style={styles.showAllButtonText}>Show All</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.resultsContainer}>
        {searchResults.length > 0 ? (
          <>
            <Text style={styles.resultsHeader}>
              Found {searchResults.length} result{searchResults.length === 1 ? '' : 's'}
            </Text>
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.resultsList}
            />
          </>
        ) : searchQuery && !isLoading ? (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>No objects found</Text>
            <Text style={styles.emptyStateSubtext}>
              Try searching for different keywords
            </Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="camera" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>Start searching</Text>
            <Text style={styles.emptyStateSubtext}>
              Search for objects you've captured or tap "Show All" to see everything
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  searchContainer: {
    backgroundColor: 'white',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchButton: {
    backgroundColor: '#2196F3',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  searchButtonDisabled: {
    backgroundColor: '#999',
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  showAllButton: {
    backgroundColor: 'white',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2196F3',
    flex: 1,
  },
  showAllButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  resultsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  resultsList: {
    paddingBottom: 20,
  },
  resultItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  resultImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 15,
  },
  resultContent: {
    flex: 1,
    justifyContent: 'center',
  },
  resultObjectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'capitalize',
    marginBottom: 3,
  },
  resultPictureName: {
    fontSize: 14,
    color: '#2196F3',
    fontStyle: 'italic',
    marginBottom: 3,
  },
  resultDate: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#999',
    marginTop: 15,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 10,
    textAlign: 'center',
  },
}); 