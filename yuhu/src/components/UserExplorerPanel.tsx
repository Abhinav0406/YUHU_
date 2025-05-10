import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchAllUsersExceptCurrent, sendFriendRequest, getPendingRequests, respondToFriendRequest } from '../services/friendService';
import { getOrCreateDirectChatByEmail } from '../services/chatService';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { UserPlus, Check, X } from 'lucide-react';
import { useToast } from './ui/use-toast';

interface UserExplorerPanelProps {
  panel: 'add' | 'pending';
}

interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
}

interface FriendRequest {
  id: string;
  sender_email: string;
  receiver_email: string;
  status: 'pending' | 'accepted' | 'rejected';
}

interface FetchedUser {
  id: string;
  username: string;
  email: string;
  avatar_url: string;
}

const UserExplorerPanel: React.FC<UserExplorerPanelProps> = ({ panel }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());
  const [responding, setResponding] = useState<string | null>(null);

  // Fetch all users except current
  useEffect(() => {
    if (panel !== 'add') return;
    const fetchUsers = async () => {
      if (user?.email) {
        try {
          setLoading(true);
          const fetchedUsers: FetchedUser[] = await fetchAllUsersExceptCurrent(user.email);
          const mappedUsers = fetchedUsers.map((u) => ({
            id: u.id,
            username: u.username,
            email: u.email,
            avatar: u.avatar_url, // Map avatar_url to avatar
          }));
          setUsers(mappedUsers);
          setError(null);
        } catch (error) {
          setError('Failed to load users. Please try again later.');
        } finally {
          setLoading(false);
        }
      }
    };
    fetchUsers();
  }, [user, panel]);

  // Fetch pending requests
  useEffect(() => {
    if (panel !== 'pending') return;
    const fetchPending = async () => {
      if (user?.email) {
        try {
          setPendingLoading(true);
          const data = await getPendingRequests(user.email);
          setPendingRequests(data || []);
        } catch (error) {
          // ignore for now
        } finally {
          setPendingLoading(false);
        }
      }
    };
    fetchPending();
  }, [user, panel, sendingRequests, responding]);

  // Helper: check if a user has a pending outgoing request
  const isRequested = (email: string) => {
    return pendingRequests.some((req) => req.sender_email === user?.email && req.receiver_email === email);
  };

  // Helper: check if a user is the sender of a pending request
  const isIncoming = (req: FriendRequest) => req.receiver_email === user?.email && req.status === 'pending';
  const isOutgoing = (req: FriendRequest) => req.sender_email === user?.email && req.status === 'pending';

  // Add friend handler
  const handleAddFriend = async (friendEmail: string) => {
    if (!user?.email) return;
    try {
      setSendingRequests((prev) => new Set(prev).add(friendEmail));
      await sendFriendRequest(user.email, friendEmail);
    } catch (error) {
      // Optionally show error
    } finally {
      setSendingRequests((prev) => {
        const newSet = new Set(prev);
        newSet.delete(friendEmail);
        return newSet;
      });
    }
  };

  // Accept/Reject handler
  const handleRespond = async (requestId: string, status: 'accepted' | 'rejected') => {
    if (!user?.email) return;
    setResponding(requestId);
    try {
      await respondToFriendRequest(requestId, status);
      if (status === 'accepted') {
        // Find the request to get the sender's email
        const request = pendingRequests.find((req) => req.id === requestId);
        if (request) {
          const otherUserEmail = request.sender_email;
          // Create a chat with the accepted friend
          const chatId = await getOrCreateDirectChatByEmail(user.email, otherUserEmail);
          if (chatId) {
            // Navigate to the chat
            navigate(`/chat/${chatId}`);
            toast({
              title: 'Friend request accepted',
              description: 'You can now start messaging with your new friend!',
            });
          }
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setResponding(null);
    }
  };

  if (user === undefined) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }
  if (!user || !user.email) {
    return <div className="p-6 text-center text-muted-foreground">Please log in to add friends.</div>;
  }

  if (panel === 'add') {
    return loading ? (
      <div className="text-center text-muted-foreground py-4">Loading users...</div>
    ) : error ? (
      <div className="text-center text-red-500 py-4">{error}</div>
    ) : users.length === 0 ? (
      <div className="text-center text-muted-foreground py-4">No other users found.</div>
    ) : (
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-4 border rounded-lg shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => (
            <div key={u.id} className="flex flex-col items-center p-4 rounded-lg border bg-white shadow-md hover:shadow-lg transition-shadow">
              <Avatar className="h-16 w-16 mb-3">
                <AvatarImage src={u.avatar} alt={u.username} />
                <AvatarFallback>{u.username[0]}</AvatarFallback>
              </Avatar>
              <div className="text-center w-full">
                <div className="font-semibold text-lg truncate w-full" title={u.username}>{u.username}</div>
                <div className="text-sm text-muted-foreground truncate w-full" title={u.email}>{u.email}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddFriend(u.email)}
                disabled={sendingRequests.has(u.email) || isRequested(u.email)}
                className="mt-3 w-full flex items-center justify-center bg-yuhu-primary text-white hover:bg-yuhu-dark disabled:bg-gray-300 disabled:text-gray-500"
              >
                <UserPlus className="h-5 w-5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // panel === 'pending'
  return pendingLoading ? (
    <div className="text-center text-muted-foreground py-4">Loading requests...</div>
  ) : pendingRequests.length === 0 ? (
    <div className="text-center text-muted-foreground py-4">No pending requests.</div>
  ) : (
    <div className="space-y-4">
      {pendingRequests.map((req) => (
        <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{req.sender_email[0]}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">
                {isIncoming(req) ? req.sender_email : req.receiver_email}
              </div>
              <div className="text-sm text-muted-foreground">
                {isIncoming(req) ? 'Incoming' : 'Outgoing'}
              </div>
            </div>
          </div>
          {isIncoming(req) ? (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 text-red-500"
                onClick={() => handleRespond(req.id, 'rejected')}
                disabled={responding === req.id}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Reject</span>
              </Button>
              <Button
                size="sm"
                className="h-8 w-8 p-0 bg-yuhu-primary hover:bg-yuhu-dark"
                onClick={() => handleRespond(req.id, 'accepted')}
                disabled={responding === req.id}
              >
                <Check className="h-4 w-4" />
                <span className="sr-only">Accept</span>
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Requested</div>
          )}
        </div>
      ))}
    </div>
  );
};

export default UserExplorerPanel;