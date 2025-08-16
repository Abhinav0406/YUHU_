import React, { createContext, useState, useContext, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  username: string;
  fullName: string | null;
  email: string;
  avatar: string | null;
  status: 'online' | 'offline' | 'away' | null;
  bio?: string | null;
  college?: string | null;
  major?: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, username: string, password: string) => Promise<string | true>;
  logout: () => Promise<void>;
  loading: boolean;
  updateProfile: (data: Partial<Profile>) => Promise<boolean>;
  deleteProfile: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isAuthenticated: false,
  login: async () => false,
  register: async () => 'Registration failed.',
  logout: async () => {},
  loading: true,
  updateProfile: async () => false,
  deleteProfile: async () => false
});

export const useAuth = () => useContext(AuthContext);

export class AuthError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Check database schema on initialization
  useEffect(() => {
    const checkDatabaseSchema = async () => {
      try {
        console.log('Checking database schema...');
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .limit(1);
        
        if (error) {
          console.error('Error checking profiles table:', error);
        } else if (data && data.length > 0) {
          const columns = Object.keys(data[0]);
          console.log('Available columns in profiles table:', columns);
          console.log('Sample profile data:', data[0]);
        } else {
          console.log('Profiles table is empty or has no data');
        }
      } catch (err) {
        console.error('Error checking database schema:', err);
      }
    };
    
    checkDatabaseSchema();
  }, []);

  // Subscribe to auth state changes when component mounts
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw new AuthError(sessionError.message, sessionError.status?.toString());
        }
        
        handleSession(session);
        
        // Listen for auth changes
        const { data: { subscription } } = await supabase.auth.onAuthStateChange(
          async (event, session) => {
            handleSession(session);
          }
        );

        // Cleanup subscription
        return () => {
          subscription?.unsubscribe();
        };
      } catch (error) {
        console.error('Error setting up auth subscription:', error);
        if (error instanceof AuthError) {
          throw error;
        }
        throw new AuthError('Failed to initialize authentication');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, []);

  // Handle auth session
  const handleSession = async (session: Session | null) => {
    if (session?.user) {
      setUser(session.user);
      
      try {
        // Fetch profile data
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error) {
          // If profile doesn't exist, create one
          if (error.code === 'PGRST116') {
            console.log('Profile not found, creating new profile...');
            
            const profileData: any = {
              id: session.user.id,
              username: session.user.email?.split('@')[0] || 'user',
              email: session.user.email || ''
            };

            // Check what columns are available and add them accordingly
            try {
              const { data: schemaCheck, error: schemaError } = await supabase
                .from('profiles')
                .select('*')
                .limit(1);
              
              if (!schemaError && schemaCheck && schemaCheck.length > 0) {
                const sampleRow = schemaCheck[0];
                const availableColumns = Object.keys(sampleRow);
                console.log('Available columns in profiles table:', availableColumns);
                
                // Add optional columns only if they exist
                if (availableColumns.includes('full_name')) {
                  profileData.full_name = session.user.email?.split('@')[0] || 'User';
                }
                if (availableColumns.includes('avatar_url')) {
                  profileData.avatar_url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`;
                }
                if (availableColumns.includes('status')) {
                  profileData.status = 'online';
                }
                if (availableColumns.includes('created_at')) {
                  profileData.created_at = new Date().toISOString();
                }
                if (availableColumns.includes('updated_at')) {
                  profileData.updated_at = new Date().toISOString();
                }
              }
            } catch (schemaCheckError) {
              console.warn('Could not check schema, using minimal profile data:', schemaCheckError);
            }

            console.log('Creating profile with data:', profileData);

            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert(profileData)
              .select()
              .single();

            if (createError) {
              console.error('Profile creation error:', createError);
              throw new AuthError(`Error creating profile: ${createError.message}`, createError.code);
            }

            if (newProfile) {
              setProfile({
                id: newProfile.id,
                username: newProfile.username,
                fullName: newProfile.full_name || newProfile.username,
                email: newProfile.email,
                avatar: newProfile.avatar_url || null,
                status: newProfile.status || 'online',
                bio: newProfile.bio || null,
                college: newProfile.college || null,
                major: newProfile.major || null
              });
            }
          } else {
            throw new AuthError(`Error fetching profile: ${error.message}`, error.code);
          }
        } else if (data) {
          setProfile({
            id: data.id,
            username: data.username,
            fullName: data.full_name,
            email: data.email,
            avatar: data.avatar_url,
            status: data.status,
            bio: data.bio,
            college: data.college,
            major: data.major
          });
        }
      } catch (err) {
        console.error('Error in handleSession:', err);
        if (err instanceof AuthError) {
          throw err;
        }
        throw new AuthError('Failed to handle authentication session');
      }
    } else {
      setUser(null);
      setProfile(null);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    if (!email || !password) {
      throw new AuthError('Email and password are required');
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });

      if (error) {
        throw new AuthError(error.message, error.status?.toString());
      }

      return !!data.user;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, username: string, password: string): Promise<string | true> => {
    if (!email || !username || !password) {
      throw new AuthError('Email, username, and password are required');
    }

    if (password.length < 6) {
      throw new AuthError('Password must be at least 6 characters long');
    }

    setLoading(true);
    let createdUserId: string | null = null;
    try {
      console.log('Starting registration process...');
      
      // Create the user first
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            username
          }
        }
      });

      if (error) {
        console.error('Supabase auth error:', error);
        if (error.message && error.message.toLowerCase().includes('email')) {
          throw new AuthError('Email already registered', 'EMAIL_EXISTS');
        }
        throw new AuthError(error.message, error.status?.toString());
      }

      if (!data.user) {
        throw new AuthError('Registration failed - no user data returned');
      }
      createdUserId = data.user.id;
      console.log('User created with ID:', createdUserId);

      // Now check if username is already taken (should be unique in profiles)
      const { data: existingUsers, error: checkError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .limit(1);

      if (checkError) {
        console.error('Error checking username:', checkError);
        throw new AuthError(`Error checking username: ${checkError.message}`, checkError.code);
      }

      if (existingUsers && existingUsers.length > 0) {
        throw new AuthError('Username already taken', 'USERNAME_EXISTS');
      }

      // Create profile record with only essential columns
      const profileData: any = {
        id: createdUserId,
        username: username,
        email: email
      };

      // Only add columns if they exist (we'll check the schema first)
      try {
        const { data: schemaCheck, error: schemaError } = await supabase
          .from('profiles')
          .select('*')
          .limit(1);
        
        if (!schemaError && schemaCheck && schemaCheck.length > 0) {
          const sampleRow = schemaCheck[0];
          const availableColumns = Object.keys(sampleRow);
          console.log('Available columns in profiles table:', availableColumns);
          
          // Add optional columns only if they exist
          if (availableColumns.includes('full_name')) {
            profileData.full_name = username.charAt(0).toUpperCase() + username.slice(1);
          }
          if (availableColumns.includes('avatar_url')) {
            profileData.avatar_url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`;
          }
          if (availableColumns.includes('status')) {
            profileData.status = 'online';
          }
          if (availableColumns.includes('created_at')) {
            profileData.created_at = new Date().toISOString();
          }
          if (availableColumns.includes('updated_at')) {
            profileData.updated_at = new Date().toISOString();
          }
        }
      } catch (schemaCheckError) {
        console.warn('Could not check schema, using minimal profile data:', schemaCheckError);
      }

      console.log('Creating profile with data:', profileData);

      const { error: profileError } = await supabase
        .from('profiles')
        .insert(profileData);

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw new AuthError(`Error creating profile: ${profileError.message}`, profileError.code);
      }
      
      console.log('Profile created successfully');
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Update user status to offline
      if (user?.id) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ status: 'offline' })
          .eq('id', user.id);

        if (updateError) {
          throw new AuthError(`Error updating status: ${updateError.message}`, updateError.code);
        }
      }
      
      // Sign out
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        throw new AuthError(`Error signing out: ${signOutError.message}`, signOutError.status?.toString());
      }
      
      setUser(null);
      setProfile(null);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Failed to logout');
    }
  };

  const updateProfile = async (data: Partial<Profile>): Promise<boolean> => {
    if (!user?.id) {
      throw new AuthError('User must be logged in to update profile');
    }

    try {
      // Transform data to match database schema
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (data.username) updateData.username = data.username;
      if (data.fullName !== undefined) updateData.full_name = data.fullName;
      if (data.avatar !== undefined) updateData.avatar_url = data.avatar;
      if (data.status) updateData.status = data.status;
      if (data.bio !== undefined) updateData.bio = data.bio;
      if (data.college !== undefined) updateData.college = data.college;
      if (data.major !== undefined) updateData.major = data.major;

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        throw new AuthError(`Error updating profile: ${error.message}`, error.code);
      }

      // Update local profile state
      setProfile(prev => prev ? { ...prev, ...data } : null);
      return true;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Failed to update profile');
    }
  };

  const deleteProfile = async (): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      // Delete the profile row
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);
      if (error) throw error;
      // Optionally: delete user from auth (requires service role key)
      // await supabase.auth.admin.deleteUser(user.id);
      await logout();
      return true;
    } catch (error) {
      console.error('Error deleting profile:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        loading,
        updateProfile,
        deleteProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
