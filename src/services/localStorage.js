import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { safeUserId, debugUserId, getCurrentUserId } from '../utils/userIdUtils';
import { createStorageReference } from './storageService';

const STORAGE_KEY = 'snapfind_objects';
const SYNC_KEY = 'snapfind_last_sync';

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

// Create a mutex to prevent concurrent writes
let isWriting = false;
const writeMutex = async () => {
  while (isWriting) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  isWriting = true;
};

const releaseMutex = () => {
  isWriting = false;
};

export const saveObject = async (objectData, user_id = null, imageUrl = null) => {
  try {
    await writeMutex();
    
    // Get current user if not provided
    if (!user_id) {
      user_id = await getCurrentUserId(supabase);
    } else {
      // Use safe user ID conversion
      user_id = safeUserId(user_id);
    }
    
    // Debug user ID for troubleshooting
    debugUserId(user_id, 'saveObject');
    
    if (!user_id) {
      console.error('❌ No valid user ID available for saving object');
      return;
    }

    console.log('💾 Saving object to localStorage for user:', user_id);
    
    const existingObjects = await getAllObjects();
    
    // Create object with unique ID, standardizing the image reference
    const standardizedImageUrl = createStorageReference(objectData.image_url || imageUrl);
    const objectToSave = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...objectData,
      image_url: standardizedImageUrl, // Use standardized reference
      user_id, // Keep for local storage compatibility
      created_at: new Date().toISOString(),
    };
    
    // Check for duplicates (same image_url and object_name)
    const isDuplicate = existingObjects.some(obj => 
      obj.image_url === standardizedImageUrl && 
      obj.object_name === objectToSave.object_name &&
      obj.user_id === user_id
    );
    
    if (isDuplicate) {
      console.log('⚠️ Duplicate object detected, skipping:', objectToSave.object_name);
      return;
    }
    
    const updatedObjects = [...existingObjects, objectToSave];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedObjects));
    
    console.log('✅ Object saved to localStorage:', objectToSave.object_name);
    
    // Also save to Supabase database with new picture_id relationship
    try {
      console.log('💾 Inserting to Supabase with picture relationship...');
      
      // First, ensure the picture exists and get its ID
      let picture_id = null;
      
      // Check if picture already exists
      const { data: existingPictures, error: selectError } = await supabase
        .from('pictures')
        .select('id')
        .eq('user_id', String(user_id))
        .eq('image_url', standardizedImageUrl)
        .limit(1);
      
      if (selectError) {
        console.error('❌ Error checking for existing picture:', selectError);
        throw selectError;
      }
      
      if (existingPictures && existingPictures.length > 0) {
        picture_id = existingPictures[0].id;
        console.log('📋 Found existing picture:', picture_id);
      } else {
        // Create new picture record
        const defaultName = generateFunnyPictureName();
        const defaultDescription = `Contains detected objects`;
        
        const { data: newPicture, error: insertError } = await supabase
          .from('pictures')
          .insert([{
            user_id: String(user_id),
            image_url: standardizedImageUrl,
            picture_name: defaultName,
            description: defaultDescription
          }])
          .select('id')
          .single();
        
        if (insertError) {
          console.error('❌ Error creating picture record:', insertError);
          throw insertError;
        }
        
        picture_id = newPicture.id;
        console.log('📝 Created new picture:', picture_id);
      }
      
      // Now save the object with picture_id reference
      const { error } = await supabase
        .from('objects')
        .insert([{
          object_name: objectToSave.object_name,
          picture_id: picture_id, // Use picture_id instead of user_id and image_url
          deleted: false, // Ensure new objects are not marked as deleted
          x_position: objectToSave.x_position || null,
          y_position: objectToSave.y_position || null,
          has_ai_coordinates: objectToSave.has_ai_coordinates || false,
        }]);
      
      if (error) {
        console.error('❌ Error saving object to Supabase:', error);
        debugUserId(user_id, 'Supabase object insert error');
      } else {
        console.log('☁️ Object saved to Supabase with picture relationship');
      }
    } catch (supabaseError) {
      console.error('❌ Supabase save error:', supabaseError);
      debugUserId(user_id, 'Supabase save exception');
    }
    
  } catch (error) {
    console.error('❌ Error saving object:', error);
  } finally {
    releaseMutex();
  }
};

