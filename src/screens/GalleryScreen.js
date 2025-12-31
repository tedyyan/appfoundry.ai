import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Dimensions,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { supabase } from '../services/supabase';
import { getUserPicturesWithObjectCounts, deletePictureAndObjects, generateSignedUrlForDisplay, extractFilePathFromUrl } from '../services/storageService';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');
const imageSize = (width - 60) / 2; // 2 columns with padding

export default function GalleryScreen({ navigation }) {
  const { user } = useAuth();
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState(null);

  useEffect(() => {
    loadImages();
  }, []);

  // Refresh gallery when screen comes into focus (e.g., after syncing in other screens)
  useFocusEffect(
    useCallback(() => {
      console.log('📸 Gallery screen focused, refreshing...');
      loadImages();
    }, [])
  );

  const loadImages = async () => {
    try {
      console.log('📸 Loading all images...');
      
      if (!user) {
        console.warn('⚠️ No user authenticated, cannot load images');
        setImages([]);
        return;
      }
      
      // Get pictures with object counts from storage service
      const picturesWithCounts = await getUserPicturesWithObjectCounts(user.id);
      
      console.log('🔍 DEBUG: Raw picturesWithCounts from storage service:', picturesWithCounts.length);
      picturesWithCounts.forEach((pic, i) => {
        console.log(`  Raw ${i + 1}. ${pic.name}: ${pic.objectCount} objects, URL: ${pic.url ? 'present' : 'missing'}`);
      });

      // Transform to match expected format and generate fresh signed URLs
      const transformedImages = await Promise.all(picturesWithCounts.map(async (pic) => {
        // Generate fresh signed URL for display
        const freshSignedUrl = await generateSignedUrlForDisplay(extractFilePathFromUrl(pic.url));
        
        return {
          id: pic.id || pic.url,
          uri: freshSignedUrl || pic.url, // Use fresh URL or fallback to stored URL
          created_at: pic.created_at,
          objectCount: pic.objectCount,
          hasObjects: pic.hasObjects,
          fileName: pic.name, // Store filename for deletion
          pictureName: pic.pictureName, // Add picture name from database
          originalUrl: pic.url, // Keep original for deletion purposes
        };
      }));
      
      console.log('🔍 DEBUG: After transformation:', transformedImages.length);
      transformedImages.forEach((img, i) => {
        console.log(`  Transformed ${i + 1}. ${img.fileName}: ${img.objectCount} objects, URI: ${img.uri ? 'present' : 'missing'}, ID: ${img.id ? 'present' : 'missing'}`);
      });
      
      // Sort by creation date (newest first)
      transformedImages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      console.log('🔍 DEBUG: After sorting:', transformedImages.length);
      transformedImages.forEach((img, i) => {
        console.log(`  Sorted ${i + 1}. ${img.fileName}: ${img.objectCount} objects, DATE: ${img.created_at}`);
      });
      
      // Debug object counts
      const totalObjects = transformedImages.reduce((sum, img) => sum + img.objectCount, 0);
      console.log('📊 Found', transformedImages.length, 'pictures with', totalObjects, 'total objects');
      transformedImages.forEach((img, i) => {
        console.log(`  ${i + 1}. ${img.fileName}: ${img.objectCount} objects`);
      });
      
      console.log('🔍 DEBUG: About to call setImages with:', transformedImages.length, 'items');
      setImages(transformedImages);
      console.log('🔍 DEBUG: setImages called successfully');
      
      // Speech removed - was annoying when opening gallery
      // if (transformedImages.length > 0) {
      //   Speech.speak(`Gallery loaded with ${transformedImages.length} pictures`, {
      //     language: 'en-US',
      //     pitch: 1.0,
      //     rate: 0.9,
      //   });
      // }
      
    } catch (error) {
      console.error('❌ Error loading images:', error);
      Alert.alert('Error', 'Failed to load images from gallery.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadImages();
  };

  const handleImagePress = (image) => {
    // Navigate to full image view
    navigation.navigate('ImageViewer', {
      imageUri: image.uri,
      objectCount: image.objectCount,
      hasObjects: image.hasObjects,
      fileName: image.fileName,
      pictureName: image.pictureName,
      onDelete: () => loadImages(), // Refresh gallery after deletion
    });
  };

  const handleDeleteImage = async (image) => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to delete images');
      return;
    }

    Alert.alert(
      'Delete Picture',
      `Are you sure you want to delete this picture? This will also remove ${image.objectCount} associated object${image.objectCount !== 1 ? 's' : ''}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingImageId(image.id);
              console.log('🗑️ Deleting image:', { imageUri: image.originalUrl || image.uri, fileName: image.fileName });
              
              const result = await deletePictureAndObjects(user.id, image.originalUrl || image.uri, image.fileName);
              
              if (result.success) {
                Alert.alert('Success', result.message);
                // Speech.speak(`Picture deleted with ${result.objectsDeleted} objects`);
                
                // Remove from local state immediately
                setImages(prevImages => prevImages.filter(img => img.id !== image.id));
              } else {
                Alert.alert('Error', result.error || 'Failed to delete picture');
              }
            } catch (error) {
              console.error('❌ Error deleting image:', error);
              Alert.alert('Error', 'Failed to delete picture. Please try again.');
            } finally {
              setDeletingImageId(null);
            }
          },
        },
      ]
    );
  };

  const renderImageItem = ({ item }) => (
    <View style={styles.imageContainer}>
      <TouchableOpacity style={styles.imagePress} onPress={() => handleImagePress(item)}>
        <Image source={{ uri: item.uri }} style={styles.image} resizeMode="cover" />
        <View style={styles.imageOverlay}>
          <Text style={styles.pictureName} numberOfLines={1}>
            {item.pictureName || 'Untitled'}
          </Text>
          <Text style={styles.objectCount}>{item.objectCount} objects</Text>
          <Text style={styles.imageDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </TouchableOpacity>
      
      {/* Picture Details Button */}
      <TouchableOpacity 
        style={styles.detailsButton}
        onPress={() => navigation.navigate('PictureDetails', {
          imageUrl: item.uri,
          imageSource: { uri: item.uri }
        })}
      >
        <Ionicons name="document-text" size={14} color="white" />
      </TouchableOpacity>
      
      {/* Delete Button */}
      <TouchableOpacity 
        style={[styles.deleteButton, deletingImageId === item.id && styles.deletingButton]}
        onPress={() => handleDeleteImage(item)}
        disabled={deletingImageId === item.id}
      >
        {deletingImageId === item.id ? (
          <Ionicons name="hourglass" size={16} color="white" />
        ) : (
          <Ionicons name="trash" size={16} color="white" />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="camera-outline" size={80} color="#ccc" />
      <Text style={styles.emptyStateText}>No Pictures Yet</Text>
      <Text style={styles.emptyStateSubtext}>
        Take some pictures to see them here
      </Text>
      <TouchableOpacity
        style={styles.takePictureButton}
        onPress={() => navigation.navigate('Camera')}
      >
        <Ionicons name="camera" size={20} color="white" />
        <Text style={styles.takePictureButtonText}>Take First Picture</Text>
      </TouchableOpacity>
    </View>
  );

  // Debug what's being rendered
  console.log('🎨 RENDER DEBUG: images state has', images.length, 'items');
  console.log('🎨 RENDER DEBUG: isLoading =', isLoading);
  images.forEach((img, i) => {
    console.log(`  Render ${i + 1}. ${img.fileName}: ${img.objectCount} objects, ID: ${img.id}`);
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Picture Gallery</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Ionicons name="refresh" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {images.length === 0 && !isLoading ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={images}
          renderItem={renderImageItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.imageGrid}
          columnWrapperStyle={styles.imageRow}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  backButton: {
    width: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    width: 40,
    alignItems: 'flex-end',
  },
  imageGrid: {
    padding: 20,
  },
  imageRow: {
    justifyContent: 'space-between',
  },
  imageContainer: {
    width: imageSize,
    height: imageSize,
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  imagePress: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '75%',
  },
  detailsButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(33, 150, 243, 0.9)',
    borderRadius: 15,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 5,
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 69, 58, 0.9)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 5,
  },
  deletingButton: {
    backgroundColor: 'rgba(255, 69, 58, 0.6)',
  },
  imageOverlay: {
    flex: 1,
    padding: 8,
    justifyContent: 'space-between',
  },
  pictureName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  objectCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  imageDate: {
    fontSize: 10,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  takePictureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  takePictureButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
}); 