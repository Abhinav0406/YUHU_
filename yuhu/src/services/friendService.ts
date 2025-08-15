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

// Fetch all users except the current user
export async function fetchAllUsersExceptCurrent(currentUserEmail) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, email, avatar_url')
    .neq('email', currentUserEmail);

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return data;
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