export const getAllObjects = async (user_id = null) => {
  try {
    // Get current user if not provided
    if (!user_id) {
      user_id = await getCurrentUserId(supabase);
    } else {
      user_id = safeUserId(user_id);
    }
    
    const storedObjects = await AsyncStorage.getItem(STORAGE_KEY);
    const allObjects = storedObjects ? JSON.parse(storedObjects) : [];
    
    // Filter objects by user_id if user is authenticated
    if (user_id) {
      const userObjects = allObjects.filter(obj => obj.user_id === user_id);
      console.log(`📊 Retrieved ${userObjects.length} objects for user ${user_id}`);
      return userObjects;
    }
    
    // If no user, return empty array (user should be authenticated)
    console.log('⚠️ No user authenticated, returning empty array');
    return [];
  } catch (error) {
    console.error('❌ Error getting objects:', error);
    return [];
  }
};

export const searchObjects = async (query, user_id = null) => {
  try {
    // Get current user if not provided
    if (!user_id) {
      const { data: { user } } = await supabase.auth.getUser();
      user_id = user?.id;
    }
    
    const objects = await getAllObjects(user_id);
    const lowerQuery = query.toLowerCase();
    
    const filteredObjects = objects.filter(obj => 
      obj.object_name && obj.object_name.toLowerCase().includes(lowerQuery)
    );
    
    console.log(`🔍 Search for "${query}" returned ${filteredObjects.length} results for user ${user_id}`);
    return filteredObjects;
  } catch (error) {
    console.error('❌ Error searching objects:', error);
    return [];
  }
};

// Search objects with picture names from database
export const searchObjectsWithPictureNames = async (query, user_id = null) => {
  try {
    // Get current user if not provided
    if (!user_id) {
      user_id = await getCurrentUserId(supabase);
    } else {
      user_id = safeUserId(user_id);
    }
    
    if (!user_id) {
      console.log('⚠️ No user authenticated for search');
      return [];
    }
    
    const lowerQuery = query.toLowerCase();
    
    // Search in Supabase using the normalized view to get picture names
    const { data: results, error } = await supabase
      .from('objects_with_pictures')
      .select(`
        object_id,
        object_name,
        picture_id,
        x_position,
        y_position,
        has_ai_coordinates,
        deleted,
        object_created_at,
        user_id,
        image_url,
        picture_name,
        description
      `)
      .eq('user_id', String(user_id))
      .eq('deleted', false)
      .ilike('object_name', `%${query}%`)
      .order('object_created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error searching objects in database:', error);
      // Fallback to local search
      return await searchObjects(query, user_id);
    }
    
    if (!results || results.length === 0) {
      console.log(`🔍 No objects found for "${query}" in database for user ${user_id}`);
      return [];
    }
    
    // Transform results to match expected format
    const transformedResults = results.map(obj => ({
      id: obj.object_id,
      object_name: obj.object_name,
      picture_id: obj.picture_id,
      x_position: obj.x_position,
      y_position: obj.y_position,
      has_ai_coordinates: obj.has_ai_coordinates,
      deleted: obj.deleted,
      created_at: obj.object_created_at,
      user_id: obj.user_id,
      image_url: obj.image_url,
      picture_name: obj.picture_name || `Picture ${new Date(obj.object_created_at).toLocaleDateString()}`,
      description: obj.description
    }));
    
    console.log(`🔍 Search for "${query}" returned ${transformedResults.length} results with picture names for user ${user_id}`);
    return transformedResults;
  } catch (error) {
    console.error('❌ Error searching objects with picture names:', error);
    // Fallback to local search
    return await searchObjects(query, user_id);
  }
};

