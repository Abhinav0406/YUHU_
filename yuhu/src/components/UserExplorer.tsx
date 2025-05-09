import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchAllUsersExceptCurrent, sendFriendRequest, getPendingRequests, respondToFriendRequest } from '../services/friendService';
import { getOrCreateDirectChatByEmail } from '../services/chatService';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { UserPlus, Check, X } from 'lucide-react';
import { useToast } from './ui/use-toast';

const UserExplorer: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Defensive check for user context
  if (user === undefined) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }
  if (!user || !user.email) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Please log in to add friends.
      </div>
    );
  }

  // All hooks and logic that depend on user go BELOW this line!
  const [tab, setTab] = useState<'add' | 'pending'>('add');
  const [users, setUsers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());
  const [responding, setResponding] = useState<string | null>(null);

  // Fetch all users except current
  useEffect(() => {
    const fetchUsers = async () => {
      if (user?.email) {
        try {
          setLoading(true);
          const fetchedUsers = await fetchAllUsersExceptCurrent(user.email);
          setUsers(fetchedUsers);
          setError(null);
        } catch (error) {
          setError('Failed to load users. Please try again later.');
        } finally {
          setLoading(false);
        }
      }
    };
    fetchUsers();
  }, [user]);

  // Fetch pending requests
  useEffect(() => {
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
  }, [user, sendingRequests, responding]);

  // Helper: check if a user has a pending outgoing request
  const isRequested = (email: string) => {
    return pendingRequests.some((req: any) => req.sender_email === user?.email && req.receiver_email === email);
  };

  // Helper: check if a user is the sender of a pending request
  const isIncoming = (req: any) => req.receiver_email === user?.email && req.status === 'pending';
  const isOutgoing = (req: any) => req.sender_email === user?.email && req.status === 'pending';

  // Add friend handler
  const handleAddFriend = async (friendEmail: string) => {
    if (!user?.email) return;
    try {
      setSendingRequests(prev => new Set(prev).add(friendEmail));
      await sendFriendRequest(user.email, friendEmail);
    } catch (error) {
      // Optionally show error
    } finally {
      setSendingRequests(prev => {
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
        const request = pendingRequests.find((req: any) => req.id === requestId);
        if (request) {
          const otherUserEmail = request.sender_email;
          
          // Create a chat with the accepted friend
          const chatId = await getOrCreateDirectChatByEmail(user.email, otherUserEmail);
          
          if (chatId) {
            // Navigate to the chat
            navigate(`/chat/${chatId}`);
            toast({
              title: "Friend request accepted",
              description: "You can now start messaging with your new friend!",
            });
          }
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setResponding(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Friends</CardTitle>
          <Tabs value={tab} onValueChange={v => setTab(v as 'add' | 'pending')} className="w-[400px]">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="add" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Add Friends
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <span className="relative">
                  Pending
                  {pendingRequests.length > 0 && (
                    <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-yuhu-primary text-[10px] text-white">
                      {pendingRequests.length}
                    </span>
                  )}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <TabsContent value="add" className="mt-0">
          {loading ? (
            <div className="text-center text-muted-foreground py-4">Loading users...</div>
          ) : error ? (
            <div className="text-center text-red-500 py-4">{error}</div>
          ) : users.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">No other users found.</div>
          ) : (
            <div className="space-y-4">
              {users.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={u.avatar} alt={u.username} />
                      <AvatarFallback>{u.username[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{u.username}</div>
                      <div className="text-sm text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddFriend(u.email)}
                    disabled={sendingRequests.has(u.email) || isRequested(u.email)}
                    className="space-x-1"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>
                      {isRequested(u.email)
                        ? 'Requested'
                        : sendingRequests.has(u.email)
                        ? 'Sending...'
                        : 'Add Friend'}
                    </span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="pending" className="mt-0">
          {pendingLoading ? (
            <div className="text-center text-muted-foreground py-4">Loading requests...</div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">No pending requests.</div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((req: any) => (
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
          )}
        </TabsContent>
      </CardContent>
    </Card>
  );
};

export default UserExplorer;
