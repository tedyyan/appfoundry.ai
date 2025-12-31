import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  Alert,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { saveObject, getObjectsForImage, savePictureMetadata } from '../services/localStorage';
import { safeUserId, debugUserId } from '../utils/userIdUtils';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { createStorageReference } from '../services/storageService';

const { width } = Dimensions.get('window');

// Funny default picture name generator
const generateFunnyPictureName = () => {
  const adjectives = [
    'Mysterious', 'Sneaky', 'Magical', 'Wobbly', 'Sparkly', 'Bouncy', 'Giggly', 'Fluffy',
    'Dizzy', 'Quirky', 'Silly', 'Funky', 'Wacky', 'Zany', 'Bubbly', 'Cheery', 'Goofy',
    'Peppy', 'Snappy', 'Zippy', 'Jolly', 'Merry', 'Perky', 'Spunky', 'Chipper', 'Dapper',
    'Nifty', 'Spiffy', 'Dandy', 'Fancy', 'Jazzy', 'Snazzy', 'Classy', 'Swanky', 'Posh'
  ];
  
  const nouns = [
    'Adventure', 'Discovery', 'Snapshot', 'Memory', 'Moment', 'Scene', 'Vision', 'Glimpse',
    'Treasure', 'Wonder', 'Surprise', 'Mystery', 'Journey', 'Quest', 'Expedition', 'Safari',
    'Exploration', 'Investigation', 'Hunt', 'Search', 'Find', 'Catch', 'Capture', 'Shot',
    'Frame', 'View', 'Sight', 'Spectacle', 'Marvel', 'Miracle', 'Magic', 'Enchantment',
    'Delight', 'Joy', 'Happiness', 'Bliss', 'Euphoria', 'Ecstasy', 'Rapture', 'Thrill'
  ];
  
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${randomAdjective} ${randomNoun}`;
};

export default function ObjectConfirmationScreen({ navigation, route }) {
  const { imageUrl, detectedObjects, localImageUri, existingObjects, isEditMode } = route.params;
  
  // Handle both old format (array of strings) and new format (array of objects with coordinates)
  const initialObjects = detectedObjects || [];
  const objectNames = Array.isArray(initialObjects) ? 
    (initialObjects.length > 0 && typeof initialObjects[0] === 'object' ? 
      initialObjects.map(obj => obj.name) : 
      initialObjects) : 
    [];
  
  const [objects, setObjects] = useState(objectNames);
  const [detectedObjectsWithCoords, setDetectedObjectsWithCoords] = useState(
    Array.isArray(initialObjects) && initialObjects.length > 0 && typeof initialObjects[0] === 'object' ? 
      initialObjects : 
      []
  );
  const [existingObjectsData, setExistingObjectsData] = useState(existingObjects || []);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(!!isEditMode);
  const [showObjectLabels, setShowObjectLabels] = useState(true);
  const [objectsWithPositions, setObjectsWithPositions] = useState([]);
  const [pictureName, setPictureName] = useState('');
  const [savingProgress, setSavingProgress] = useState(0);
  const [savingStep, setSavingStep] = useState('');
  const { user } = useAuth();

  // Animation references
  const spinValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;
  const progressValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isEditMode && user) {
      loadExistingObjects();
    } else {
      // For new pictures, set a funny default name
      setPictureName(generateFunnyPictureName());
    }
  }, [isEditMode, user]);

  // Start animations when loading
  useEffect(() => {
    if (isLoading) {
      startSavingAnimation();
    } else {
      stopSavingAnimation();
    }
  }, [isLoading]);

  const startSavingAnimation = () => {
    // Spinning animation
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Scaling animation
    const scaleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleValue, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    spinAnimation.start();
    scaleAnimation.start();
  };

  const stopSavingAnimation = () => {
    spinValue.stopAnimation();
    scaleValue.stopAnimation();
    progressValue.stopAnimation();
    
    // Reset to initial values
    spinValue.setValue(0);
    scaleValue.setValue(1);
    progressValue.setValue(0);
  };

  const updateProgress = (step, progress) => {
    setSavingStep(step);
    setSavingProgress(progress);
    
    Animated.timing(progressValue, {
      toValue: progress / 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  // Update object positions when objects change
  useEffect(() => {
    if (objects.length > 0) {
      const objectsWithPos = objects.map((objName, index) => {
        // Try to find coordinates from detected objects
        const detectedObj = detectedObjectsWithCoords.find(obj => obj.name === objName);
        
        const position = detectedObj ? 
          convertPercentageToPixelPosition(detectedObj.x, detectedObj.y) :
          generateRandomPosition(index, objects.length);
          
        return {
          id: `${index}_${objName}`,
          object_name: objName,
          position,
          hasRealCoords: !!detectedObj,
        };
      });
      setObjectsWithPositions(objectsWithPos);
    } else {
      setObjectsWithPositions([]);
    }
  }, [objects, detectedObjectsWithCoords]);

  const loadExistingObjects = async () => {
    try {
      console.log('🔍 Loading existing objects and picture metadata for editing...');
      
      // Load existing objects
      const imageObjects = await getObjectsForImage(imageUrl, user.id);
      setExistingObjectsData(imageObjects);
      
      // Convert existing objects to editable format (just object names)
      const objectNames = imageObjects.map(obj => obj.object_name);
      setObjects(objectNames);
      
      // Load existing picture metadata to get the current name
      try {
        const { getPictureMetadata } = require('../services/localStorage');
        const metadata = await getPictureMetadata(imageUrl, user.id);
        if (metadata && metadata.picture_name) {
          setPictureName(metadata.picture_name);
          console.log('📝 Loaded existing picture name:', metadata.picture_name);
        }
      } catch (metadataError) {
        console.log('📝 No existing picture metadata found or error loading:', metadataError.message);
      }
      
      console.log('📊 Loaded', imageObjects.length, 'existing objects for editing');
    } catch (error) {
      console.error('❌ Error loading existing objects:', error);
      Alert.alert('Error', 'Failed to load existing objects.');
    } finally {
      setIsLoadingExisting(false);
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
    const imageHeight = 250; // Image container height
    
    // Create a grid-like distribution to avoid overlap
    const cols = Math.ceil(Math.sqrt(total));
    const rows = Math.ceil(total / cols);
    
    const col = index % cols;
    const row = Math.floor(index / cols);
    
    // Calculate grid position with some randomness
    const baseX = (col / (cols - 1 || 1)) * (width - labelWidth - padding * 2) + padding;
    const baseY = (row / (rows - 1 || 1)) * (imageHeight - labelHeight - padding * 2) + padding;
    
    // Add some randomness to avoid perfect grid
    const randomX = baseX + (Math.random() - 0.5) * 30;
    const randomY = baseY + (Math.random() - 0.5) * 30;
    
    return {
      left: Math.max(padding, Math.min(width - labelWidth - padding, randomX)),
      top: Math.max(padding, Math.min(imageHeight - labelHeight - padding, randomY)),
    };
  };

  const toggleObjectLabels = () => {
    setShowObjectLabels(!showObjectLabels);
  };

  const handleObjectEdit = (index, newName) => {
    const updatedObjects = [...objects];
    updatedObjects[index] = newName;
    setObjects(updatedObjects);
  };

  const handleObjectDelete = (index) => {
    const updatedObjects = objects.filter((_, i) => i !== index);
    setObjects(updatedObjects);
  };

  const saveObjects = async () => {
    if (objects.length === 0) {
      Alert.alert('No Objects', 'Please add at least one object before saving.');
      return;
    }

    if (!user) {
      Alert.alert('Authentication Required', 'Please sign in to save objects.');
      return;
    }

    setIsLoading(true);
    
    try {
      if (isEditMode) {

        console.log('🔄 Updating existing objects for user:', user.id);
        
        // For edit mode, we need to delete existing objects and save new ones
        const standardizedImageUrl = createStorageReference(imageUrl);
        
        // Get the picture_id for this image first
        const { data: pictureData, error: pictureError } = await supabase
          .from('pictures')
          .select('id')
          .eq('user_id', user.id)
          .eq('image_url', standardizedImageUrl)
          .single();

        if (pictureError || !pictureData) {
          console.error('❌ Error finding picture for edit mode:', pictureError);
          throw new Error('Picture not found for editing objects');
        }

        // Soft delete all existing objects for this picture
        const { error: deleteError } = await supabase
          .from('objects')
          .update({ deleted: true })
          .eq('picture_id', pictureData.id);

        if (deleteError) {
          console.error('❌ Error deleting existing objects:', deleteError);
          throw new Error('Failed to update objects');
        }

        console.log('✅ Deleted existing objects, now saving updated ones...');
      }

      console.log('📁 Saving', objects.length, 'objects for user:', user.id);
      
      // Debug and safely pass user ID (moved outside loop)
      const safeUserIdValue = safeUserId(user.id);
      debugUserId(user.id, 'ObjectConfirmationScreen');
      console.log('🔍 Saving objects with safe user ID:', safeUserIdValue);
      
      // Save objects sequentially to avoid race conditions
      for (let i = 0; i < objects.length; i++) {
        const objectName = objects[i];
        
        // Find coordinate data for this object
        const objWithCoords = detectedObjectsWithCoords.find(obj => obj.name === objectName);
        
        const objectData = {
          object_name: objectName.toLowerCase().trim(),
          x_position: objWithCoords?.x || null,
          y_position: objWithCoords?.y || null,
          has_ai_coordinates: !!objWithCoords,
        };
        
        console.log(`💾 Saving object: ${objectName}`, objWithCoords ? `at (${objWithCoords.x}%, ${objWithCoords.y}%)` : 'with fallback position');
        
        // Save using the new saveObject function (handles both local and cloud)
        await saveObject(objectData, safeUserIdValue, imageUrl);
      }
      
      // Save picture metadata (create for new pictures, update for edit mode)
      try {
        const finalName = pictureName.trim() || (isEditMode ? 'Untitled Picture' : generateFunnyPictureName());
        const defaultDescription = `Contains ${objects.length} detected object${objects.length !== 1 ? 's' : ''}: ${objects.join(', ')}`;
        
        console.log('📝 Saving picture metadata...');
        await savePictureMetadata(imageUrl, finalName, defaultDescription, safeUserIdValue);
        console.log('✅ Picture metadata saved successfully with name:', finalName);
      } catch (metadataError) {
        console.error('❌ Error saving picture metadata:', metadataError);
        // Don't fail the whole process if metadata saving fails
      }
      
      const successMessage = isEditMode 
        ? `Updated ${objects.length} object(s)!\n\nChanges have been saved.`
        : `Saved ${objects.length} object(s)!\n\nYou can now search for these objects!`;
      
      Alert.alert('Success!', successMessage, [
        {
          text: 'OK',
          onPress: () => {
            if (isEditMode) {
              navigation.goBack(); // Go back to gallery/image viewer
            } else {
              navigation.navigate('Home');
            }
          },
        },
      ]);
      
    } catch (error) {
      console.error('❌ Error saving objects:', error);
      Alert.alert('Error', 'Failed to save objects. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const addCustomObject = () => {
    Alert.prompt(
      'Add Object',
      'Enter the name of an object in this image:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Add',
          onPress: (text) => {
            if (text && text.trim()) {
              const newObjectName = text.trim();
              setObjects([...objects, newObjectName]);
              
              // Add fallback coordinates for manually added objects
              const existingCount = detectedObjectsWithCoords.length;
              const fallbackCoords = {
                name: newObjectName.toLowerCase(),
                x: 30 + (existingCount * 20) % 40, // Distribute across width
                y: 30 + (existingCount * 15) % 40, // Distribute across height
              };
              setDetectedObjectsWithCoords([...detectedObjectsWithCoords, fallbackCoords]);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isEditMode ? 'Edit Objects' : 'Confirm Objects'}
        </Text>
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={toggleObjectLabels}
        >
          <Ionicons 
            name={showObjectLabels ? "eye" : "eye-off"} 
            size={24} 
            color="#333" 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: localImageUri || imageUrl }} 
          style={styles.image}
          resizeMode="cover"
        />
        
        {/* Object Labels Overlay */}
        {showObjectLabels && objectsWithPositions.length > 0 && (
          <View style={styles.objectLabelsContainer}>
            {objectsWithPositions.map((obj) => (
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
                    name={obj.hasRealCoords ? "location" : "pricetag"} 
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
        
        {/* Loading Overlay for existing objects */}
        {isLoadingExisting && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContent}>
              <Ionicons name="hourglass" size={24} color="white" />
              <Text style={styles.loadingText}>Loading objects...</Text>
            </View>
          </View>
        )}
        
        {/* Fancy Saving Animation Overlay */}
        {isLoading && (
          <View style={styles.savingOverlay}>
            <View style={styles.savingContent}>
              {/* Animated spinning icon */}
              <Animated.View
                style={[
                  styles.spinningIcon,
                  {
                    transform: [
                      {
                        rotate: spinValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                      { scale: scaleValue },
                    ],
                  },
                ]}
              >
                <Ionicons name="cloud-upload" size={40} color="#2196F3" />
              </Animated.View>
              
              {/* Progress text */}
              <Text style={styles.savingTitle}>
                {isEditMode ? 'Updating Objects' : 'Saving Objects'}
              </Text>
              <Text style={styles.savingStep}>{savingStep}</Text>
              
              {/* Progress bar */}
              <View style={styles.progressContainer}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: progressValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              
              {/* Progress percentage */}
              <Text style={styles.progressText}>{Math.round(savingProgress)}%</Text>
              
              {/* Animated dots */}
              <View style={styles.dotsContainer}>
                <Animated.View style={[styles.dot, { opacity: progressValue }]} />
                <Animated.View 
                  style={[
                    styles.dot, 
                    { 
                      opacity: progressValue.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 1, 1],
                      }),
                    }
                  ]} 
                />
                <Animated.View 
                  style={[
                    styles.dot, 
                    { 
                      opacity: progressValue.interpolate({
                        inputRange: [0, 0.8, 1],
                        outputRange: [0, 0, 1],
                      }),
                    }
                  ]} 
                />
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Picture Name Input */}
      <View style={styles.pictureNameSection}>
        <Text style={styles.pictureNameLabel}>Picture Name (Optional)</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.pictureNameInput}
            value={pictureName}
            onChangeText={setPictureName}
            placeholder="Enter a name for this picture..."
            placeholderTextColor="#999"
            maxLength={100}
          />
          {pictureName.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setPictureName('')}
            >
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.characterCount}>{pictureName.length}/100</Text>
      </View>

      <View style={styles.objectsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {isEditMode ? 'Objects in this Image' : 'Detected Objects'}
          </Text>
          <TouchableOpacity style={styles.addButton} onPress={addCustomObject}>
            <Ionicons name="add" size={20} color="#2196F3" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {isLoadingExisting ? (
          <View style={styles.emptyState}>
            <Ionicons name="hourglass" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>Loading objects...</Text>
          </View>
        ) : objects.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>
              {isEditMode ? 'No objects in this image' : 'No objects detected'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Tap "Add" to manually add objects
            </Text>
          </View>
        ) : (
          objects.map((object, index) => (
            <ObjectItem
              key={index}
              object={object}
              onEdit={(newName) => handleObjectEdit(index, newName)}
              onDelete={() => handleObjectDelete(index)}
            />
          ))
        )}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={saveObjects}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>
            {isLoading 
              ? (isEditMode ? 'Updating...' : 'Saving...') 
              : (isEditMode ? `Update ${objects.length} Object(s)` : `Save ${objects.length} Object(s)`)
            }
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function ObjectItem({ object, onEdit, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(object);

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onEdit(editText.trim());
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditText(object);
    setIsEditing(false);
  };

  return (
    <View style={styles.objectItem}>
      {isEditing ? (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.editInput}
            value={editText}
            onChangeText={setEditText}
            autoFocus
            onSubmitEditing={handleSaveEdit}
          />
          <View style={styles.editActions}>
            <TouchableOpacity onPress={handleSaveEdit} style={styles.editSaveButton}>
              <Ionicons name="checkmark" size={16} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCancelEdit} style={styles.editCancelButton}>
              <Ionicons name="close" size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.objectContent}>
          <Text style={styles.objectName}>{object}</Text>
          <View style={styles.objectActions}>
            <TouchableOpacity
              onPress={() => setIsEditing(true)}
              style={styles.editButton}
            >
              <Ionicons name="pencil" size={16} color="#2196F3" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
              <Ionicons name="trash" size={16} color="#f44336" />
            </TouchableOpacity>
          </View>
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  eyeButton: {
    padding: 5,
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 15,
    overflow: 'hidden',
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
  pictureNameSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pictureNameLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pictureNameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    paddingRight: 40, // Make room for clear button
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginBottom: 5,
  },
  clearButton: {
    position: 'absolute',
    right: 10,
    bottom: 12, // Align with input text
    padding: 2,
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
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
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  savingContent: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
    minWidth: 250,
  },
  spinningIcon: {
    marginBottom: 20,
  },
  savingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  savingStep: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    minHeight: 20,
  },
  progressContainer: {
    width: 200,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginBottom: 15,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 15,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
    marginHorizontal: 4,
  },
  objectsSection: {
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonText: {
    marginLeft: 5,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 5,
  },
  objectItem: {
    marginBottom: 10,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
  },
  objectContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  objectName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    textTransform: 'capitalize',
  },
  objectActions: {
    flexDirection: 'row',
  },
  editButton: {
    marginRight: 10,
    padding: 5,
  },
  deleteButton: {
    padding: 5,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    backgroundColor: 'white',
  },
  editActions: {
    flexDirection: 'row',
    marginLeft: 10,
  },
  editSaveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 15,
    padding: 8,
    marginRight: 5,
  },
  editCancelButton: {
    backgroundColor: '#f44336',
    borderRadius: 15,
    padding: 8,
  },
  actionButtons: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  saveButton: {
    backgroundColor: '#2196F3',
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#999',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 