// Get all objects with picture names from database
export const getAllObjectsWithPictureNames = async (user_id = null) => {
  try {
    // Get current user if not provided
    if (!user_id) {
      user_id = await getCurrentUserId(supabase);
    } else {
      user_id = safeUserId(user_id);
    }
    
    if (!user_id) {
      console.log('⚠️ No user authenticated');
      return [];
    }
    
    // Get all objects from Supabase using the normalized view to get picture names
    const { data: results, error } = await supabase
      .from('objects_with_pictures')
      .select(`
        object_id,
        object_name,
        picture_id,
        x_position,
        y_position,
        has_ai_coordinates,
        deleted,
        object_created_at,
        user_id,
        image_url,
        picture_name,
        description
      `)
      .eq('user_id', String(user_id))
      .eq('deleted', false)
      .order('object_created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error getting objects from database:', error);
      // Fallback to local storage
      return await getAllObjects(user_id);
    }
    
    if (!results || results.length === 0) {
      console.log(`📭 No objects found in database for user ${user_id}`);
      return [];
    }
    
    // Transform results to match expected format
    const transformedResults = results.map(obj => ({
      id: obj.object_id,
      object_name: obj.object_name,
      picture_id: obj.picture_id,
      x_position: obj.x_position,
      y_position: obj.y_position,
      has_ai_coordinates: obj.has_ai_coordinates,
      deleted: obj.deleted,
      created_at: obj.object_created_at,
      user_id: obj.user_id,
      image_url: obj.image_url,
      picture_name: obj.picture_name || `Picture ${new Date(obj.object_created_at).toLocaleDateString()}`,
      description: obj.description
    }));
    
    console.log(`📄 Found ${transformedResults.length} objects with picture names for user ${user_id}`);
    return transformedResults;
  } catch (error) {
    console.error('❌ Error getting objects with picture names:', error);
    // Fallback to local storage
    return await getAllObjects(user_id);
  }
};

export const clearAllObjects = async (user_id = null) => {
  try {
    await writeMutex();
    
    // Get current user if not provided
    if (!user_id) {
      const { data: { user } } = await supabase.auth.getUser();
      user_id = user?.id;
    }
    
    if (!user_id) {
      console.log('⚠️ No user authenticated, clearing all local data');
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    
    // Get all objects and filter out only the current user's objects
    const storedObjects = await AsyncStorage.getItem(STORAGE_KEY);
    const allObjects = storedObjects ? JSON.parse(storedObjects) : [];
    
    // Keep objects from other users
    const otherUsersObjects = allObjects.filter(obj => obj.user_id !== user_id);
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(otherUsersObjects));
    console.log(`🗑️ Cleared objects for user ${user_id}`);
  } catch (error) {
    console.error('❌ Error clearing objects:', error);
  } finally {
    releaseMutex();
  }
};

export const getStorageStats = async (user_id = null) => {
  try {
    // Get current user if not provided
    if (!user_id) {
      user_id = await getCurrentUserId(supabase);
    } else {
      user_id = safeUserId(user_id);
    }
    
    const objects = await getAllObjects(user_id);
    
    // Calculate unique images
    const uniqueImages = new Set();
    objects.forEach(obj => {
      if (obj.image_url) {
        uniqueImages.add(obj.image_url);
      }
    });
    
    // Group objects by name
    const objectCounts = {};
    objects.forEach(obj => {
      if (obj.object_name) {
        objectCounts[obj.object_name] = (objectCounts[obj.object_name] || 0) + 1;
      }
    });
    
    const stats = {
      totalObjects: objects.length,
      uniqueImages: uniqueImages.size,
      objectTypes: Object.keys(objectCounts).length,
      mostCommonObject: Object.keys(objectCounts).length > 0 
        ? Object.keys(objectCounts).reduce((a, b) => objectCounts[a] > objectCounts[b] ? a : b)
        : null,
      oldestObject: objects.length > 0 
        ? objects.reduce((oldest, obj) => 
            new Date(obj.created_at) < new Date(oldest.created_at) ? obj : oldest
          )
        : null,
      newestObject: objects.length > 0 
        ? objects.reduce((newest, obj) => 
            new Date(obj.created_at) > new Date(newest.created_at) ? obj : newest
          )
        : null,
    };
    
    console.log('📊 Storage stats for user', user_id, ':', stats);
    return stats;
  } catch (error) {
    console.error('❌ Error getting storage stats:', error);
    return {
      totalObjects: 0,
      uniqueImages: 0,
      objectTypes: 0,
      mostCommonObject: null,
      oldestObject: null,
      newestObject: null,
    };
  }
};

