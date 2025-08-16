import { supabase } from '@/lib/supabase';

export class FriendServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'FriendServiceError';
  }
}

// Function to send a friend request
export async function sendFriendRequest(senderEmail: string, receiverEmail: string) {
  if (!senderEmail || !receiverEmail) {
    throw new FriendServiceError('Sender and receiver emails are required');
  }

  // Check if a friend request already exists
  const { data: existingRequest, error: checkError } = await supabase
    .from('friend_requests')
    .select('*')
    .or(`and(sender_email.eq.${senderEmail},receiver_email.eq.${receiverEmail}),and(sender_email.eq.${receiverEmail},receiver_email.eq.${senderEmail})`)
    .maybeSingle();

  if (checkError) {
    throw new FriendServiceError(`Error checking existing friend request: ${checkError.message}`, checkError.code);
  }

  if (existingRequest) {
    throw new FriendServiceError('A friend request already exists between these users.', 'DUPLICATE_REQUEST');
  }

  const { data, error } = await supabase
    .from('friend_requests')
    .insert([
      { sender_email: senderEmail, receiver_email: receiverEmail, status: 'pending' }
    ])
    .select();

  if (error) {
    throw new FriendServiceError(`Error sending friend request: ${error.message}`, error.code);
  }

  return data;
}

// Function to view pending friend requests
export const getPendingRequests = async (userEmail: string) => {
  if (!userEmail) {
    throw new FriendServiceError('User email is required');
  }

  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('receiver_email', userEmail)
      .eq('status', 'pending');

    if (error) {
      throw new FriendServiceError(error.message, error.code);
    }

    return data;
  } catch (err) {
    if (err instanceof FriendServiceError) {
      throw err;
    }
    throw new FriendServiceError('Failed to fetch pending requests');
  }
};

// Function to accept or reject a friend request
export const respondToFriendRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
  if (!requestId) {
    throw new FriendServiceError('Request ID is required');
  }

  if (!['accepted', 'rejected'].includes(status)) {
    throw new FriendServiceError('Invalid status. Must be either "accepted" or "rejected"');
  }

  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .update({ status })
      .eq('id', requestId);

    if (error) {
      throw new FriendServiceError(error.message, error.code);
    }

    if (status === 'accepted') {
      const { data: requestData, error: requestError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError) {
        throw new FriendServiceError(requestError.message, requestError.code);
      }

      const { error: friendError } = await supabase
        .from('friends')
        .insert([
          { user1_email: requestData.sender_email, user2_email: requestData.receiver_email },
          { user1_email: requestData.receiver_email, user2_email: requestData.sender_email },
        ]);

      if (friendError) {
        throw new FriendServiceError(friendError.message, friendError.code);
      }
    }

    return data;
  } catch (err) {
    if (err instanceof FriendServiceError) {
      throw err;
    }
    throw new FriendServiceError('Failed to respond to friend request');
  }
};

// Function to check confirmed friendships
export const getFriends = async (userEmail: string) => {
  try {
    const { data, error } = await supabase
      .from('friends')
      .select('*')
      .or(`user1_email.eq.${userEmail},user2_email.eq.${userEmail}`);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (err) {
    console.error('Error fetching friends:', err);
    throw err;
  }
};

// Subscribe to real-time updates for friend requests
export const subscribeToFriendRequests = (callback: (request: { id: string; sender_email: string; receiver_email: string; status: string }) => void) => {
  return supabase
    .channel('realtime:friend_requests')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friend_requests' }, (payload) => {
      callback(payload.new as { id: string; sender_email: string; receiver_email: string; status: string });
    })
    .subscribe();
};

// Subscribe to real-time updates for profile changes (including deletions)
export const subscribeToProfileChanges = (callback: (change: { event: 'INSERT' | 'UPDATE' | 'DELETE', old?: any, new?: any }) => void) => {
  return supabase
    .channel('realtime:profiles')
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'profiles' 
    }, (payload) => {
      callback({
        event: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
        old: payload.old,
        new: payload.new
      });
    })
    .subscribe();
};

