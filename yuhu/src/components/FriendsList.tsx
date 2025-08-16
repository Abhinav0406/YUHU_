import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, UserPlus, Check, X, Trash2, ExternalLink } from 'lucide-react';
import { getFriends, getPendingRequests, fetchAllUsersExceptCurrent, respondToFriendRequest, subscribeToProfileChanges, subscribeToFriendsChanges, removeFriend, isUserProfileValid } from '../services/friendService';
import { supabase } from '@/lib/supabase';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useAuth } from '@/context/AuthContext';

const FriendsList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [friendToDelete, setFriendToDelete] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const userEmail = user?.email;

  // Fetch friends
  useEffect(() => {
    const fetchData = async () => {
      if (!userEmail) return;
      
      setLoading(true);
      // 1. Fetch friends
      const friendsList = await getFriends(userEmail);
      // 2. Fetch profiles for each friend
      const friendEmails = friendsList.map(f => f.user1_email === userEmail ? f.user2_email : f.user1_email);
      let profiles = [];
      if (friendEmails.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, email, avatar_url')
          .in('email', friendEmails);
        profiles = data || [];
      }
      setFriends(profiles);
      setLoading(false);
    };
    fetchData();
  }, [userEmail]);

  // Add real-time subscriptions for profile and friends changes
  useEffect(() => {
    if (!userEmail) return;

    // Subscribe to profile changes (including deletions)
    const profileSubscription = subscribeToProfileChanges((change) => {
      console.log('Profile change detected in FriendsList:', change);
      
      if (change.event === 'DELETE') {
        // Remove deleted user from friends list
        setFriends(prevFriends => 
          prevFriends.filter(friend => friend.id !== change.old.id)
        );
        // Also remove from suggestions if present
        setSuggestions(prevSuggestions => 
          prevSuggestions.filter(user => user.id !== change.old.id)
        );
      } else if (change.event === 'UPDATE') {
        // Update user profile in friends list
        setFriends(prevFriends => 
          prevFriends.map(friend => 
            friend.id === change.new.id 
              ? { ...friend, ...change.new }
              : friend
          )
        );
        // Update in suggestions if present
        setSuggestions(prevSuggestions => 
          prevSuggestions.map(user => 
            user.id === change.new.id 
              ? { ...user, ...change.new }
              : user
          )
        );
      }
    });

    // Subscribe to friends table changes
    const friendsSubscription = subscribeToFriendsChanges((change) => {
      console.log('Friends change detected in FriendsList:', change);
      
      if (change.event === 'DELETE') {
        // Refresh friends list when friendship is removed
        const refreshFriends = async () => {
          const friendsList = await getFriends(userEmail);
          const friendEmails = friendsList.map(f => f.user1_email === userEmail ? f.user2_email : f.user1_email);
          let profiles = [];
          if (friendEmails.length > 0) {
            const { data } = await supabase
              .from('profiles')
              .select('id, username, email, avatar_url')
              .in('email', friendEmails);
            profiles = data || [];
          }
          setFriends(profiles);
        };
        refreshFriends();
      }
    });

    return () => {
      profileSubscription?.unsubscribe();
      friendsSubscription?.unsubscribe();
    };
  }, [userEmail]);

  // Fetch pending requests
  useEffect(() => {
    const fetchPendingRequests = async () => {
      if (!userEmail) return;
      
      const requests = await getPendingRequests(userEmail);
      const requestsWithProfiles = await Promise.all(
        requests.map(async (request) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, email, avatar_url')
            .eq('email', request.sender_email)
            .single();
          return { ...request, profile };
        })
      );
      setPendingRequests(requestsWithProfiles);
    };
    fetchPendingRequests();
  }, [userEmail]);

  // Fetch suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!userEmail) return;
      
      const suggestions = await fetchAllUsersExceptCurrent(userEmail);
      setSuggestions(suggestions);
    };
    fetchSuggestions();
  }, [userEmail]);

  const handleStartChat = (friendEmail: string) => {
    // Navigate to chat with the selected friend
    navigate(`/chat/${friendEmail}`);
  };

  const handleViewProfile = (userId: string) => {
    // Navigate to the user's profile page
    navigate(`/profile/${userId}`);
  };

  const confirmDeleteFriend = async () => {
    if (!friendToDelete || !userEmail) return;
    
    try {
      await removeFriend(userEmail, friendToDelete.email);
      setFriends(prev => prev.filter(friend => friend.email !== friendToDelete.email));
      setShowDeleteDialog(false);
      setFriendToDelete(null);
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!userEmail) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Please log in to view your friends.</p>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-white">Friends & Connections</CardTitle>
        <CardDescription className="text-gray-400">
          Manage your friends and discover new connections
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800 border-gray-700">
            <TabsTrigger 
              value="friends" 
              className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-300 hover:text-white"
            >
              Friends
            </TabsTrigger>
            <TabsTrigger 
              value="requests" 
              className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-300 hover:text-white"
            >
              Requests
            </TabsTrigger>
            <TabsTrigger 
              value="suggestions" 
              className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-300 hover:text-white"
            >
              Suggestions
            </TabsTrigger>
          </TabsList>
          
          {/* Friends Tab */}
          <TabsContent value="friends">
            <div className="mb-4">
              <Input
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
              />
            </div>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300 mx-auto"></div>
              </div>
            ) : filteredFriends.length > 0 ? (
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {filteredFriends.map(friend => (
                    <div 
                      key={friend.email}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-750 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10 cursor-pointer" onClick={() => handleViewProfile(friend.id)}>
                          <AvatarImage src={friend.avatar_url} alt={friend.username} />
                          <AvatarFallback className="bg-gray-600 text-white">{friend.username?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-white cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleViewProfile(friend.id)}>
                            {friend.username}
                          </div>
                          <div className="text-xs text-gray-400">{friend.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-blue-500 border-blue-500 hover:bg-blue-500 hover:text-white"
                          onClick={() => handleViewProfile(friend.id)}
                          title="View Profile"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-green-500 border-green-500 hover:bg-green-500 hover:text-white"
                          onClick={() => handleStartChat(friend.email)}
                          title="Start Chat"
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-red-500 border-red-500 hover:bg-red-500 hover:text-white"
                          onClick={() => {
                            setFriendToDelete(friend);
                            setShowDeleteDialog(true);
                          }}
                          title="Remove Friend"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-gray-400">
                {searchQuery ? 'No friends found matching your search.' : 'No friends yet. Start adding some!'}
              </div>
            )}
          </TabsContent>
          
          {/* Requests Tab */}
          <TabsContent value="requests">
            {pendingRequests.length > 0 ? (
              <div className="space-y-4">
                {pendingRequests.map(request => (
                  <div 
                    key={request.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-700 bg-gray-800"
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10 cursor-pointer" onClick={() => handleViewProfile(request.profile?.id)}>
                        <AvatarImage src={request.profile?.avatar_url} alt={request.profile?.username} />
                        <AvatarFallback className="bg-gray-600 text-white">{request.profile?.username?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-white cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleViewProfile(request.profile?.id)}>
                          {request.profile?.username}
                        </div>
                        <div className="text-xs text-gray-400">{request.profile?.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-red-500 border-red-500 hover:bg-red-500 hover:text-white"
                        onClick={async () => await respondToFriendRequest(request.id, 'rejected')}
                        title="Reject"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-8 w-8 p-0 bg-green-500 hover:bg-green-600 text-white"
                        onClick={async () => await respondToFriendRequest(request.id, 'accepted')}
                        title="Accept"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                No pending requests
              </div>
            )}
          </TabsContent>
          
          {/* Suggestions Tab */}
          <TabsContent value="suggestions">
            <div className="space-y-3">
              {suggestions.length > 0 ? suggestions.map(suggestion => (
                <div 
                  key={suggestion.email}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10 cursor-pointer" onClick={() => handleViewProfile(suggestion.id)}>
                      <AvatarImage src={suggestion.avatar_url} alt={suggestion.username} />
                      <AvatarFallback className="bg-gray-600 text-white">{suggestion.username?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-white cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleViewProfile(suggestion.id)}>
                        {suggestion.username}
                      </div>
                      <div className="text-xs text-gray-400">{suggestion.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-blue-500 border-blue-500 hover:bg-blue-500 hover:text-white"
                      onClick={() => handleViewProfile(suggestion.id)}
                      title="View Profile"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-blue-500 border-blue-500 hover:bg-blue-500 hover:text-white"
                      onClick={async () => await supabase.from('friend_requests').insert([{ sender_email: userEmail, receiver_email: suggestion.email, status: 'pending' }])}
                    >
                      <UserPlus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-gray-400">
                  No suggestions available
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Confirmation Dialog for Friend Deletion */}
      <ConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setFriendToDelete(null);
        }}
        onConfirm={confirmDeleteFriend}
        title="Remove Friend"
        description={`Are you sure you want to remove ${friendToDelete?.username || friendToDelete?.email} from your friends list? This action cannot be undone.`}
        confirmText="Remove"
        cancelText="Cancel"
      />
    </Card>
  );
};

export default FriendsList;