// Clear local storage and sync from Supabase (Supabase is authoritative)
export const clearAndSyncFromSupabase = async (user_id = null) => {
  try {
    await writeMutex();
    
    // Get current user if not provided
    if (!user_id) {
      user_id = await getCurrentUserId(supabase);
    } else {
      user_id = safeUserId(user_id);
    }
    
    if (!user_id) {
      console.log('⚠️ No user authenticated for sync');
      return [];
    }
    
    console.log('🗑️ Clearing local storage and syncing from Supabase for user:', user_id);
    
    // Step 1: Clear local storage completely
    await AsyncStorage.removeItem(STORAGE_KEY);
    console.log('✅ Local storage cleared');
    
    // Step 2: Fetch all objects from Supabase for this user using normalized view
    const { data: supabaseObjects, error } = await supabase
      .from('objects_with_pictures')
      .select(`
        object_id,
        object_name,
        picture_id,
        x_position,
        y_position,
        has_ai_coordinates,
        deleted,
        object_created_at,
        user_id,
        image_url,
        picture_name,
        description
      `)
      .eq('user_id', String(user_id))
      .eq('deleted', false) // Only get non-deleted objects
      .order('object_created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching from Supabase:', error);
      throw error;
    }
    
    if (!supabaseObjects || supabaseObjects.length === 0) {
      console.log('📭 No objects found in Supabase for user');
      return [];
    }
    
    // Step 3: Transform and store Supabase data in local storage
    const transformedObjects = supabaseObjects.map(obj => ({
      id: obj.object_id,
      object_name: obj.object_name,
      picture_id: obj.picture_id,
      x_position: obj.x_position,
      y_position: obj.y_position,
      has_ai_coordinates: obj.has_ai_coordinates,
      deleted: obj.deleted,
      created_at: obj.object_created_at,
      user_id: obj.user_id,
      image_url: obj.image_url
    }));
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(transformedObjects));
    
    console.log(`✅ Synced ${transformedObjects.length} objects from Supabase to local storage`);
    
    // Update last sync time
    await AsyncStorage.setItem('last_sync_time', new Date().toISOString());
    
    return transformedObjects;
    
  } catch (error) {
    console.error('❌ Error in clearAndSyncFromSupabase:', error);
    return [];
  } finally {
    releaseMutex();
  }
};

// Sync from Supabase to localStorage (merge mode)
export const syncFromSupabase = async (user_id = null) => {
  try {
    await writeMutex();
    
    // Get current user if not provided
    if (!user_id) {
      user_id = await getCurrentUserId(supabase);
    } else {
      user_id = safeUserId(user_id);
    }
    
    if (!user_id) {
      console.log('⚠️ No user authenticated for sync');
      return [];
    }
    
    console.log('🔄 Syncing data from Supabase for user:', user_id);
    
    // Fetch user's objects from Supabase using normalized view (only active objects)
    const { data: supabaseObjects, error } = await supabase
      .from('objects_with_pictures')
      .select(`
        object_id,
        object_name,
        picture_id,
        x_position,
        y_position,
        has_ai_coordinates,
        deleted,
        object_created_at,
        user_id,
        image_url,
        picture_name,
        description
      `)
      .eq('user_id', String(user_id))
      .eq('deleted', false) // Only fetch non-deleted objects
      .order('object_created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching from Supabase:', error);
      return [];
    }
    
    if (!supabaseObjects || supabaseObjects.length === 0) {
      console.log('📝 No objects found in Supabase for user');
      // Clear user's objects from localStorage
      await clearAllObjects(user_id);
      return [];
    }
    
    // Get existing localStorage data
    const storedObjects = await AsyncStorage.getItem(STORAGE_KEY);
    const allLocalObjects = storedObjects ? JSON.parse(storedObjects) : [];
    
    // Remove current user's objects from localStorage
    const otherUsersObjects = allLocalObjects.filter(obj => obj.user_id !== user_id);
    
    // Transform and add user's objects from Supabase
    const transformedObjects = supabaseObjects.map(obj => ({
      id: obj.object_id,
      object_name: obj.object_name,
      picture_id: obj.picture_id,
      x_position: obj.x_position,
      y_position: obj.y_position,
      has_ai_coordinates: obj.has_ai_coordinates,
      deleted: obj.deleted,
      created_at: obj.object_created_at,
      user_id: obj.user_id,
      image_url: obj.image_url
    }));
    
    const syncedObjects = [...otherUsersObjects, ...transformedObjects];
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(syncedObjects));
    await AsyncStorage.setItem(SYNC_KEY, new Date().toISOString());
    
    console.log(`✅ Synced ${transformedObjects.length} objects from Supabase for user ${user_id}`);
    return transformedObjects;
    
  } catch (error) {
    console.error('❌ Error syncing from Supabase:', error);
    return [];
  } finally {
    releaseMutex();
  }
};

