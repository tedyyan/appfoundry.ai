# Test Users Guide - SnapFind

This guide explains how to create test users that can login immediately without email confirmation.

## 🚀 Quick Start

### Method 1: Using the In-App Test User Manager (Recommended for development)

1. **Access the Test User Manager:**
   - Open your app and go to the login screen
   - **Long press** on the "SnapFindMy" title
   - You'll see "Developer Mode - Test User Manager"

2. **Create Default Test Users:**
   - Tap "Create Default Test Users" 
   - This creates 18 ready-to-use test accounts:
     - `remobtesterone1@gmail.com` / `password123`
     - `remobtestertwo2@gmail.com` / `password123` 
     - `remobtesterthree3@gmail.com` / `password123`
     - ... and 15 more similar accounts

3. **Create Custom Test Users:**
   - Fill in the email, password, and name fields
   - Tap "Create Custom User"
   - The user will be created with confirmed email

4. **Login:**
   - Tap "Back to Login" 
   - Use any of the created credentials to login immediately

### Method 2: Using the Terminal Script

1. **Setup:**
   ```bash
   cd scripts
   npm install @supabase/supabase-js
   ```

2. **Get your Service Role Key:**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Navigate to: Project Settings > API
   - Copy your `service_role` key (⚠️ This bypasses RLS - keep it secure!)

3. **Update the script:**
   - Open `scripts/createTestUsers.js`
   - Replace `your-service-role-key-here` with your actual service role key

4. **Run the script:**
   ```bash
   node createTestUsers.js
   ```

5. **Login with created users:**
   - The script will output the email/password combinations
   - Use them in your app to login immediately

## 🔧 Configuration Required

### Step 1: Add Service Role Key to Configuration

You need to add your Supabase service role key to enable admin operations:

1. Open `src/config/env.js`
2. Replace the `serviceRoleKey` with your actual key:

```javascript
supabase: {
  url: 'your-supabase-url',
  anonKey: 'your-anon-key',
  serviceRoleKey: 'your-actual-service-role-key-here', // 👈 Update this
},
```

**⚠️ Security Warning:** The service role key bypasses Row Level Security (RLS). Only use it for admin operations and keep it secure. Never expose it in client-side code in production.

### Step 2: Get Your Service Role Key

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the `service_role` key (not the `anon` key)
5. Update your configuration files

## 📱 How It Works

The test user creation system works by:

1. **Using Supabase Admin API:** Instead of the regular `signUp()` function, we use `admin.createUser()`
2. **Bypassing Email Confirmation:** We set `email_confirm: true` when creating users
3. **Immediate Login:** Users can login right away without checking email

### Regular Signup (requires email confirmation):
```javascript
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  // User must check email to confirm
});
```

### Test User Creation (no email confirmation):
```javascript
const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email,
  password,
  email_confirm: true, // 👈 This skips email verification
  user_metadata: { full_name: fullName },
});
```

## 🛠️ Available Methods

### 1. In-App Test User Manager
- **Location:** Login screen → Long press title
- **Best for:** Quick testing during development
- **Features:** 
  - Create default test users
  - Create custom users
  - Visual interface

### 2. Terminal Script
- **Location:** `scripts/createTestUsers.js`
- **Best for:** Batch user creation, CI/CD, automation
- **Features:**
  - Command-line interface
  - Batch creation
  - Scriptable

### 3. Programmatic API
- **Location:** `src/services/testUsers.js`
- **Best for:** Custom integration, automated testing
- **Features:**
  - Import and use in your code
  - Full programmatic control

## 🎯 Use Cases

- **Development Testing:** Quickly create users to test features
- **Demo Preparation:** Set up demo accounts for presentations
- **Automated Testing:** Create test users for your test suites
- **Team Development:** Share test credentials with team members

## 🔒 Security Best Practices

1. **Development Only:** Remove test user creation code before production
2. **Secure Keys:** Never commit service role keys to version control
3. **Environment Variables:** Use environment variables for sensitive keys
4. **Limited Access:** Only give service role key to developers who need it

## 📞 Usage Examples

### Creating a specific test user:
```javascript
import { createTestUser } from '../services/testUsers';

const result = await createTestUser(
  'john.doe@example.com',
  'securepassword123',
  'John Doe'
);

if (result.success) {
  console.log('User created! They can login immediately.');
}
```

### Creating multiple users:
```javascript
import { createTestUsers, DEFAULT_TEST_USERS } from '../services/testUsers';

const results = await createTestUsers(DEFAULT_TEST_USERS);
console.log(`Created ${results.filter(r => r.success).length} users`);
```

## 🚫 Removing for Production

Before deploying to production:

1. **Remove the developer option from LoginScreen:**
   - Comment out or remove the long press functionality
   - Remove the TestUserManager import

2. **Remove the test files:**
   ```bash
   rm src/services/testUsers.js
   rm src/components/TestUserManager.js
   rm src/screens/TestUserScreen.js
   rm scripts/createTestUsers.js
   ```

3. **Remove service role key from config:**
   - Remove `serviceRoleKey` from `src/config/env.js`
   - Or set it to `null` in production environment

## 🎉 Default Test Users

When you create default test users, you get 18 accounts:

| Email | Password | Name |
|-------|----------|------|
| remobtesterone1@gmail.com | password123 | Remote Tester 1 |
| remobtestertwo2@gmail.com | password123 | Remote Tester 2 |
| remobtesterthree3@gmail.com | password123 | Remote Tester 3 |
| remobtesterfour4@gmail.com | password123 | Remote Tester 4 |
| remobtesterfive5@gmail.com | password123 | Remote Tester 5 |
| remobtestersix6@gmail.com | password123 | Remote Tester 6 |
| remobtester@gmail.com | password123 | Remote Tester Main |
| remobtester8@gmail.com | password123 | Remote Tester 8 |
| remobtester9@gmail.com | password123 | Remote Tester 9 |
| remobtester10@gmail.com | password123 | Remote Tester 10 |
| remobtester11@gmail.com | password123 | Remote Tester 11 |
| remobtester12@gmail.com | password123 | Remote Tester 12 |
| remobtester13@gmail.com | password123 | Remote Tester 13 |
| remobtester14@gmail.com | password123 | Remote Tester 14 |
| remobtester15@gmail.com | password123 | Remote Tester 15 |
| remobtester16@gmail.com | password123 | Remote Tester 16 |
| remobtester17@gmail.com | password123 | Remote Tester 17 |
| remobtester18@gmail.com | password123 | Remote Tester 18 |

All these users have **confirmed emails** and can login immediately!

---

**Happy Testing! 🧪** 