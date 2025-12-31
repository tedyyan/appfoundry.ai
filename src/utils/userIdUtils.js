// Utility functions for safe user ID handling
// Fixes the "invalid input syntax for type uuid: [object Object]" error

/**
 * Safely extracts and validates a user ID
 * @param {any} userOrId - User object or user ID string
 * @returns {string|null} - Valid user ID string or null
 */
export const safeUserId = (userOrId) => {
  // If it's null or undefined
  if (!userOrId) {
    console.warn('⚠️ User ID is null or undefined');
    return null;
  }
  
  // If it's already a string
  if (typeof userOrId === 'string') {
    // Check if it looks like a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(userOrId)) {
      return userOrId;
    } else {
      console.warn('⚠️ String user ID does not match UUID pattern:', userOrId);
      return userOrId; // Return anyway, might be valid
    }
  }
  
  // If it's an object, try to extract ID
  if (typeof userOrId === 'object') {
    console.warn('⚠️ User ID is an object, attempting to extract ID:', userOrId);
    
    // Try common user object properties
    if (userOrId.id) {
      return safeUserId(userOrId.id); // Recursive call
    } else if (userOrId.user_id) {
      return safeUserId(userOrId.user_id);
    } else if (userOrId.uid) {
      return safeUserId(userOrId.uid);
    } else {
      console.error('❌ Unable to extract user ID from object:', userOrId);
      return null;
    }
  }
  
  // Convert other types to string
  const stringId = String(userOrId);
  console.warn('⚠️ Converting user ID to string:', typeof userOrId, '->', stringId);
  return stringId;
};

/**
 * Validates if a string is a valid UUID
 * @param {string} id - The ID to validate
 * @returns {boolean} - Whether the ID is a valid UUID
 */
export const isValidUUID = (id) => {
  if (typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Logs user ID information for debugging
 * @param {any} userOrId - User object or ID to debug
 * @param {string} context - Context where this is being called from
 */
export const debugUserId = (userOrId, context = 'unknown') => {
  console.log(`🔍 User ID Debug [${context}]:`);
  console.log('  Type:', typeof userOrId);
  console.log('  Value:', userOrId);
  console.log('  Stringified:', JSON.stringify(userOrId));
  
  const safeId = safeUserId(userOrId);
  console.log('  Safe ID:', safeId);
  console.log('  Is valid UUID:', isValidUUID(safeId));
};

/**
 * Gets a safe user ID from the current Supabase session
 * @param {object} supabase - Supabase client instance
 * @returns {Promise<string|null>} - Safe user ID or null
 */
export const getCurrentUserId = async (supabase) => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('❌ Error getting current user:', error);
      return null;
    }
    
    if (!user) {
      console.warn('⚠️ No authenticated user');
      return null;
    }
    
    const safeId = safeUserId(user.id);
    console.log('✅ Current user ID:', safeId);
    return safeId;
  } catch (error) {
    console.error('❌ Exception getting current user:', error);
    return null;
  }
}; 