// Get last sync time
export const getLastSyncTime = async () => {
  try {
    const lastSync = await AsyncStorage.getItem(SYNC_KEY);
    return lastSync ? new Date(lastSync) : null;
  } catch (error) {
    console.error('❌ Error getting last sync time:', error);
    return null;
  }
};

export const debugStorage = async () => {
  try {
    console.log('🔍 DEBUG: Comprehensive storage check...');
    console.log('📂 Storage key:', STORAGE_KEY);
    
    const existingData = await AsyncStorage.getItem(STORAGE_KEY);
    console.log('📱 Raw data from AsyncStorage:');
    console.log(existingData);
    
    if (existingData) {
      try {
        const objects = JSON.parse(existingData);
        console.log('📊 DEBUG: Successfully parsed', objects.length, 'objects');
        
        if (objects.length > 0) {
          console.log('📄 All objects in storage:');
          objects.forEach((obj, index) => {
            console.log(`  ${index + 1}. "${obj.object_name}" (ID: ${obj.id})`);
            console.log(`     Image: ${obj.image_url.substring(0, 50)}...`);
            console.log(`     Created: ${obj.created_at}`);
          });
          
          // Check for duplicates
          const uniqueNames = [...new Set(objects.map(obj => obj.object_name))];
          if (uniqueNames.length !== objects.length) {
            console.warn('⚠️ Found duplicate object names');
            console.log('Unique names:', uniqueNames.length, 'vs Total objects:', objects.length);
          }
          
          // Check for unique IDs
          const uniqueIds = [...new Set(objects.map(obj => obj.id))];
          if (uniqueIds.length !== objects.length) {
            console.warn('⚠️ Found duplicate IDs');
            console.log('Unique IDs:', uniqueIds.length, 'vs Total objects:', objects.length);
          }
        }
        
        return objects;
      } catch (parseError) {
        console.error('❌ DEBUG: JSON parse error:', parseError);
        console.log('📄 Raw data that failed to parse:', existingData.substring(0, 200) + '...');
        return [];
      }
    } else {
      console.log('📝 DEBUG: No objects found in localStorage (null/undefined)');
      return [];
    }
  } catch (error) {
    console.error('❌ DEBUG: Error checking storage:', error);
    return [];
  }
};

/**
 * Get all objects for a specific image
 * @param {string} imageUrl - Image URL or standardized reference
 * @param {string} user_id - User ID
 * @returns {Promise<Array>} - Array of objects for the image
 */
