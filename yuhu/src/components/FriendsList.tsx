import { useState, useEffect } from 'react';
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
import { Search, UserPlus, Check, X } from 'lucide-react';
import { getFriends, getPendingRequests, fetchAllUsersExceptCurrent, respondToFriendRequest } from '../services/friendService';
import { supabase } from '@/lib/supabase';

const FriendsList: React.FC<{ userEmail: string; onStartChat: (friendEmail: string) => void }> = ({ userEmail, onStartChat }) => {
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch friends
  useEffect(() => {
    const fetchData = async () => {
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

  // Fetch pending requests
  useEffect(() => {
    const fetchRequests = async () => {
      const requests = await getPendingRequests(userEmail);
      // Fetch sender profiles
      const senderEmails = requests.map(r => r.sender_email);
      let profiles = [];
      if (senderEmails.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, email, avatar_url')
          .in('email', senderEmails);
        profiles = data || [];
      }
      // Attach profile to each request
      const requestsWithProfiles = requests.map(r => ({
        ...r,
        profile: profiles.find(p => p.email === r.sender_email)
      }));
      setPendingRequests(requestsWithProfiles);
    };
    fetchRequests();
  }, [userEmail]);

  // Fetch suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      // All users except current
      const allUsers = await fetchAllUsersExceptCurrent(userEmail);
      // Remove users who are already friends or have pending requests
      const friendEmails = friends.map(f => f.email);
      const pendingEmails = pendingRequests.map(r => r.sender_email);
      const suggestions = allUsers.filter(u => !friendEmails.includes(u.email) && !pendingEmails.includes(u.email));
      setSuggestions(suggestions);
    };
    fetchSuggestions();
  }, [userEmail, friends, pendingRequests]);

  const filteredFriends = friends.filter(friend => 
    friend.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Friends</CardTitle>
        <CardDescription>
          Manage your friends and connection requests
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="friends">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="friends">Friends</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          </TabsList>
          {/* Friends Tab */}
          <TabsContent value="friends">
            <div className="relative mb-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search friends..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <ScrollArea className="h-[400px] pr-4">
              {filteredFriends.length > 0 ? (
                <div className="space-y-2">
                  {filteredFriends.map(friend => (
                    <div 
                      key={friend.email} 
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={friend.avatar_url} alt={friend.username} />
                          <AvatarFallback>{friend.username?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="ml-3">
                          <div className="text-sm font-medium">{friend.username}</div>
                          <div className="text-xs text-muted-foreground">{friend.email}</div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => onStartChat(friend.email)}>
                        Message
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No friends match your search.' : 'No friends yet.'}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          {/* Requests Tab */}
          <TabsContent value="requests">
            {pendingRequests.length > 0 ? (
              <div className="space-y-4">
                {pendingRequests.map(request => (
                  <div 
                    key={request.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={request.profile?.avatar_url} alt={request.profile?.username} />
                        <AvatarFallback>{request.profile?.username?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="ml-3">
                        <div className="text-sm font-medium">{request.profile?.username}</div>
                        <div className="text-xs text-muted-foreground">{request.profile?.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-red-500"
                        onClick={async () => await respondToFriendRequest(request.id, 'rejected')}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Reject</span>
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-8 w-8 p-0 bg-yuhu-primary hover:bg-yuhu-dark"
                        onClick={async () => await respondToFriendRequest(request.id, 'accepted')}
                      >
                        <Check className="h-4 w-4" />
                        <span className="sr-only">Accept</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
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
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={suggestion.avatar_url} alt={suggestion.username} />
                      <AvatarFallback>{suggestion.username?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="ml-3">
                      <div className="text-sm font-medium">{suggestion.username}</div>
                      <div className="text-xs text-muted-foreground">{suggestion.email}</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={async () => await supabase.from('friend_requests').insert([{ sender_email: userEmail, receiver_email: suggestion.email, status: 'pending' }])}>
                    <UserPlus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              )) : (
                <div className="text-center py-8 text-muted-foreground">
                  No suggestions available
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default FriendsList;
