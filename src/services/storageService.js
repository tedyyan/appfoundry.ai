import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';
import { Alert } from 'react-native';

/**
 * Upload image to user-specific folder in Supabase storage
 * @param {string} imageUri - Local image URI
 * @param {string} userId - User ID for folder organization
 * @returns {Promise<string|null>} - Public URL of uploaded image or null if failed
 */
export const uploadImageToUserFolder = async (imageUri, userId) => {
  try {
    console.log('📁 Uploading image for user:', userId);
    
    if (!userId) {
      throw new Error('User ID is required for image upload');
    }

    // Verify file exists and has content
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    console.log('📄 File info:', fileInfo);
    
    if (!fileInfo.exists) {
      throw new Error('Image file does not exist');
    }
    
    if (fileInfo.size === 0) {
      throw new Error('Image file is empty (0 bytes)');
    }
    
    console.log('✅ Image file verified:', fileInfo.size, 'bytes');
    
    // Read the file as base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    if (!base64 || base64.length === 0) {
      throw new Error('Failed to read image data');
    }
    
    console.log('✅ Image data read:', base64.length, 'characters (base64)');
    
    // Convert base64 to binary data
    const binaryData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    console.log('✅ Binary data created:', binaryData.length, 'bytes');
    
    // Create user-specific file path
    const fileExt = imageUri.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const fileName = `user-${userId}/images/snapfind_${timestamp}.${fileExt}`;
    
    console.log('📁 Uploading to path:', fileName);
    
    // Upload to Supabase storage with user-specific path
    const { data, error } = await supabase.storage
      .from('images')
      .upload(fileName, binaryData, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('❌ Supabase storage error:', error);
      throw error;
    }

    console.log('✅ Upload successful, getting public URL...');
    
    // Generate signed URL for secure access (24 hours expiry)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('images')
      .createSignedUrl(data.path, 86400); // 24 hours

    if (signedUrlError) {
      console.error('❌ Error creating signed URL:', signedUrlError);
      throw signedUrlError;
    }

    const secureUrl = signedUrlData.signedUrl;
    console.log('🔐 Secure URL generated (24h expiry)');
    
    return secureUrl;
    
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    
    // Provide user-friendly error messages
    if (error.message.includes('not found')) {
      Alert.alert('Storage Error', 'Storage bucket "images" not found. Please create it in your Supabase dashboard.');
    } else if (error.message.includes('unauthorized')) {
      Alert.alert('Permission Error', 'Storage permission denied. Please check your Supabase storage policies.');
    } else if (error.message.includes('User ID is required')) {
      Alert.alert('Authentication Error', 'Please sign in to upload images.');
    } else {
      Alert.alert('Upload Error', `Failed to upload image: ${error.message}`);
    }
    
    return null;
  }
};

/**
 * Get all images for a specific user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of image objects with URLs
 */