export const getObjectsForImage = async (imageUrl, user_id = null) => {
  try {
    // Get current user if not provided
    if (!user_id) {
      user_id = await getCurrentUserId(supabase);
    } else {
      user_id = safeUserId(user_id);
    }

    if (!user_id) {
      console.error('❌ No valid user ID available for getting objects');
      return [];
    }

    // Standardize the image URL for consistent matching
    const standardizedImageUrl = createStorageReference(imageUrl);
    console.log('🔍 Getting objects for image:', standardizedImageUrl, 'user:', user_id);

    // Try to get from Supabase first using the new objects_with_pictures view
    try {
      const { data: supabaseObjects, error } = await supabase
        .from('objects_with_pictures')
        .select(`
          object_id,
          object_name,
          x_position,
          y_position,
          has_ai_coordinates,
          deleted,
          object_created_at,
          picture_id,
          image_url,
          picture_name,
          description
        `)
        .eq('user_id', String(user_id))
        .eq('image_url', standardizedImageUrl)
        .eq('deleted', false)
        .order('object_created_at', { ascending: true });

      if (error) {
        console.error('❌ Error getting objects from Supabase:', error);
      } else if (supabaseObjects && supabaseObjects.length > 0) {
        console.log('☁️ Found', supabaseObjects.length, 'objects in Supabase for image');
        
        // Transform the data to match expected format
        const transformedObjects = supabaseObjects.map(obj => ({
          id: obj.object_id,
          object_name: obj.object_name,
          x_position: obj.x_position,
          y_position: obj.y_position,
          has_ai_coordinates: obj.has_ai_coordinates,
          created_at: obj.object_created_at,
          picture_id: obj.picture_id,
          image_url: obj.image_url,
          deleted: obj.deleted
        }));
        
        return transformedObjects;
      }
    } catch (supabaseError) {
      console.error('❌ Supabase query error:', supabaseError);
    }

    // Fallback to local storage
    console.log('📱 Checking local storage for objects...');
    const allObjects = await getAllObjects(user_id);
    const imageObjects = allObjects.filter(obj => 
      createStorageReference(obj.image_url) === standardizedImageUrl &&
      obj.user_id === user_id &&
      !obj.deleted
    );

    console.log('📱 Found', imageObjects.length, 'objects in local storage for image');
    return imageObjects;

  } catch (error) {
    console.error('❌ Error getting objects for image:', error);
    return [];
  }
};

// ====== PICTURE METADATA FUNCTIONS ======

/**
 * Save picture metadata (name and description)
 * @param {string} imageUrl - Image URL or standardized reference
 * @param {string} pictureName - Picture name
 * @param {string} description - Picture description
 * @param {string} user_id - User ID
 * @returns {Promise<boolean>} - Success status
 */
