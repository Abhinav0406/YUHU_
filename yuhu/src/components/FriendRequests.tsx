import React, { useEffect, useState } from 'react';
import { getPendingRequests, respondToFriendRequest, subscribeToFriendRequests, sendFriendRequest, getFriends, subscribeToProfileChanges, subscribeToFriendsChanges } from '../services/friendService';
import { notificationService } from '../services/notificationService';
import { supabase } from '@/lib/supabase';
import { UserCircle2, UserPlus, Loader2 } from 'lucide-react';

interface FriendRequest {
  id: string;
  sender_email: string;
  receiver_email: string;
  status: string;
  sender_avatar?: string;
}

interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
}

const FriendRequests: React.FC<{ userEmail: string }> = ({ userEmail }) => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [friends, setFriends] = useState<string[]>([]); // emails
  const [tab, setTab] = useState<'add' | 'pending'>('add');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const pendingRequests = await getPendingRequests(userEmail);
      setRequests(pendingRequests);
      const friendsData = await getFriends(userEmail);
      const friendEmails = friendsData.map(f => f.user1_email === userEmail ? f.user2_email : f.user1_email);
      setFriends(friendEmails);
      // Fetch all users from 'profiles' table except current user
      const { data: allUsers, error } = await supabase
        .from('profiles')
        .select('id, username, email, avatar_url')
        .neq('email', userEmail);
      if (!error && allUsers) {
        setUsers(allUsers);
      } else {
        setUsers([]);
      }
      setLoading(false);
      // Debug output
      console.log('DEBUG: userEmail', userEmail);
      console.log('DEBUG: allUsers', allUsers);
      console.log('DEBUG: friends', friendEmails);
      console.log('DEBUG: pendingRequests', pendingRequests);
    };
    fetchData();
    const subscription = subscribeToFriendRequests(async (newRequest) => {
      if (newRequest.receiver_email === userEmail) {
        setRequests((prev) => [...prev, newRequest]);
        
        // Show notification for new friend request
        try {
          await notificationService.showFriendRequestNotification(newRequest.sender_email);
        } catch (error) {
          console.error('Error showing friend request notification:', error);
        }
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [userEmail]);

  // Add real-time subscriptions for profile and friends changes
  useEffect(() => {
    if (!userEmail) return;

    // Subscribe to profile changes (including deletions)
    const profileSubscription = subscribeToProfileChanges((change) => {
      console.log('Profile change detected in FriendRequests:', change);
      
      if (change.event === 'DELETE') {
        // Remove deleted user from users list
        setUsers(prevUsers => 
          prevUsers.filter(user => user.id !== change.old.id)
        );
        // Remove from requests if the deleted user had a pending request
        setRequests(prevRequests => 
          prevRequests.filter(request => 
            request.sender_email !== change.old.email && 
            request.receiver_email !== change.old.email
          )
        );
      } else if (change.event === 'UPDATE') {
        // Update user profile in users list
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user.id === change.new.id 
              ? { ...user, ...change.new }
              : user
          )
        );
      }
    });

    // Subscribe to friends table changes
    const friendsSubscription = subscribeToFriendsChanges((change) => {
      console.log('Friends change detected in FriendRequests:', change);
      
      if (change.event === 'INSERT') {
        // Refresh friends list when new friendship is added
        const refreshFriends = async () => {
          const friendsData = await getFriends(userEmail);
          const friendEmails = friendsData.map(f => f.user1_email === userEmail ? f.user2_email : f.user1_email);
          setFriends(friendEmails);
        };
        refreshFriends();
      } else if (change.event === 'DELETE') {
        // Refresh friends list when friendship is removed
        const refreshFriends = async () => {
          const friendsData = await getFriends(userEmail);
          const friendEmails = friendsData.map(f => f.user1_email === userEmail ? f.user2_email : f.user1_email);
          setFriends(friendEmails);
        };
        refreshFriends();
      }
    });

    // Cleanup subscriptions
    return () => {
      profileSubscription.unsubscribe();
      friendsSubscription.unsubscribe();
    };
  }, [userEmail]);

  const handleResponse = async (requestId: string, status: 'accepted' | 'rejected') => {
    await respondToFriendRequest(requestId, status);
    setRequests((prev) => prev.filter((req) => req.id !== requestId));
    if (status === 'accepted') {
      // Refresh friends list
      const friendsData = await getFriends(userEmail);
      const friendEmails = friendsData.map(f => f.user1_email === userEmail ? f.user2_email : f.user1_email);
      setFriends(friendEmails);
    }
  };

  const handleSendRequest = async (receiverEmail: string) => {
    setSending(receiverEmail);
    try {
      await sendFriendRequest(userEmail, receiverEmail);
    } catch {}
    setSending(null);
  };

  // Filter users: not already friends, not already requested
  const requestedEmails = requests.map(r => r.sender_email === userEmail ? r.receiver_email : r.sender_email);
  const addableUsers = users.filter(u => !friends.includes(u.email) && !requestedEmails.includes(u.email));

  return (
    <div className="rounded-xl bg-zinc-900/80 shadow p-4 mb-4">
      <div className="flex gap-2 mb-3">
        <button onClick={() => setTab('add')} className={`px-3 py-1 rounded-lg text-sm font-semibold transition ${tab === 'add' ? 'bg-zinc-800 text-yuhu-primary' : 'bg-zinc-800/60 text-zinc-300'}`}>Add Friends</button>
        <button onClick={() => setTab('pending')} className={`px-3 py-1 rounded-lg text-sm font-semibold transition ${tab === 'pending' ? 'bg-zinc-800 text-yuhu-primary' : 'bg-zinc-800/60 text-zinc-300'}`}>Pending Requests</button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-6 text-zinc-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
      ) : tab === 'add' ? (
        addableUsers.length === 0 ? (
          <p className="text-zinc-500 text-sm">No users to add.</p>
        ) : (
          <ul className="space-y-3">
            {addableUsers.map((user) => (
              <li key={user.id} className="flex items-center justify-between gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="avatar" className="w-8 h-8 rounded-full border border-zinc-700" />
                  ) : (
                    <span className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-700 text-zinc-300">
                      <UserCircle2 className="w-6 h-6" />
                    </span>
                  )}
                  <span className="truncate text-zinc-100 text-sm font-medium">{user.username || user.email}</span>
                </div>
                <button
                  className="bg-yuhu-primary hover:bg-yuhu-dark text-white px-3 py-1 rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1"
                  onClick={() => handleSendRequest(user.email)}
                  disabled={!!sending}
                >
                  {sending === user.email ? <Loader2 className="animate-spin h-4 w-4" /> : <UserPlus className="h-4 w-4" />} Add
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        requests.length === 0 ? (
          <p className="text-zinc-500 text-sm">No pending friend requests.</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((request) => (
              <li key={request.id} className="flex items-center justify-between gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {request.sender_avatar ? (
                    <img src={request.sender_avatar} alt="avatar" className="w-8 h-8 rounded-full border border-zinc-700" />
                  ) : (
                    <span className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-700 text-zinc-300">
                      <UserCircle2 className="w-6 h-6" />
                    </span>
                  )}
                  <span className="truncate text-zinc-100 text-sm font-medium">{request.sender_email}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-semibold shadow-sm transition"
                    onClick={() => handleResponse(request.id, 'accepted')}
                  >
                    Accept
                  </button>
                  <button
                    className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-semibold shadow-sm transition"
                    onClick={() => handleResponse(request.id, 'rejected')}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
};

export default FriendRequests;
