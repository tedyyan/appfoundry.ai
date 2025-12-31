import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env';

// Check if Supabase is properly configured
const isSupabaseConfigured = () => {
  try {
    return config.supabase.url && 
           config.supabase.anonKey && 
           !config.supabase.url.includes('your-project-id') &&
           !config.supabase.anonKey.includes('your-anon-key-here');
  } catch (error) {
    console.error('Error checking Supabase configuration:', error);
    return false;
  }
};

let supabase;
try {
  console.log('Initializing Supabase...');
  // Always use the configuration from env.js
  supabase = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
} catch (error) {
  console.error('Failed to initialize Supabase:', error);
  // Create a mock client that won't crash the app
  supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    storage: {
      listBuckets: async () => ({ data: [], error: null }),
      from: () => ({
        list: async () => ({ data: [], error: null }),
      }),
    },
  };
}

export { supabase };

// Log configuration status
try {
  console.log('Supabase configured:', isSupabaseConfigured());
  if (config.supabase.url) {
    console.log('Supabase URL:', config.supabase.url.substring(0, 30) + '...');
  }
  if (config.supabase.anonKey) {
    console.log('Supabase Key:', config.supabase.anonKey.substring(0, 20) + '...');
  }
} catch (error) {
  console.error('Error logging Supabase configuration:', error);
}

// Database setup functions
export const initializeSupabaseTables = async () => {
  try {
    console.log('Checking if objects table exists...');
    
    // First, try to query the table to see if it exists
    const { data, error } = await supabase
      .from('objects')
      .select('id')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      // Table doesn't exist, create it via SQL
      console.log('Objects table does not exist, creating...');
      
      const { error: createError } = await supabase.rpc('create_objects_table_if_not_exists');
      
      if (createError) {
        console.warn('Could not create table via RPC, table may need to be created manually:', createError);
        // This is not a critical error - the app can still work with local storage
      } else {
        console.log('Objects table created successfully');
      }
    } else if (error) {
      console.warn('Error checking objects table:', error);
    } else {
      console.log('Objects table already exists');
    }
    
    // Check storage bucket (with fallback for permission issues)
    console.log('Checking storage buckets...');
    
    try {
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      
      if (bucketError) {
        console.warn('Could not list storage buckets:', bucketError);
        console.warn('This is likely due to RLS policies on storage.buckets');
        console.log('💡 Trying direct bucket access test instead...');
        
        // Try to access the images bucket directly
        const { data: files, error: directError } = await supabase.storage
          .from('images')
          .list('', { limit: 1 });
          
        if (directError) {
          console.warn('❌ Cannot access images bucket directly:', directError);
          console.warn('Please run FIX_STORAGE_PERMISSIONS.sql to fix storage policies');
        } else {
          console.log('✅ Images bucket is accessible (direct test passed)');
        }
        
      } else {
        console.log('Available buckets:', buckets.map(b => b.name));
        
        // Check for 'images' bucket (case sensitive)
        const imagesBucket = buckets.find(bucket => bucket.name === 'images');
        
        if (imagesBucket) {
          console.log('✓ Images storage bucket found:', imagesBucket);
          
          // Test bucket access
          try {
            const { data: files, error: listError } = await supabase.storage
              .from('images')
              .list('', { limit: 1 });
              
            if (listError) {
              console.warn('Images bucket exists but cannot list files:', listError);
              console.warn('This might be a permissions issue. Check your storage policies.');
            } else {
              console.log('✓ Images bucket is accessible');
            }
          } catch (accessError) {
            console.warn('Error testing bucket access:', accessError);
          }
          
        } else {
          console.warn('❌ Images storage bucket not found in listing');
          console.warn('Available buckets:', buckets.map(b => `"${b.name}"`).join(', '));
          console.warn('But bucket might still work - testing direct access...');
          
          // Try direct access even if not in listing
          try {
            const { data: files, error: directError } = await supabase.storage
              .from('images')
              .list('', { limit: 1 });
              
            if (directError) {
              console.warn('❌ Direct access also failed:', directError);
            } else {
              console.log('✅ Images bucket works via direct access!');
            }
          } catch (directAccessError) {
            console.warn('Direct access test failed:', directAccessError);
          }
        }
      }
    } catch (storageError) {
      console.error('Unexpected storage error:', storageError);
      console.log('⚠️  Storage initialization failed, but app will continue with local storage');
    }
    
  } catch (error) {
    console.error('Error initializing Supabase:', error);
    // Don't throw - allow app to continue with local storage
  }
};

// Legacy alias for backwards compatibility
export const initializeDatabase = initializeSupabaseTables;

// Helper function to create objects table (to be run as SQL function in Supabase)
/*
CREATE OR REPLACE FUNCTION create_objects_table()
RETURNS void AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS objects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT,
    object_name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  
  -- Create indexes for better performance
  CREATE INDEX IF NOT EXISTS idx_objects_object_name ON objects(object_name);
  CREATE INDEX IF NOT EXISTS idx_objects_created_at ON objects(created_at);
  CREATE INDEX IF NOT EXISTS idx_objects_user_id ON objects(user_id);
  
  -- Enable RLS (Row Level Security) if needed
  ALTER TABLE objects ENABLE ROW LEVEL SECURITY;
  
  -- Create a policy that allows all operations for now
  CREATE POLICY IF NOT EXISTS "Allow all operations" ON objects FOR ALL USING (true);
END;
$$ LANGUAGE plpgsql;
*/ 