export const savePictureMetadata = async (imageUrl, pictureName = '', description = '', user_id = null) => {
  try {
    // Get current user if not provided
    if (!user_id) {
      user_id = await getCurrentUserId(supabase);
    } else {
      user_id = safeUserId(user_id);
    }

    if (!user_id) {
      console.error('❌ No valid user ID available for saving picture metadata');
      return false;
    }

    // Standardize the image URL for consistent storage
    const standardizedImageUrl = createStorageReference(imageUrl);
    console.log('💾 Saving picture metadata for:', standardizedImageUrl);

    // Save to Supabase database
    try {
      // Check if picture already exists
      const { data: existingPictures, error: selectError } = await supabase
        .from('pictures')
        .select('*')
        .eq('user_id', String(user_id))
        .eq('image_url', standardizedImageUrl)
        .limit(1);

      if (selectError) {
        console.error('❌ Error checking existing picture:', selectError);
        return false;
      }

      if (existingPictures && existingPictures.length > 0) {
        // Update existing picture
        const { error: updateError } = await supabase
          .from('pictures')
          .update({
            picture_name: pictureName,
            description: description,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPictures[0].id);

        if (updateError) {
          console.error('❌ Error updating picture metadata:', updateError);
          return false;
        }
        console.log('✅ Picture metadata updated successfully');
      } else {
        // Insert new picture
        const { error: insertError } = await supabase
          .from('pictures')
          .insert([{
            user_id: String(user_id),
            image_url: standardizedImageUrl,
            picture_name: pictureName,
            description: description
          }]);

        if (insertError) {
          console.error('❌ Error inserting picture metadata:', insertError);
          return false;
        }
        console.log('✅ Picture metadata saved successfully');
      }

      return true;
    } catch (supabaseError) {
      console.error('❌ Supabase picture metadata error:', supabaseError);
      return false;
    }

  } catch (error) {
    console.error('❌ Error saving picture metadata:', error);
    return false;
  }
};

/**
 * Get picture metadata by image URL
 * @param {string} imageUrl - Image URL or standardized reference
 * @param {string} user_id - User ID
 * @returns {Promise<Object|null>} - Picture metadata object or null
 */
export const getPictureMetadata = async (imageUrl, user_id = null) => {
  try {
    // Get current user if not provided
    if (!user_id) {
      user_id = await getCurrentUserId(supabase);
    } else {
      user_id = safeUserId(user_id);
    }

    if (!user_id) {
      console.error('❌ No valid user ID available for getting picture metadata');
      return null;
    }

    // Standardize the image URL for consistent matching
    const standardizedImageUrl = createStorageReference(imageUrl);
    console.log('🔍 Getting picture metadata for:', standardizedImageUrl);

    // Get from Supabase database
    try {
      const { data: pictures, error } = await supabase
        .from('pictures')
        .select('*')
        .eq('user_id', String(user_id))
        .eq('image_url', standardizedImageUrl)
        .limit(1);

      if (error) {
        console.error('❌ Error getting picture metadata:', error);
        return null;
      }

      if (pictures && pictures.length > 0) {
        console.log('✅ Found picture metadata');
        return pictures[0];
      }

      console.log('📝 No picture metadata found');
      return null;

    } catch (supabaseError) {
      console.error('❌ Supabase picture metadata query error:', supabaseError);
      return null;
    }

  } catch (error) {
    console.error('❌ Error getting picture metadata:', error);
    return null;
  }
};

/**
 * Get all pictures with metadata for a user
 * @param {string} user_id - User ID
 * @returns {Promise<Array>} - Array of picture metadata objects
 */
export const getAllPicturesMetadata = async (user_id = null) => {
  try {
    // Get current user if not provided
    if (!user_id) {
      user_id = await getCurrentUserId(supabase);
    } else {
      user_id = safeUserId(user_id);
    }

    if (!user_id) {
      console.error('❌ No valid user ID available for getting all pictures metadata');
      return [];
    }

    console.log('🔍 Getting all pictures metadata for user:', user_id);

    // Get from Supabase database
    try {
      const { data: pictures, error } = await supabase
        .from('pictures')
        .select('*')
        .eq('user_id', String(user_id))
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error getting all pictures metadata:', error);
        return [];
      }

      console.log(`✅ Found ${pictures ? pictures.length : 0} pictures with metadata`);
      return pictures || [];

    } catch (supabaseError) {
      console.error('❌ Supabase all pictures metadata query error:', supabaseError);
      return [];
    }

  } catch (error) {
    console.error('❌ Error getting all pictures metadata:', error);
    return [];
  }
};

/**
 * Delete picture metadata
 * @param {string} imageUrl - Image URL or standardized reference
 * @param {string} user_id - User ID
 * @returns {Promise<boolean>} - Success status
 */
export const deletePictureMetadata = async (imageUrl, user_id = null) => {
  try {
    // Get current user if not provided
    if (!user_id) {
      user_id = await getCurrentUserId(supabase);
    } else {
      user_id = safeUserId(user_id);
    }

    if (!user_id) {
      console.error('❌ No valid user ID available for deleting picture metadata');
      return false;
    }

    // Standardize the image URL for consistent matching
    const standardizedImageUrl = createStorageReference(imageUrl);
    console.log('🗑️ Deleting picture metadata for:', standardizedImageUrl);

    // Delete from Supabase database
    try {
      const { error } = await supabase
        .from('pictures')
        .delete()
        .eq('user_id', String(user_id))
        .eq('image_url', standardizedImageUrl);

      if (error) {
        console.error('❌ Error deleting picture metadata:', error);
        return false;
      }

      console.log('✅ Picture metadata deleted successfully');
      return true;

    } catch (supabaseError) {
      console.error('❌ Supabase picture metadata deletion error:', supabaseError);
      return false;
    }

  } catch (error) {
    console.error('❌ Error deleting picture metadata:', error);
    return false;
  }
};

/**
 * Check if user has reached daily picture limit (10 pictures per day)
 * @param {string} user_id - User ID
 * @returns {Promise<{canTakePicture: boolean, todayCount: number, limit: number}>}
 */
