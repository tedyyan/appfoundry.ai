import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image, Platform, Animated, Easing } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabase';
import { analyzeImageWithAI } from '../services/aiService';
import { uploadImageToUserFolder, generateSignedUrlForAI } from '../services/storageService';
import { checkDailyPictureLimit } from '../services/localStorage';
import { useAuth } from '../contexts/AuthContext';

export default function CameraScreen({ navigation }) {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [isLoading, setIsLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [processingStep, setProcessingStep] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const cameraRef = useRef(null);

  // Animation references
  const spinValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;
  const progressValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      // Camera permissions are handled by useCameraPermissions hook
      // Request media library permissions
      await MediaLibrary.requestPermissionsAsync();
    })();
  }, []);

  // Start animations when processing
  useEffect(() => {
    if (isLoading) {
      startProcessingAnimation();
    } else {
      stopProcessingAnimation();
    }
  }, [isLoading]);

  const startProcessingAnimation = () => {
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
          toValue: 1.3,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    spinAnimation.start();
    scaleAnimation.start();
  };

  const stopProcessingAnimation = () => {
    spinValue.stopAnimation();
    scaleValue.stopAnimation();
    progressValue.stopAnimation();
    
    // Reset to initial values
    spinValue.setValue(0);
    scaleValue.setValue(1);
    progressValue.setValue(0);
  };

  const updateProgress = (step, progress) => {
    setProcessingStep(step);
    setProcessingProgress(progress);
    
    Animated.timing(progressValue, {
      toValue: progress / 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        // Check if user is authenticated
        if (!user) {
          Alert.alert('Authentication Required', 'Please sign in to upload images.');
          navigation.navigate('Login');
          return;
        }
        
        // Check daily picture limit
        const limitCheck = await checkDailyPictureLimit(user.id);
        if (!limitCheck.canTakePicture) {
          Alert.alert(
            'Daily Limit Reached 📸',
            `You've reached your daily limit of ${limitCheck.limit} pictures (${limitCheck.todayCount}/${limitCheck.limit} used today).\n\nThis helps us provide the best service for everyone. The limit resets at midnight.\n\nThank you for understanding! 😊`,
            [{ text: 'Got it', style: 'default' }]
          );
          return;
        }
        
        setIsLoading(true);
        updateProgress('Capturing image...', 0);
        
        console.log('📸 Taking picture for user:', user.id, `(${limitCheck.todayCount + 1}/${limitCheck.limit} today)`);
        
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        
        setCapturedImage(photo.uri);
        updateProgress('Image captured! Uploading to cloud...', 15);
        
        // Upload to user-specific folder in Supabase Storage
        console.log('📁 Uploading image to user folder...');
        const imageUrl = await uploadImageToUserFolder(photo.uri, user.id);
        
        if (imageUrl) {
          console.log('✅ Image uploaded successfully:', imageUrl);
          updateProgress('Upload complete! Preparing for AI analysis...', 40);
          
          // Generate signed URL for AI analysis
          console.log('🔐 Generating secure URL for AI analysis...');
          const aiSignedUrl = await generateSignedUrlForAI(imageUrl);
          
          if (!aiSignedUrl) {
            Alert.alert('Error', 'Failed to generate secure URL for AI analysis.');
            return;
          }
          
          updateProgress('Analyzing image with AI...', 60);
          
          // Analyze with OpenAI Vision API using signed URL
          console.log('🤖 Analyzing image with OpenAI...');
          const detectedObjects = await analyzeImageWithAI(aiSignedUrl);
          
          updateProgress('AI analysis complete! Processing results...', 90);
          
          // Brief delay to show completion
          await new Promise(resolve => setTimeout(resolve, 500));
          updateProgress('Ready! Opening object confirmation...', 100);
          
          // Navigate to confirmation screen with results
          navigation.navigate('ObjectConfirmation', {
            imageUrl,
            detectedObjects,
            localImageUri: photo.uri,
            userId: user.id,
          });
        } else {
          Alert.alert('Upload Error', 'Failed to upload image. Please check your Supabase configuration.');
        }
      } catch (error) {
        console.error('❌ Error taking picture:', error);
        Alert.alert('Error', 'Failed to capture image. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };



  const uploadFromGallery = async () => {
    try {
      // Check if user is authenticated
      if (!user) {
        Alert.alert('Authentication Required', 'Please sign in to upload images.');
        navigation.navigate('Login');
        return;
      }

      // Check daily picture limit
      const limitCheck = await checkDailyPictureLimit(user.id);
      if (!limitCheck.canTakePicture) {
        Alert.alert(
          'Daily Limit Reached 📸',
          `You've reached your daily limit of ${limitCheck.limit} pictures (${limitCheck.todayCount}/${limitCheck.limit} used today).\n\nThis helps us provide the best service for everyone. The limit resets at midnight.\n\nThank you for understanding! 😊`,
          [{ text: 'Got it', style: 'default' }]
        );
        return;
      }

      setIsLoading(true);
      updateProgress('Opening gallery...', 0);

      console.log('📱 Opening image picker for user:', user.id, `(${limitCheck.todayCount + 1}/${limitCheck.limit} today)`);

      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos to upload images.');
        return;
      }

      updateProgress('Selecting image...', 10);

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled) {
        console.log('📱 User canceled image selection');
        return;
      }

      const selectedImage = result.assets[0];
      setCapturedImage(selectedImage.uri);
      updateProgress('Image selected! Uploading to cloud...', 15);

      // Upload to user-specific folder in Supabase Storage
      console.log('📁 Uploading selected image to user folder...');
      const imageUrl = await uploadImageToUserFolder(selectedImage.uri, user.id);

      if (imageUrl) {
        console.log('✅ Image uploaded successfully:', imageUrl);
        updateProgress('Upload complete! Preparing for AI analysis...', 40);

        // Generate signed URL for AI analysis
        console.log('🔐 Generating secure URL for AI analysis...');
        const aiSignedUrl = await generateSignedUrlForAI(imageUrl);

        if (!aiSignedUrl) {
          Alert.alert('Error', 'Failed to generate secure URL for AI analysis.');
          return;
        }

        updateProgress('Analyzing image with AI...', 60);

        // Analyze with OpenAI Vision API using signed URL
        console.log('🤖 Analyzing uploaded image with OpenAI...');
        const detectedObjects = await analyzeImageWithAI(aiSignedUrl);

        updateProgress('AI analysis complete! Processing results...', 90);

        // Brief delay to show completion
        await new Promise(resolve => setTimeout(resolve, 500));
        updateProgress('Ready! Opening object confirmation...', 100);

        // Navigate to confirmation screen with results
        navigation.navigate('ObjectConfirmation', {
          imageUrl,
          detectedObjects,
          localImageUri: selectedImage.uri,
          userId: user.id,
        });
      } else {
        Alert.alert('Upload Error', 'Failed to upload image. Please check your Supabase configuration.');
      }
    } catch (error) {
      console.error('❌ Error uploading from gallery:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const flipCamera = () => {
    setFacing(
      facing === 'back'
        ? 'front'
        : 'back'
    );
  };

  if (!permission) {
    // Camera permissions are still loading
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          Camera permission is required to use this feature
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.permissionButton, { marginTop: 10, backgroundColor: '#666' }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.permissionButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.flipButton}
            onPress={flipCamera}
          >
            <Ionicons name="camera-reverse" size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.captureContainer}>
          <TouchableOpacity
            style={[styles.uploadButton, isLoading && styles.captureButtonDisabled]}
            onPress={uploadFromGallery}
            disabled={isLoading}
          >
            <Ionicons name="images" size={24} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.captureButton, isLoading && styles.captureButtonDisabled]}
            onPress={takePicture}
            disabled={isLoading}
          >
            {isLoading ? (
              <Text style={styles.captureButtonText}>Processing...</Text>
            ) : (
              <Ionicons name="camera" size={32} color="white" />
            )}
          </TouchableOpacity>
          
          <View style={styles.placeholderButton} />
        </View>
        
        {/* Fancy AI Processing Animation Overlay */}
        {isLoading && (
          <View style={styles.processingOverlay}>
            <View style={styles.processingContent}>
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
                <Ionicons name="sparkles" size={50} color="#FFD700" />
              </Animated.View>
              
              {/* Progress text */}
              <Text style={styles.processingTitle}>AI Processing</Text>
              <Text style={styles.processingStep}>{processingStep}</Text>
              
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
              <Text style={styles.progressText}>{Math.round(processingProgress)}%</Text>
              
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
      </CameraView>
      
      {capturedImage && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  backButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    padding: 10,
  },
  flipButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    padding: 10,
  },
  captureContainer: {
    flex: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 50,
    paddingHorizontal: 40,
  },
  captureButton: {
    backgroundColor: '#2196F3',
    borderRadius: 40,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
  },
  uploadButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 30,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  placeholderButton: {
    width: 60,
    height: 60,
  },
  captureButtonDisabled: {
    backgroundColor: '#999',
  },
  captureButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  permissionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    alignSelf: 'center',
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewContainer: {
    position: 'absolute',
    top: 100,
    right: 20,
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  processingContent: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    padding: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    minWidth: 280,
  },
  spinningIcon: {
    marginBottom: 25,
  },
  processingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  processingStep: {
    fontSize: 16,
    color: '#666',
    marginBottom: 25,
    textAlign: 'center',
    minHeight: 20,
  },
  progressContainer: {
    width: 220,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD700',
    marginHorizontal: 5,
  },
}); 