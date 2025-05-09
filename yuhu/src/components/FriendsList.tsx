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
import { getFriends } from '../services/friendService';

// Mock data - in a real app this would come from an API or database
const mockFriends = [
  {
    id: '1',
    name: 'Sarah Johnson',
    username: 'sarahj',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    status: 'online',
  },
  {
    id: '2',
    name: 'Michael Chen',
    username: 'mikechen',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael',
    status: 'online',
  },
  {
    id: '3',
    name: 'James Smith',
    username: 'jsmith',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
    status: 'away',
  },
  {
    id: '4',
    name: 'Priya Patel',
    username: 'ppatel',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya',
    status: 'offline',
  },
  {
    id: '5',
    name: 'Jordan Taylor',
    username: 'jtaylor',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan',
    status: 'offline',
  },
];

const mockPending = [
  {
    id: '6',
    name: 'Alex Rodriguez',
    username: 'alexr',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    type: 'incoming',
  },
  {
    id: '7',
    name: 'Taylor Wong',
    username: 'twong',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Taylor',
    type: 'outgoing',
  },
];

const mockSuggestions = [
  {
    id: '8',
    name: 'Jamie Garcia',
    username: 'jgarcia',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jamie',
    mutualFriends: 3,
  },
  {
    id: '9',
    name: 'Morgan Jones',
    username: 'mjones',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Morgan',
    mutualFriends: 2,
  },
  {
    id: '10',
    name: 'Casey Kim',
    username: 'ckim',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Casey',
    mutualFriends: 1,
  },
];

interface Friend {
  user1_email: string;
  user2_email: string;
}

const FriendsList: React.FC<{ userEmail: string; onStartChat: (friendEmail: string) => void }> = ({ userEmail, onStartChat }) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    const fetchFriends = async () => {
      const friendsList = await getFriends(userEmail);
      setFriends(friendsList);
    };

    fetchFriends();
  }, [userEmail]);

  const filteredFriends = mockFriends.filter(friend => 
    friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

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
                      key={friend.id} 
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center">
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={friend.avatar} alt={friend.name} />
                            <AvatarFallback>{friend.name[0]}</AvatarFallback>
                          </Avatar>
                          <span 
                            className={`absolute bottom-0 right-0 w-3 h-3 ${getStatusClass(friend.status)} rounded-full border-2 border-white`}
                          />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium">{friend.name}</div>
                          <div className="text-xs text-muted-foreground">@{friend.username}</div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
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
            {mockPending.length > 0 ? (
              <div className="space-y-4">
                {mockPending.map(request => (
                  <div 
                    key={request.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={request.avatar} alt={request.name} />
                        <AvatarFallback>{request.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="ml-3">
                        <div className="text-sm font-medium">{request.name}</div>
                        <div className="text-xs text-muted-foreground">@{request.username}</div>
                      </div>
                    </div>
                    
                    {request.type === 'incoming' ? (
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-red-500"
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Reject</span>
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-8 w-8 p-0 bg-yuhu-primary hover:bg-yuhu-dark"
                        >
                          <Check className="h-4 w-4" />
                          <span className="sr-only">Accept</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Request sent
                      </div>
                    )}
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
              {mockSuggestions.map(suggestion => (
                <div 
                  key={suggestion.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={suggestion.avatar} alt={suggestion.name} />
                      <AvatarFallback>{suggestion.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="ml-3">
                      <div className="text-sm font-medium">{suggestion.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {suggestion.mutualFriends} mutual friends
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="space-x-1"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Add</span>
                  </Button>
                </div>
              ))}
              
              <div className="text-center pt-3">
                <Button variant="link" className="text-yuhu-primary">
                  View More Suggestions
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default FriendsList;