export const checkDailyPictureLimit = async (user_id = null) => {
  try {
    // Get current user if not provided
    if (!user_id) {
      user_id = await getCurrentUserId(supabase);
    } else {
      user_id = safeUserId(user_id);
    }

    if (!user_id) {
      console.error('❌ No valid user ID available for checking daily limit');
      return { canTakePicture: false, todayCount: 0, limit: 10 };
    }

    const DAILY_LIMIT = 10;
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    console.log('📊 Checking daily picture limit for user:', user_id);
    console.log('📅 Date range:', todayStart.toISOString(), 'to', todayEnd.toISOString());

    // Count pictures created today from database
    try {
      const { data: todayPictures, error } = await supabase
        .from('pictures')
        .select('id', { count: 'exact' })
        .eq('user_id', String(user_id))
        .eq('deleted', false)
        .gte('created_at', todayStart.toISOString())
        .lt('created_at', todayEnd.toISOString());

      if (error) {
        console.error('❌ Error checking daily picture count:', error);
        return { canTakePicture: true, todayCount: 0, limit: DAILY_LIMIT };
      }

      const todayCount = todayPictures?.length || 0;
      const canTakePicture = todayCount < DAILY_LIMIT;

      console.log(`📸 Daily usage: ${todayCount}/${DAILY_LIMIT} pictures`);
      
      return {
        canTakePicture,
        todayCount,
        limit: DAILY_LIMIT
      };

    } catch (supabaseError) {
      console.error('❌ Supabase daily limit check error:', supabaseError);
      return { canTakePicture: true, todayCount: 0, limit: DAILY_LIMIT };
    }

  } catch (error) {
    console.error('❌ Error checking daily picture limit:', error);
    return { canTakePicture: true, todayCount: 0, limit: DAILY_LIMIT };
  }
};

/**
 * Get daily usage statistics for user
 * @param {string} user_id - User ID
 * @returns {Promise<{todayCount: number, weekCount: number, monthCount: number, limit: number}>}
 */
export const getDailyUsageStats = async (user_id = null) => {
  try {
    // Get current user if not provided
    if (!user_id) {
      user_id = await getCurrentUserId(supabase);
    } else {
      user_id = safeUserId(user_id);
    }

    if (!user_id) {
      console.error('❌ No valid user ID available for getting usage stats');
      return { todayCount: 0, weekCount: 0, monthCount: 0, limit: 10 };
    }

    const DAILY_LIMIT = 10;
    const now = new Date();
    
    // Today's range
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    // Week's range (last 7 days)
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    
    // Month's range (last 30 days)
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    console.log('📊 Getting usage statistics for user:', user_id);

    try {
      // Get counts for different time periods
      const [todayResult, weekResult, monthResult] = await Promise.all([
        // Today's count
        supabase
          .from('pictures')
          .select('id', { count: 'exact' })
          .eq('user_id', String(user_id))
          .eq('deleted', false)
          .gte('created_at', todayStart.toISOString())
          .lt('created_at', todayEnd.toISOString()),
        
        // Week's count
        supabase
          .from('pictures')
          .select('id', { count: 'exact' })
          .eq('user_id', String(user_id))
          .eq('deleted', false)
          .gte('created_at', weekStart.toISOString())
          .lt('created_at', todayEnd.toISOString()),
        
        // Month's count
        supabase
          .from('pictures')
          .select('id', { count: 'exact' })
          .eq('user_id', String(user_id))
          .eq('deleted', false)
          .gte('created_at', monthStart.toISOString())
          .lt('created_at', todayEnd.toISOString())
      ]);

      const todayCount = todayResult.data?.length || 0;
      const weekCount = weekResult.data?.length || 0;
      const monthCount = monthResult.data?.length || 0;

      console.log(`📈 Usage stats - Today: ${todayCount}, Week: ${weekCount}, Month: ${monthCount}`);
      
      return {
        todayCount,
        weekCount,
        monthCount,
        limit: DAILY_LIMIT
      };

    } catch (supabaseError) {
      console.error('❌ Supabase usage stats error:', supabaseError);
      return { todayCount: 0, weekCount: 0, monthCount: 0, limit: DAILY_LIMIT };
    }

  } catch (error) {
    console.error('❌ Error getting usage statistics:', error);
    return { todayCount: 0, weekCount: 0, monthCount: 0, limit: DAILY_LIMIT };
  }
}; 