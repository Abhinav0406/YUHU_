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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isAuthenticated: false,
  login: async () => false,
  register: async () => 'Registration failed.',
  logout: async () => {},
  loading: true,
  updateProfile: async () => false
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to auth state changes when component mounts
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
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
      
      // Fetch profile data
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!error && data) {
        setProfile({
          id: data.id,
          username: data.username,
          fullName: data.full_name,
          email: data.email,
          avatar: data.avatar_url,
          status: data.status || 'online',
          bio: data.bio,
          college: data.college,
          major: data.major
        });
      } else if (error) {
        console.error('Error fetching profile:', error);
      }
    } else {
      setUser(null);
      setProfile(null);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });

      if (error) {
        console.error('Login error:', error.message);
        return false;
      }

      return !!data.user;
    } catch (error) {
      console.error('Login exception:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, username: string, password: string): Promise<string | true> => {
    setLoading(true);
    let createdUserId: string | null = null;
    try {
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
        if (error.message && error.message.toLowerCase().includes('email')) {
          return 'Email already registered.';
        }
        return error.message || 'Registration failed.';
      }

      if (!data.user) {
        return 'Registration failed.';
      }
      createdUserId = data.user.id;

      // Now check if username is already taken (should be unique in profiles)
      const { data: existingUsers, error: checkError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .limit(1);

      if (checkError) {
        return 'An error occurred while checking username.';
      }

      if (existingUsers && existingUsers.length > 0) {
        return 'Username already taken.';
      }

      // Create profile record
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: createdUserId,
          username: username,
          full_name: username.charAt(0).toUpperCase() + username.slice(1),
          email: email,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
          status: 'online',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        return 'Error creating profile.';
      }
      return true;
    } catch (error: any) {
      return error?.message || 'Registration exception.';
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Update user status to offline
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({ status: 'offline' })
          .eq('id', user.id);
      }
      
      // Sign out
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateProfile = async (data: Partial<Profile>): Promise<boolean> => {
    if (!user?.id) return false;

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
        console.error('Error updating profile:', error);
        return false;
      }

      // Update local profile state
      setProfile(prev => prev ? { ...prev, ...data } : null);
      return true;
    } catch (error) {
      console.error('Update profile exception:', error);
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
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