// Subscribe to real-time updates for friends table changes
export const subscribeToFriendsChanges = (callback: (change: { event: 'INSERT' | 'UPDATE' | 'DELETE', old?: any, new?: any }) => void) => {
  return supabase
    .channel('realtime:friends')
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'friends' 
    }, (payload) => {
      callback({
        event: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
        old: payload.old,
        new: payload.new
      });
    })
    .subscribe();
};

// Helper function to check if a user profile is valid and active
export const isUserProfileValid = (user: any): boolean => {
  if (!user) return false;
  
  // Check for basic required fields
  const hasRequiredFields = user.id && user.email && user.username;
  if (!hasRequiredFields) return false;
  
  // Check field types
  const hasValidTypes = typeof user.id === 'string' && 
                       typeof user.email === 'string' && 
                       typeof user.username === 'string';
  if (!hasValidTypes) return false;
  
  // Check for empty strings or whitespace-only strings
  const hasValidContent = user.id.trim() !== '' && 
                         user.email.trim() !== '' && 
                         user.username.trim() !== '';
  if (!hasValidContent) return false;
  
  // Check for common deletion patterns (only check fields that exist)
  const isNotDeleted = !user.email.includes('deleted') &&
                      !user.username.includes('deleted') &&
                      !user.email.includes('test') &&
                      !user.username.includes('test') &&
                      !user.email.includes('demo') &&
                      !user.username.includes('demo');
  
  return isNotDeleted;
};

// Helper function to check the actual schema of the profiles table
export const checkProfilesTableSchema = async () => {
  try {
    console.log('Checking profiles table schema...');
    
    // Try to fetch a single row to see what columns exist
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error checking schema:', error);
      return null;
    }
    
    if (data && data.length > 0) {
      const sampleRow = data[0];
      const columns = Object.keys(sampleRow);
      console.log('Available columns in profiles table:', columns);
      console.log('Sample row structure:', sampleRow);
      return columns;
    }
    
    return [];
  } catch (err) {
    console.error('Error checking profiles table schema:', err);
    return null;
  }
};

// Function to check if users exist in both profiles and auth tables
export const checkUserExistence = async () => {
  try {
    console.log('Checking user existence in both profiles and auth tables...');
    
    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');
    
    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }
    
    if (!profiles || profiles.length === 0) {
      return { total: 0, orphaned: 0, details: [] };
    }
    
    console.log(`Found ${profiles.length} profiles`);
    
    // Check each profile against auth.users table
    const userChecks = [];
    let orphanedCount = 0;
    
    for (const profile of profiles) {
      try {
        // Try to get user from auth.users (this requires RLS to allow it)
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(profile.id);
        
        if (authError || !authUser) {
          // User doesn't exist in auth table
          userChecks.push({
            id: profile.id,
            email: profile.email,
            username: profile.username,
            existsInAuth: false,
            authError: authError?.message || 'User not found'
          });
          orphanedCount++;
        } else {
          // User exists in auth table
          userChecks.push({
            id: profile.id,
            email: profile.email,
            username: profile.username,
            existsInAuth: true,
            authUser: authUser.user
          });
        }
      } catch (err) {
        // If we can't check auth (due to permissions), assume user exists
        userChecks.push({
          id: profile.id,
          email: profile.email,
          username: profile.username,
          existsInAuth: 'unknown',
          authError: 'Could not check auth table'
        });
      }
    }
    
    console.log(`Found ${orphanedCount} orphaned profiles`);
    
    return {
      total: profiles.length,
      orphaned: orphanedCount,
      details: userChecks
    };
  } catch (err) {
    console.error('Error checking user existence:', err);
    throw err;
  }
};

