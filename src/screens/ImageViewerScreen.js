import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deletePictureAndObjects } from '../services/storageService';
import { getObjectsForImage, getPictureMetadata } from '../services/localStorage';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');

export default function ImageViewerScreen({ navigation, route }) {
  const { user } = useAuth();
  const { imageUri, objectCount, hasObjects, fileName, pictureName, onDelete } = route.params;
  const [isDeleting, setIsDeleting] = useState(false);
  const [objects, setObjects] = useState([]);
  const [isLoadingObjects, setIsLoadingObjects] = useState(true);
  const [showObjectLabels, setShowObjectLabels] = useState(true);
  const [loadedPictureName, setLoadedPictureName] = useState(pictureName || '');

  useEffect(() => {
    loadObjects();
  }, []);

  const loadObjects = async () => {
    try {
      if (!user) {
        setIsLoadingObjects(false);
        return;
      }

      console.log('🔍 Loading objects for image viewer...');
      const imageObjects = await getObjectsForImage(imageUri, user.id);
      
      // Load picture name if not provided in route params
      if (!pictureName && imageObjects.length > 0) {
        console.log('📝 Loading picture name from database...');
        const pictureMetadata = await getPictureMetadata(imageUri, user.id);
        if (pictureMetadata && pictureMetadata.picture_name) {
          setLoadedPictureName(pictureMetadata.picture_name);
        } else {
          // Generate default name based on creation date
          const defaultName = `Picture ${new Date(imageObjects[0].created_at).toLocaleDateString()}`;
          setLoadedPictureName(defaultName);
        }
      }
      
      // Add positions for object labels (use saved coordinates if available, otherwise fallback)
      const objectsWithPositions = imageObjects.map((obj, index) => ({
        ...obj,
        position: obj.x_position !== null && obj.y_position !== null 
          ? convertPercentageToPixelPosition(obj.x_position, obj.y_position)
          : generateRandomPosition(index, imageObjects.length),
        hasStoredCoords: obj.x_position !== null && obj.y_position !== null,
      }));
      
      setObjects(objectsWithPositions);
      console.log('📊 Loaded', objectsWithPositions.length, 'objects for display');
    } catch (error) {
      console.error('❌ Error loading objects:', error);
    } finally {
      setIsLoadingObjects(false);
    }
  };

  // Convert percentage coordinates to pixel positions
  const convertPercentageToPixelPosition = (xPercent, yPercent) => {
    const imageHeight = 250; // Image container height
    const labelWidth = 120; // Approximate label width
    const labelHeight = 35; // Approximate label height
    const padding = 10; // Padding from edges
    
    // Convert percentage to pixels within the image container bounds
    const x = (xPercent / 100) * (width - 40); // Account for container padding
    const y = (yPercent / 100) * imageHeight;
    
    // Ensure label stays within bounds and center it on the coordinate point
    return {
      left: Math.max(padding, Math.min(width - labelWidth - padding, x - labelWidth / 2 + 20)), // +20 for container margin
      top: Math.max(padding, Math.min(imageHeight - labelHeight - padding, y - labelHeight / 2)),
    };
  };

  // Generate random but distributed positions for object labels
  const generateRandomPosition = (index, total) => {
    const padding = 20; // Padding from edges
    const labelWidth = 120; // Approximate label width
    const labelHeight = 35; // Approximate label height
    
    // Create a grid-like distribution to avoid overlap
    const cols = Math.ceil(Math.sqrt(total));
    const rows = Math.ceil(total / cols);
    
    const col = index % cols;
    const row = Math.floor(index / cols);
    
    // Calculate grid position with some randomness
    const baseX = (col / (cols - 1 || 1)) * (width - labelWidth - padding * 2) + padding;
    const baseY = (row / (rows - 1 || 1)) * (250 - labelHeight - padding * 2) + padding; // 250 is image container height
    
    // Add some randomness to avoid perfect grid
    const randomX = baseX + (Math.random() - 0.5) * 30;
    const randomY = baseY + (Math.random() - 0.5) * 30;
    
    return {
      left: Math.max(padding, Math.min(width - labelWidth - padding, randomX)),
      top: Math.max(padding, Math.min(250 - labelHeight - padding, randomY)),
    };
  };

  const handleEditObjects = () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please sign in to edit objects.');
      return;
    }

    navigation.navigate('ObjectConfirmation', {
      imageUrl: imageUri,
      localImageUri: imageUri,
      detectedObjects: [], // Will be loaded in ObjectConfirmationScreen
      isEditMode: true,
    });
  };

  const toggleObjectLabels = () => {
    setShowObjectLabels(!showObjectLabels);
  };

  const handleDeleteImage = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to delete images');
      return;
    }

    Alert.alert(
      'Delete Picture',
      `Are you sure you want to delete this picture? This will also remove ${objects.length} associated object${objects.length !== 1 ? 's' : ''}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              console.log('🗑️ Deleting image from viewer:', { imageUri, fileName });
              
              const result = await deletePictureAndObjects(user.id, imageUri, fileName);
              
              if (result.success) {
                Alert.alert('Success', result.message);
                
                // Call onDelete callback to refresh gallery
                if (onDelete) {
                  onDelete();
                }
                
                // Navigate back to gallery
                navigation.goBack();
              } else {
                Alert.alert('Error', result.error || 'Failed to delete picture');
              }
            } catch (error) {
              console.error('❌ Error deleting image:', error);
              Alert.alert('Error', 'Failed to delete picture. Please try again.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.title}>Image Viewer</Text>
        
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('PictureDetails', {
              imageUrl: imageUri,
              imageSource: { uri: imageUri }
            })}
          >
            <Ionicons name="document-text" size={24} color="#333" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={toggleObjectLabels}
          >
            <Ionicons 
              name={showObjectLabels ? "eye" : "eye-off"} 
              size={24} 
              color="#333" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.headerButton, styles.deleteHeaderButton, isDeleting && styles.deletingHeaderButton]}
            onPress={handleDeleteImage}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Ionicons name="hourglass" size={24} color="white" />
            ) : (
              <Ionicons name="trash" size={24} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: imageUri }} 
            style={styles.image}
            resizeMode="cover"
          />
          
          {/* Object Labels Overlay */}
          {showObjectLabels && objects.length > 0 && !isLoadingObjects && (
            <View style={styles.objectLabelsContainer}>
              {objects.map((obj, index) => (
                <TouchableOpacity
                  key={obj.id}
                  style={[
                    styles.objectLabel,
                    {
                      left: obj.position.left,
                      top: obj.position.top,
                    }
                  ]}
                  onPress={() => {
                    Alert.alert(
                      'Object Found',
                      `"${obj.object_name}" detected in this image`,
                      [{ text: 'OK' }]
                    );
                  }}
                >
                  <View style={styles.objectLabelContent}>
                    <Ionicons 
                      name={obj.hasStoredCoords ? "location" : "pricetag"} 
                      size={12} 
                      color="white" 
                    />
                    <Text style={styles.objectLabelText}>{obj.object_name}</Text>
                  </View>
                  <View style={styles.objectLabelPointer} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {/* Loading Overlay */}
          {isLoadingObjects && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingContent}>
                <Ionicons name="hourglass" size={24} color="white" />
                <Text style={styles.loadingText}>Loading objects...</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          {loadedPictureName && (
            <View style={styles.pictureNameContainer}>
              <Text style={styles.pictureNameText}>{loadedPictureName}</Text>
            </View>
          )}
          
          <View style={styles.objectInfo}>
            <View style={styles.objectCount}>
              <Ionicons name="pricetag" size={20} color="#2196F3" />
              <Text style={styles.objectCountText}>
                {isLoadingObjects ? 'Loading...' : `${objects.length} object${objects.length !== 1 ? 's' : ''} detected`}
              </Text>
            </View>
            
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleEditObjects}
              disabled={isLoadingObjects}
            >
              <Ionicons name="create" size={20} color="white" />
              <Text style={styles.editButtonText}>Edit Objects</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.instructionText}>
            {showObjectLabels ? 'Tap eye icon to hide labels' : 'Tap eye icon to show labels'} • Tap labels for details • Tap "Edit Objects" to modify
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  backButton: {
    padding: 5,
  },
  title: {
    color: '#333',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 10,
  },
  deleteHeaderButton: {
    backgroundColor: '#F44336',
    borderRadius: 20,
  },
  deletingHeaderButton: {
    backgroundColor: '#999',
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    margin: 20,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  image: {
    width: '100%',
    height: 250,
  },
  objectLabelsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  objectLabel: {
    position: 'absolute',
    backgroundColor: 'rgba(33, 150, 243, 0.9)',
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  objectLabelContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  objectLabelText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  objectLabelPointer: {
    position: 'absolute',
    bottom: -4,
    left: '50%',
    marginLeft: -4,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(33, 150, 243, 0.9)',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 8,
    fontSize: 14,
  },
  infoSection: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pictureNameContainer: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pictureNameText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  objectInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  objectCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.3)',
    flex: 1,
    marginRight: 15,
  },
  objectCountText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  editButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  instructionText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
}); 