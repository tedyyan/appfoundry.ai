import { supabaseAdmin } from './supabase';

/**
 * Creates a test user with confirmed email (bypasses email verification)
 * Note: This requires admin privileges - uses service role key
 */
export const createTestUser = async (email, password, fullName = 'Test User') => {
  try {
    if (!supabaseAdmin) {
      throw new Error('Admin client not configured. Please add serviceRoleKey to your env.js configuration.');
    }

    // Use admin client to create user with confirmed email
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // This bypasses email confirmation
      user_metadata: {
        full_name: fullName,
      },
    });

    if (error) {
      throw error;
    }

    console.log('✅ Test user created successfully:', email);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Creates multiple test users at once
 */
export const createTestUsers = async (users) => {
  const results = [];
  
  for (const user of users) {
    const result = await createTestUser(user.email, user.password, user.fullName);
    results.push({ ...user, ...result });
  }
  
  return results;
};

/**
 * Predefined test users for quick setup - using your custom email list
 */
export const DEFAULT_TEST_USERS = [
  {
    email: 'remobtesterone1@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 1',
  },
  {
    email: 'remobtestertwo2@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 2',
  },
  {
    email: 'remobtesterthree3@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 3',
  },
  {
    email: 'remobtesterfour4@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 4',
  },
  {
    email: 'remobtesterfive5@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 5',
  },
  {
    email: 'remobtestersix6@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 6',
  },
  {
    email: 'remobtester@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester Main',
  },
  {
    email: 'remobtester8@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 8',
  },
  {
    email: 'remobtester9@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 9',
  },
  {
    email: 'remobtester10@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 10',
  },
  {
    email: 'remobtester11@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 11',
  },
  {
    email: 'remobtester12@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 12',
  },
  {
    email: 'remobtester13@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 13',
  },
  {
    email: 'remobtester14@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 14',
  },
  {
    email: 'remobtester15@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 15',
  },
  {
    email: 'remobtester16@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 16',
  },
  {
    email: 'remobtester17@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 17',
  },
  {
    email: 'remobtester18@gmail.com',
    password: 'password123',
    fullName: 'Remote Tester 18',
  },
];

/**
 * Quick function to create default test users
 */
export const setupDefaultTestUsers = async () => {
  console.log('🧪 Setting up default test users...');
  const results = await createTestUsers(DEFAULT_TEST_USERS);
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Created ${successful.length} test users successfully`);
  if (failed.length > 0) {
    console.log(`❌ Failed to create ${failed.length} test users:`, failed);
  }
  
  return results;
}; 