// More aggressive function to identify potentially deleted users
export const isUserLikelyDeleted = (user: any): boolean => {
  if (!user || !user.email || !user.username) return true;
  
  const email = user.email.toLowerCase();
  const username = user.username.toLowerCase();
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    'deleted', 'test', 'demo', 'temp', 'fake', 'spam',
    'admin', 'root', 'system', 'guest', 'anonymous', 'user',
    'example', 'sample', 'dummy', 'placeholder'
  ];
  
  const hasSuspiciousPattern = suspiciousPatterns.some(pattern => 
    email.includes(pattern) || username.includes(pattern)
  );
  
  // Check for invalid email format
  const hasInvalidEmail = !email.includes('@') || !email.includes('.');
  
  // Check for unreasonable username length
  const hasUnreasonableUsername = username.length < 2 || username.length > 30;
  
  // Check for generic usernames
  const genericUsernames = ['user', 'test', 'demo', 'guest', 'admin', 'anonymous'];
  const hasGenericUsername = genericUsernames.includes(username);
  
  // Check for email-like usernames (suspicious)
  const hasEmailLikeUsername = username.includes('@') || username.includes('.');
  
  // Check for common test patterns
  const hasTestPattern = email.includes('test') || 
                        email.includes('example') || 
                        email.includes('demo') ||
                        username.includes('test') || 
                        username.includes('example') || 
                        username.includes('demo');
  
  // Check for suspicious email domains
  const suspiciousDomains = ['test.com', 'example.com', 'demo.com', 'fake.com', 'spam.com'];
  const hasSuspiciousDomain = suspiciousDomains.some(domain => email.endsWith(domain));
  
  return hasSuspiciousPattern || hasInvalidEmail || hasUnreasonableUsername || 
         hasGenericUsername || hasEmailLikeUsername || hasTestPattern || hasSuspiciousDomain;
};

// Function to clean up orphaned profiles (profiles without auth users)
export const cleanupOrphanedProfiles = async () => {
  try {
    console.log('Starting cleanup of orphaned profiles...');
    
    const userCheck = await checkUserExistence();
    
    if (userCheck.orphaned === 0) {
      console.log('No orphaned profiles found');
      return { deleted: 0, total: userCheck.total };
    }
    
    // Get orphaned profile IDs
    const orphanedProfiles = userCheck.details
      .filter(check => check.existsInAuth === false)
      .map(check => check.id);
    
    console.log(`Found ${orphanedProfiles.length} orphaned profiles to delete:`, 
      userCheck.details.filter(check => check.existsInAuth === false)
    );
    
    // Delete orphaned profiles
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .in('id', orphanedProfiles);
    
    if (deleteError) {
      throw new Error(`Failed to delete orphaned profiles: ${deleteError.message}`);
    }
    
    console.log(`Successfully deleted ${orphanedProfiles.length} orphaned profiles`);
    
    // Also clean up any orphaned friend records
    const orphanedResult = await cleanupOrphanedFriends();
    
    return { 
      deleted: orphanedProfiles.length, 
      total: userCheck.total,
      orphanedFriends: orphanedResult.deleted
    };
  } catch (err) {
    console.error('Error during orphaned profiles cleanup:', err);
    throw err;
  }
};

// Fetch all users except the current user
export async function fetchAllUsersExceptCurrent(currentUserEmail) {
  try {
    console.log('Fetching users from profiles table...');
    
    // More aggressive database-level filtering
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('email', currentUserEmail)
      .not('id', 'is', null)
      .not('email', 'is', null)
      .not('username', 'is', null)
      // Add more aggressive database-level filters
      .not('email', 'ilike', '%deleted%')
      .not('username', 'ilike', '%deleted%')
      .not('email', 'ilike', '%test%')
      .not('username', 'ilike', '%test%')
      .not('email', 'ilike', '%demo%')
      .not('username', 'ilike', '%demo%')
      .not('email', 'ilike', '%fake%')
      .not('username', 'ilike', '%fake%')
      .not('email', 'ilike', '%spam%')
      .not('username', 'ilike', '%spam%')
      .not('username', 'eq', 'user')
      .not('username', 'eq', 'admin')
      .not('username', 'eq', 'guest')
      .not('username', 'eq', 'anonymous');

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    console.log(`Fetched ${data?.length || 0} users from database after aggressive filtering`);

    // First pass: basic validation
    const validUsers = data?.filter(isUserProfileValid) || [];
    console.log(`After basic validation: ${validUsers.length} valid users`);
    
    // Second pass: aggressive filtering for deleted users
    const cleanUsers = validUsers.filter(user => !isUserLikelyDeleted(user));
    console.log(`After aggressive filtering: ${cleanUsers.length} clean users`);
    
    // Log what was filtered out for debugging
    const filteredOutUsers = validUsers.filter(user => isUserLikelyDeleted(user));
    if (filteredOutUsers.length > 0) {
      console.log('Filtered out users:', filteredOutUsers.map(u => ({
        id: u.id,
        email: u.email,
        username: u.username
      })));
    }
    
    return cleanUsers;
  } catch (err) {
    console.error('Error in fetchAllUsersExceptCurrent:', err);
    throw err;
  }
}

