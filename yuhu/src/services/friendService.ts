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