export const getUserImages = async (userId) => {
  try {
    console.log('📁 Getting images for user:', userId);
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    const userFolderPath = `user-${userId}/images`;
    
    const { data, error } = await supabase.storage
      .from('images')
      .list(userFolderPath, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.error('❌ Error listing user images:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log('📁 No images found for user');
      return [];
    }

    // Get signed URLs for all images (24 hours expiry)
    const images = await Promise.all(data.map(async file => {
      const filePath = `${userFolderPath}/${file.name}`;
      
      try {
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('images')
          .createSignedUrl(filePath, 86400); // 24 hours
        
        return {
          name: file.name,
          path: filePath,
          url: signedUrlError ? null : signedUrlData.signedUrl,
          created_at: file.created_at,
          size: file.metadata?.size || 0,
        };
      } catch (error) {
        console.error('Error creating signed URL for', file.name, ':', error);
        return {
          name: file.name,
          path: filePath,
          url: null,
          created_at: file.created_at,
          size: file.metadata?.size || 0,
        };
      }
    }));

    console.log('📊 Found', images.length, 'images for user');
    return images;
    
  } catch (error) {
    console.error('❌ Error getting user images:', error);
    return [];
  }
};

/**
 * Delete an image from user's folder
 * @param {string} userId - User ID
 * @param {string} fileName - Name of the file to delete
 * @returns {Promise<boolean>} - Success status
 */
export const deleteUserImage = async (userId, fileName) => {
  try {
    console.log('🗑️ Deleting image for user:', userId, 'file:', fileName);
    
    if (!userId || !fileName) {
      throw new Error('User ID and file name are required');
    }

    const filePath = `user-${userId}/images/${fileName}`;
    
    const { error } = await supabase.storage
      .from('images')
      .remove([filePath]);

    if (error) {
      console.error('❌ Error deleting image:', error);
      throw error;
    }

    console.log('✅ Image deleted successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Error deleting image:', error);
    Alert.alert('Delete Error', `Failed to delete image: ${error.message}`);
    return false;
  }
};

/**
 * Generate a temporary signed URL for AI analysis
 * @param {string} imageUrl - The original signed URL (to extract path)
 * @returns {Promise<string|null>} - Signed URL for AI analysis (1 hour expiry)
 */
export const generateSignedUrlForAI = async (imageUrl) => {
  try {
    // Extract file path from the URL
    // Format: https://project.supabase.co/storage/v1/object/sign/images/user-123/images/file.jpg?token=...
    const urlParts = imageUrl.split('/storage/v1/object/sign/images/');
    if (urlParts.length < 2) {
      throw new Error('Invalid image URL format');
    }
    
    const pathWithToken = urlParts[1];
    const filePath = pathWithToken.split('?')[0]; // Remove token part
    
    console.log('🤖 Generating AI analysis URL for:', filePath);
    
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('images')
      .createSignedUrl(filePath, 3600); // 1 hour for AI analysis
    
    if (signedUrlError) {
      console.error('❌ Error creating AI signed URL:', signedUrlError);
      return null;
    }
    
    console.log('✅ AI analysis URL generated (1h expiry)');
    return signedUrlData.signedUrl;
    
  } catch (error) {
    console.error('❌ Error generating signed URL for AI:', error);
    return null;
  }
};

/**
 * Get storage stats for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Storage statistics
 */
export const getUserStorageStats = async (userId) => {
  try {
    console.log('📊 Getting database stats for user (active items only):', userId);
    
    // Get active pictures from database
    const { data: pictures, error: picturesError } = await supabase
      .from('pictures')
      .select('*')
      .eq('user_id', userId)
      .eq('deleted', false)
      .order('created_at', { ascending: false });

    if (picturesError) {
      console.error('❌ Error getting pictures:', picturesError);
      throw picturesError;
    }

    // Get active objects count
    const { data: objects, error: objectsError } = await supabase
      .from('objects')
      .select('id, picture_id')
      .eq('deleted', false);

    if (objectsError) {
      console.error('❌ Error getting objects:', objectsError);
      throw objectsError;
    }

    // Count objects that belong to this user's active pictures
    const userPictureIds = new Set(pictures.map(p => p.id));
    const userObjects = objects.filter(obj => userPictureIds.has(obj.picture_id));
    
    const totalImages = pictures.length;
    const totalObjects = userObjects.length;
    
    // Calculate actual file sizes from storage for active pictures
    let totalSize = 0;
    console.log('📊 Calculating storage usage for active pictures...');
    
    for (const picture of pictures) {
      try {
        // Extract file path from image URL
        const filePath = extractFilePathFromUrl(picture.image_url);
        if (filePath) {
          // Get file info from storage
          const { data: fileList, error: listError } = await supabase.storage
            .from('images')
            .list(filePath.substring(0, filePath.lastIndexOf('/')), {
              search: filePath.substring(filePath.lastIndexOf('/') + 1)
            });
          
          if (!listError && fileList && fileList.length > 0) {
            const fileInfo = fileList[0];
            if (fileInfo.metadata && fileInfo.metadata.size) {
              totalSize += fileInfo.metadata.size;
              console.log(`📂 ${filePath}: ${(fileInfo.metadata.size / 1024 / 1024).toFixed(2)} MB`);
            }
          }
        }
      } catch (sizeError) {
        console.warn('⚠️ Could not get size for:', picture.image_url);
      }
    }
    
    const stats = {
      totalImages,
      totalObjects,
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      oldestImage: pictures.length > 0 ? pictures[pictures.length - 1] : null,
      newestImage: pictures.length > 0 ? pictures[0] : null,
    };
    
    console.log('📊 Database stats (active only):', {
      pictures: totalImages,
      objects: totalObjects,
      totalSizeMB: stats.totalSizeMB + ' MB'
    });
    return stats;
    
  } catch (error) {
    console.error('❌ Error getting database stats:', error);
    return {
      totalImages: 0,
      totalObjects: 0,
      totalSize: 0,
      totalSizeMB: '0.00',
      oldestImage: null,
      newestImage: null,
    };
  }
};

/**
 * Delete picture and mark associated objects as deleted
 * @param {string} userId - User ID
 * @param {string} imageUrl - Image URL to delete
 * @param {string} fileName - File name in storage
 * @returns {Promise<Object>} - Deletion result
 */
export const deletePictureAndObjects = async (userId, imageUrl, fileName) => {
  try {
    console.log('🗑️ Deleting picture and objects:', { userId, imageUrl, fileName });
    
    if (!userId || !imageUrl) {
      throw new Error('User ID and image URL are required');
    }

    // Step 1: Soft delete associated objects in database
    console.log('📊 Marking objects as deleted in database...');
    const { data: softDeleteResult, error: dbError } = await supabase
      .rpc('soft_delete_objects_by_image', {
        p_user_id: userId,
        p_image_url: imageUrl
      });

    if (dbError) {
      console.error('❌ Database soft delete error:', dbError);
      throw new Error(`Failed to mark objects as deleted: ${dbError.message}`);
    }

    console.log('✅ Marked', softDeleteResult, 'objects as deleted');

    // Step 2: Keep image in storage but mark as deleted in database
    // Note: We no longer delete the physical file, just mark as deleted in DB
    let storageDeleted = false;
    console.log('📝 Physical file kept in storage, marked as deleted in database only');

    const result = {
      success: true,
      objectsDeleted: softDeleteResult || 0,
      storageDeleted,
      message: `Successfully deleted picture and marked ${softDeleteResult || 0} objects as deleted`
    };

    console.log('✅ Deletion completed:', result);
    return result;

  } catch (error) {
    console.error('❌ Error deleting picture and objects:', error);
    return {
      success: false,
      error: error.message,
      objectsDeleted: 0,
      storageDeleted: false
    };
  }
};

/**
 * Get pictures with their associated object counts (active only)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of pictures with object counts
 */
export const getUserPicturesWithObjectCounts = async (userId) => {
  try {
    console.log('📊 Getting pictures with object counts for user:', userId);
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get active pictures from database (not storage)
    console.log('📊 Getting pictures from database...');
    const { data: pictures, error: picturesError } = await supabase
      .from('pictures')
      .select('*')
      .eq('user_id', userId)
      .eq('deleted', false)
      .order('created_at', { ascending: false });

    if (picturesError) {
      console.error('❌ Error getting pictures from database:', picturesError);
      throw picturesError;
    }

    if (!pictures || pictures.length === 0) {
      console.log('📊 No active pictures found in database');
      return [];
    }

    console.log('📊 DEBUG: Found', pictures.length, 'active pictures in database');

    // Get object counts for each picture using the normalized structure
    console.log('📊 Getting object counts for pictures...');
    
    const { data: objectCounts, error: objectsError } = await supabase
      .from('objects')
      .select('picture_id')
      .eq('deleted', false);

    if (objectsError) {
      console.error('❌ Error getting object counts:', objectsError);
      throw objectsError;
    }

    // Count objects by picture_id
    const countsByPictureId = {};
    objectCounts.forEach(obj => {
      const pictureId = obj.picture_id;
      if (pictureId) {
        countsByPictureId[pictureId] = (countsByPictureId[pictureId] || 0) + 1;
      }
    });

    // Transform pictures to match the expected format
    const picturesWithCounts = pictures.map(picture => {
      const objectCount = countsByPictureId[picture.id] || 0;
      
      // Convert database picture to storage-like format for compatibility
      const fileName = extractFileNameFromUrl(picture.image_url);
      
      return {
        id: picture.id,
        name: fileName || 'image.jpg',
        url: picture.image_url,
        publicUrl: picture.image_url,
        objectCount,
        hasObjects: objectCount > 0,
        pictureName: picture.picture_name,
        description: picture.description,
        created_at: picture.created_at,
        updated_at: picture.updated_at
      };
    });

    console.log('📊 DEBUG: Final results (database-driven):');
    picturesWithCounts.forEach((pic, i) => {
      console.log(`  ${i + 1}. ${pic.pictureName || pic.name}: ${pic.objectCount} objects (hasObjects: ${pic.hasObjects})`);
    });

    return picturesWithCounts;

  } catch (error) {
    console.error('❌ Error getting pictures with object counts:', error);
    return [];
  }
};

/**
 * Restore deleted objects for a specific image
 * @param {string} userId - User ID
 * @param {string} imageUrl - Image URL to restore objects for
 * @returns {Promise<Object>} - Restoration result
 */
export const restorePictureObjects = async (userId, imageUrl) => {
  try {
    console.log('🔄 Restoring objects for image:', { userId, imageUrl });
    
    if (!userId || !imageUrl) {
      throw new Error('User ID and image URL are required');
    }

    const { data: restoreResult, error: dbError } = await supabase
      .rpc('restore_objects_by_image', {
        p_user_id: userId,
        p_image_url: imageUrl
      });

    if (dbError) {
      console.error('❌ Database restore error:', dbError);
      throw new Error(`Failed to restore objects: ${dbError.message}`);
    }

    console.log('✅ Restored', restoreResult, 'objects');
    
    return {
      success: true,
      objectsRestored: restoreResult || 0,
      message: `Successfully restored ${restoreResult || 0} objects`
    };

  } catch (error) {
    console.error('❌ Error restoring objects:', error);
    return {
      success: false,
      error: error.message,
      objectsRestored: 0
    };
  }
};

// Helper function to extract file name from URL
const extractFileNameFromUrl = (url) => {
  try {
    if (!url) return null;
    const urlParts = url.split('/');
    return urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
  } catch (error) {
    console.error('Error extracting filename from URL:', error);
    return null;
  }
};

// Helper function to extract file path from signed URL or direct path
export const extractFilePathFromUrl = (url) => {
  try {
    if (!url) return null;
    
    // If it's already a direct path (no protocol), return as-is
    if (!url.startsWith('http')) {
      return url;
    }
    
    // Extract the file path from signed URL
    // Format: https://project.supabase.co/storage/v1/object/sign/images/user-123/file.jpg?token=...
    const pathMatch = url.match(/\/storage\/v1\/object\/sign\/images\/([^?]+)/);
    return pathMatch ? pathMatch[1] : null;
  } catch (error) {
    console.error('Error extracting file path from URL:', url, error);
    return null;
  }
};

/**
 * Generate a signed URL for display purposes from a file path
 * @param {string} filePath - File path (e.g., "user-123/images/filename.jpg")
 * @returns {Promise<string>} - Signed URL for display
 */
export const generateSignedUrlForDisplay = async (filePath) => {
  try {
    if (!filePath) {
      console.warn('⚠️ No filePath provided for display URL generation');
      return null;
    }
    
    // If it's already a full URL, return as-is
    if (filePath.startsWith('http')) {
      console.log('🔗 URL already formatted:', filePath.substring(0, 100) + '...');
      return filePath;
    }
    
    console.log('🖼️ Generating display URL for:', filePath);
    
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('images')
      .createSignedUrl(filePath, 86400); // 24 hours for display
    
    if (signedUrlError) {
      console.error('❌ Error creating display signed URL for:', filePath);
      console.error('❌ Supabase error details:', signedUrlError);
      
      // Check if it's a file not found error
      if (signedUrlError.message && signedUrlError.message.includes('not found')) {
        console.warn('⚠️ File not found in storage:', filePath);
      }
      
      return null;
    }
    
    if (!signedUrlData || !signedUrlData.signedUrl) {
      console.error('❌ No signed URL returned for:', filePath);
      return null;
    }
    
    console.log('✅ Display URL generated for:', filePath.substring(filePath.lastIndexOf('/') + 1));
    return signedUrlData.signedUrl;
    
  } catch (error) {
    console.error('❌ Error generating signed URL for display:', filePath, error);
    return null;
  }
};

/**
 * Create a standardized storage reference for an image
 * This should be used when saving objects to ensure consistent matching
 * @param {string} imageUrl - The signed URL or file path
 * @returns {string} - Standardized file path for storage
 */
export const createStorageReference = (imageUrl) => {
  // If it's already a file path (no protocol), return as-is
  if (!imageUrl.startsWith('http')) {
    return imageUrl;
  }
  
  // Extract file path from signed URL
  return extractFilePathFromUrl(imageUrl) || imageUrl;
}; 