// Function to refresh friends list (useful for real-time updates)
export const refreshFriendsList = async (userEmail: string) => {
  try {
    const friendsData = await getFriends(userEmail);
    const friendEmails = friendsData.map(f => f.user1_email === userEmail ? f.user2_email : f.user1_email);
    
    if (friendEmails.length === 0) {
      return [];
    }

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, email, avatar_url')
      .in('email', friendEmails);

    if (error) {
      console.error('Error refreshing friends list:', error);
      return [];
    }

    return profiles || [];
  } catch (err) {
    console.error('Error refreshing friends list:', err);
    return [];
  }
};

// Function to clean up orphaned friend records
export const cleanupOrphanedFriends = async () => {
  try {
    // Get all friend records
    const { data: friends, error: friendsError } = await supabase
      .from('friends')
      .select('*');

    if (friendsError) {
      throw new Error(`Failed to fetch friends: ${friendsError.message}`);
    }

    if (!friends || friends.length === 0) {
      return { deleted: 0 };
    }

    // Get all existing profile emails
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('email');

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    const existingEmails = new Set(profiles?.map(p => p.email) || []);

    // Find orphaned friend records
    const orphanedFriends = friends.filter(friend => 
      !existingEmails.has(friend.user1_email) || !existingEmails.has(friend.user2_email)
    );

    if (orphanedFriends.length === 0) {
      return { deleted: 0 };
    }

    // Delete orphaned records
    const orphanedIds = orphanedFriends.map(f => f.id);
    const { error: deleteError } = await supabase
      .from('friends')
      .delete()
      .in('id', orphanedIds);

    if (deleteError) {
      throw new Error(`Failed to delete orphaned friends: ${deleteError.message}`);
    }

    console.log(`Cleaned up ${orphanedFriends.length} orphaned friend records`);
    return { deleted: orphanedFriends.length };
  } catch (err) {
    console.error('Error cleaning up orphaned friends:', err);
    throw err;
  }
};

// Function to remove a friend
export const removeFriend = async (userEmail: string, friendEmail: string) => {
  if (!userEmail || !friendEmail) {
    throw new FriendServiceError('Both user email and friend email are required');
  }

  try {
    // Remove both friendship records (bidirectional)
    const { error } = await supabase
      .from('friends')
      .delete()
      .or(`and(user1_email.eq.${userEmail},user2_email.eq.${friendEmail}),and(user1_email.eq.${friendEmail},user2_email.eq.${userEmail})`);

    if (error) {
      throw new FriendServiceError(`Error removing friend: ${error.message}`, error.code);
    }

    return { success: true };
  } catch (err) {
    if (err instanceof FriendServiceError) {
      throw err;
    }
    throw new FriendServiceError('Failed to remove friend');
  }
};

// Function to clean up invalid user references
export const cleanupInvalidUserReferences = async () => {
  try {
    console.log('Starting cleanup of invalid user references...');
    
    // Get all profiles to check for invalid ones
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');
    
    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }
    
    // Find invalid profiles
    const invalidProfiles = allProfiles?.filter(profile => !isUserProfileValid(profile)) || [];
    
    if (invalidProfiles.length > 0) {
      console.log(`Found ${invalidProfiles.length} invalid profiles:`, invalidProfiles);
      
      // You might want to handle these invalid profiles differently
      // For now, we'll just log them
      invalidProfiles.forEach(profile => {
        console.warn('Invalid profile found:', {
          id: profile.id,
          email: profile.email,
          username: profile.username
        });
      });
    }
    
    // Clean up orphaned friend records (this was already implemented)
    const orphanedResult = await cleanupOrphanedFriends();
    
    console.log('Cleanup completed:', {
      invalidProfiles: invalidProfiles.length,
      orphanedFriends: orphanedResult.deleted
    });
    
    return {
      invalidProfiles: invalidProfiles.length,
      orphanedFriends: orphanedResult.deleted
    };
  } catch (err) {
    console.error('Error during cleanup:', err);
    throw err;
  }
};

