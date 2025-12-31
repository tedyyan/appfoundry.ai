import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { 
  getPictureMetadata, 
  savePictureMetadata,
  getObjectsForImage 
} from '../services/localStorage';

const { width, height } = Dimensions.get('window');

export default function PictureDetailsScreen({ route, navigation }) {
  const { imageUrl, imageSource } = route.params;
  const { user } = useAuth();
  
  const [pictureName, setPictureName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [objects, setObjects] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    loadPictureData();
  }, [imageUrl]);

  useEffect(() => {
    // Set up navigation header with save button
    navigation.setOptions({
      headerTitle: 'Picture Details',
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Ionicons 
            name={isSaving ? "hourglass" : "save"} 
            size={24} 
            color={hasUnsavedChanges ? "#007AFF" : "#999"} 
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, hasUnsavedChanges, isSaving]);

  const loadPictureData = async () => {
    try {
      setIsLoading(true);
      
      // Load picture metadata
      const metadata = await getPictureMetadata(imageUrl, user?.id);
      if (metadata) {
        setPictureName(metadata.picture_name || '');
        setDescription(metadata.description || '');
      }

      // Load objects for this image
      const imageObjects = await getObjectsForImage(imageUrl, user?.id);
      setObjects(imageObjects);

    } catch (error) {
      console.error('Error loading picture data:', error);
      Alert.alert('Error', 'Failed to load picture details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!hasUnsavedChanges) return;

    try {
      setIsSaving(true);
      
      const success = await savePictureMetadata(
        imageUrl, 
        pictureName.trim(), 
        description.trim(), 
        user?.id
      );

      if (success) {
        setHasUnsavedChanges(false);
        Alert.alert('Success', 'Picture details saved successfully!');
      } else {
        Alert.alert('Error', 'Failed to save picture details. Please try again.');
      }
    } catch (error) {
      console.error('Error saving picture data:', error);
      Alert.alert('Error', 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNameChange = (text) => {
    setPictureName(text);
    setHasUnsavedChanges(true);
  };

  const handleDescriptionChange = (text) => {
    setDescription(text);
    setHasUnsavedChanges(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="hourglass" size={48} color="#999" />
          <Text style={styles.loadingText}>Loading picture details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Image Preview */}
          <View style={styles.imageContainer}>
            <Image source={imageSource} style={styles.image} resizeMode="contain" />
            {hasUnsavedChanges && (
              <View style={styles.unsavedBadge}>
                <Ionicons name="pencil" size={12} color="white" />
                <Text style={styles.unsavedText}>Unsaved</Text>
              </View>
            )}
          </View>

          {/* Picture Details Form */}
          <View style={styles.formContainer}>
            {/* Picture Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Picture Name</Text>
              <TextInput
                style={styles.input}
                value={pictureName}
                onChangeText={handleNameChange}
                placeholder="Enter a name for this picture..."
                placeholderTextColor="#999"
                maxLength={100}
              />
              <Text style={styles.charCount}>{pictureName.length}/100</Text>
            </View>

            {/* Description */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={handleDescriptionChange}
                placeholder="Describe this picture..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.charCount}>{description.length}/500</Text>
            </View>

            {/* Objects Found */}
            <View style={styles.objectsContainer}>
              <Text style={styles.sectionTitle}>
                Detected Objects ({objects.length})
              </Text>
              {objects.length === 0 ? (
                <Text style={styles.noObjectsText}>No objects detected in this picture</Text>
              ) : (
                <View style={styles.objectsList}>
                  {objects.map((object, index) => (
                    <View key={object.id || index} style={styles.objectItem}>
                      <Ionicons 
                        name={object.has_ai_coordinates ? "location" : "pricetag"} 
                        size={16} 
                        color={object.has_ai_coordinates ? "#4CAF50" : "#FF9800"} 
                      />
                      <Text style={styles.objectName}>{object.object_name}</Text>
                      {object.has_ai_coordinates && (
                        <Text style={styles.coordinateIndicator}>
                          📍 AI positioned
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[
              styles.saveButton, 
              !hasUnsavedChanges && styles.saveButtonDisabled
            ]}
            onPress={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
          >
            <Ionicons 
              name={isSaving ? "hourglass" : "save"} 
              size={20} 
              color="white" 
            />
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: 'black',
    height: height * 0.3,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  unsavedBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unsavedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  formContainer: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    color: '#333',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  objectsContainer: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  noObjectsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  objectsList: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
  },
  objectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  objectName: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  coordinateIndicator: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '500',
  },
  bottomContainer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  headerButton: {
    marginRight: 16,
  },
}); 