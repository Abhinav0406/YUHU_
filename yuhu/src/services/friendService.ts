import { supabase } from '@/lib/supabase';

// Function to send a friend request
export async function sendFriendRequest(senderEmail: string, receiverEmail: string) {
  // Check if a friend request already exists
  const { data: existingRequest, error: checkError } = await supabase
    .from('friend_requests')
    .select('*')
    .or(`and(sender_email.eq.${senderEmail},receiver_email.eq.${receiverEmail}),and(sender_email.eq.${receiverEmail},receiver_email.eq.${senderEmail})`)
    .maybeSingle();

  if (checkError) {
    throw new Error(`Error checking existing friend request: ${checkError.message}`);
  }

  if (existingRequest) {
    throw new Error('A friend request already exists between these users.');
  }

  const { data, error } = await supabase
    .from('friend_requests')
    .insert([
      { sender_email: senderEmail, receiver_email: receiverEmail, status: 'pending' }
    ])
    .select();

  if (error) {
    throw new Error(`Error sending friend request: ${error.message}`);
  }

  return data;
}

// Function to view pending friend requests
export const getPendingRequests = async (userEmail: string) => {
  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('receiver_email', userEmail)
      .eq('status', 'pending');

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (err) {
    console.error('Error fetching pending requests:', err);
    throw err;
  }
};

// Function to accept or reject a friend request
export const respondToFriendRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .update({ status })
      .eq('id', requestId);

    if (error) {
      throw new Error(error.message);
    }

    if (status === 'accepted') {
      const { data: requestData, error: requestError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError) {
        throw new Error(requestError.message);
      }

      await supabase
        .from('friends')
        .insert([
          { user1_email: requestData.sender_email, user2_email: requestData.receiver_email },
          { user1_email: requestData.receiver_email, user2_email: requestData.sender_email },
        ]);
    }

    return data;
  } catch (err) {
    console.error('Error responding to friend request:', err);
    throw err;
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