// Function to clean up deleted users from profiles table
export const cleanupDeletedUsers = async () => {
  try {
    console.log('Starting cleanup of deleted users...');
    
    // Get all profiles
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');
    
    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }
    
    if (!allProfiles || allProfiles.length === 0) {
      console.log('No profiles found to clean up');
      return { deleted: 0, total: 0 };
    }
    
    console.log(`Found ${allProfiles.length} total profiles`);
    
    // Use the aggressive filtering function to identify profiles to delete
    const profilesToDelete = allProfiles.filter(profile => isUserLikelyDeleted(profile));
    
    if (profilesToDelete.length === 0) {
      console.log('No profiles need to be deleted');
      return { deleted: 0, total: allProfiles.length };
    }
    
    console.log(`Found ${profilesToDelete.length} profiles to delete:`, 
      profilesToDelete.map(p => ({ id: p.id, email: p.email, username: p.username }))
    );
    
    // Delete the identified profiles
    const profileIdsToDelete = profilesToDelete.map(p => p.id);
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .in('id', profileIdsToDelete);
    
    if (deleteError) {
      throw new Error(`Failed to delete profiles: ${deleteError.message}`);
    }
    
    console.log(`Successfully deleted ${profilesToDelete.length} profiles`);
    
    // Also clean up any orphaned friend records
    const orphanedResult = await cleanupOrphanedFriends();
    
    return { 
      deleted: profilesToDelete.length, 
      total: allProfiles.length,
      orphanedFriends: orphanedResult.deleted
    };
  } catch (err) {
    console.error('Error during cleanup:', err);
    throw err;
  }
};

// Function to manually remove specific users by email or username
export const removeSpecificUsers = async (userIdentifiers: string[]) => {
  try {
    console.log('Starting manual removal of specific users...');
    
    if (!userIdentifiers || userIdentifiers.length === 0) {
      return { deleted: 0, total: 0 };
    }
    
    // Get all profiles
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');
    
    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }
    
    if (!allProfiles || allProfiles.length === 0) {
      return { deleted: 0, total: 0 };
    }
    
    // Find profiles that match any of the identifiers
    const profilesToDelete = allProfiles.filter(profile => {
      const email = profile.email?.toLowerCase() || '';
      const username = profile.username?.toLowerCase() || '';
      
      return userIdentifiers.some(identifier => {
        const lowerIdentifier = identifier.toLowerCase();
        return email.includes(lowerIdentifier) || 
               username.includes(lowerIdentifier) ||
               email === lowerIdentifier ||
               username === lowerIdentifier;
      });
    });
    
    if (profilesToDelete.length === 0) {
      console.log('No matching profiles found to delete');
      return { deleted: 0, total: allProfiles.length };
    }
    
    console.log(`Found ${profilesToDelete.length} profiles to delete:`, 
      profilesToDelete.map(p => ({ id: p.id, email: p.email, username: p.username }))
    );
    
    // Delete the identified profiles
    const profileIdsToDelete = profilesToDelete.map(p => p.id);
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .in('id', profileIdsToDelete);
    
    if (deleteError) {
      throw new Error(`Failed to delete profiles: ${deleteError.message}`);
    }
    
    console.log(`Successfully deleted ${profilesToDelete.length} profiles`);
    
    // Also clean up any orphaned friend records
    const orphanedResult = await cleanupOrphanedFriends();
    
    return { 
      deleted: profilesToDelete.length, 
      total: allProfiles.length,
      orphanedFriends: orphanedResult.deleted
    };
  } catch (err) {
    console.error('Error during manual user removal:', err);
    throw err;
  }
};