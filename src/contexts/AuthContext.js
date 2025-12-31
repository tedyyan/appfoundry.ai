import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import * as SecureStore from 'expo-secure-store';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

// Configure WebBrowser for better OAuth experience
WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('Starting auth initialization...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting session:', sessionError);
          setError(sessionError);
        } else {
          console.log('Session retrieved:', session ? 'Yes' : 'No');
          setUser(session?.user ?? null);
          setError(null);
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
        setError(error);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setUser(session?.user ?? null);
        setLoading(false);
        setError(null);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Sign in with email and password
  const signInWithEmail = async (email, password) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error signing in:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign up with email and password
  const signUpWithEmail = async (email, password, fullName) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error signing up:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign in with Google using expo-auth-session
  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      console.log('🔑 Starting Google OAuth flow...');

      // Create the redirect URI - use Expo development URL in dev
      const redirectUri = makeRedirectUri({
        scheme: 'snapfind',
        path: 'auth/callback',
      });
      
      console.log('🔗 Redirect URI:', redirectUri);
      console.log('🔗 Redirect URI Length:', redirectUri.length);
      console.log('🔗 Redirect URI Encoded:', encodeURIComponent(redirectUri));

      // Try direct Supabase OAuth without custom query params first
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
        },
      });

      if (error) {
        console.error('❌ Supabase OAuth error:', error);
        throw error;
      }

      if (data?.url) {
        console.log('🌐 Opening OAuth URL:', data.url);
        
        // Open the OAuth URL in browser
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUri,
          {
            showInRecents: false,
          }
        );

        console.log('📱 OAuth result:', result);

        if (result.type === 'success') {
          // Extract the URL parameters
          const url = result.url;
          console.log('🔗 Success URL:', url);
          
          // Handle different possible URL formats
          let urlParams;
          if (url.includes('#')) {
            urlParams = new URLSearchParams(url.split('#')[1]);
          } else if (url.includes('?')) {
            urlParams = new URLSearchParams(url.split('?')[1]);
          } else {
            console.log('⚠️ No URL parameters found in:', url);
            throw new Error('No authentication parameters found in callback URL');
          }
          
          const accessToken = urlParams.get('access_token');
          const refreshToken = urlParams.get('refresh_token');
          
          console.log('🔑 Access token found:', !!accessToken);
          console.log('🔄 Refresh token found:', !!refreshToken);
          
          if (accessToken) {
            console.log('✅ Got access token, setting session...');
            
            // Set the session with the tokens
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (sessionError) {
              console.error('❌ Session error:', sessionError);
              throw sessionError;
            }

            console.log('🎉 Google sign-in successful!');
            return { success: true, data: sessionData };
          } else {
            console.error('❌ No access token in URL params:', Array.from(urlParams.entries()));
            throw new Error('No access token received from OAuth flow');
          }
        } else if (result.type === 'cancel') {
          console.log('⚠️ User cancelled OAuth flow');
          return { success: false, error: 'Sign-in was cancelled' };
        } else {
          console.error('❌ OAuth flow failed:', result);
          throw new Error('OAuth flow failed');
        }
      } else {
        throw new Error('No OAuth URL received from Supabase');
      }
    } catch (error) {
      console.error('❌ Error signing in with Google:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign in with Facebook
  const signInWithFacebook = async () => {
    try {
      setLoading(true);
      console.log('🔑 Starting Facebook OAuth flow...');

      const redirectUri = makeRedirectUri({
        scheme: 'snapfind',
        path: 'auth/callback',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: redirectUri,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUri,
          {
            showInRecents: false,
          }
        );

        if (result.type === 'success') {
          const url = result.url;
          const urlParams = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
          
          const accessToken = urlParams.get('access_token');
          const refreshToken = urlParams.get('refresh_token');
          
          if (accessToken) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (sessionError) {
              throw sessionError;
            }

            return { success: true, data: sessionData };
          } else {
            throw new Error('No access token received from OAuth flow');
          }
        } else if (result.type === 'cancel') {
          return { success: false, error: 'Sign-in was cancelled' };
        } else {
          throw new Error('OAuth flow failed');
        }
      } else {
        throw new Error('No OAuth URL received from Supabase');
      }
    } catch (error) {
      console.error('Error signing in with Facebook:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign in with Apple
  const signInWithApple = async () => {
    try {
      setLoading(true);
      console.log('🔑 Starting Apple OAuth flow...');

      const redirectUri = makeRedirectUri({
        scheme: 'snapfind',
        path: 'auth/callback',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUri,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUri,
          {
            showInRecents: false,
          }
        );

        if (result.type === 'success') {
          const url = result.url;
          const urlParams = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
          
          const accessToken = urlParams.get('access_token');
          const refreshToken = urlParams.get('refresh_token');
          
          if (accessToken) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (sessionError) {
              throw sessionError;
            }

            return { success: true, data: sessionData };
          } else {
            throw new Error('No access token received from OAuth flow');
          }
        } else if (result.type === 'cancel') {
          return { success: false, error: 'Sign-in was cancelled' };
        } else {
          throw new Error('OAuth flow failed');
        }
      } else {
        throw new Error('No OAuth URL received from Supabase');
      }
    } catch (error) {
      console.error('Error signing in with Apple:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }

      // Clear any stored data
      await SecureStore.deleteItemAsync('snapfind_user_data');
      
      return { success: true };
    } catch (error) {
      console.error('Error signing out:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Reset password
  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'snapfind://auth/reset-password',
      });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Error resetting password:', error);
      return { success: false, error: error.message };
    }
  };

  // Update profile
  const updateProfile = async (updates) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.updateUser({
        data: updates,
      });

      if (error) {
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      initialized,
      error,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signInWithFacebook,
      signInWithApple,
      signOut,
      resetPassword,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}; 