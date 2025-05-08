
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Search, Plus, Users, MessageSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getChats } from '@/services/chatService';
import { Skeleton } from '@/components/ui/skeleton';

interface ChatListProps {
  activeChatId?: string;
  onChatSelect?: (chatId: string) => void;
}

const ChatList: React.FC<ChatListProps> = ({ 
  activeChatId,
  onChatSelect
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Fetch chats using React Query
  const { 
    data: chats = [], 
    isLoading 
  } = useQuery({
    queryKey: ['chats', user?.id],
    queryFn: () => user?.id ? getChats(user.id) : [],
    enabled: !!user?.id,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Filter chats based on search and active tab
  const filteredChats = chats.filter(chat => {
    const matchesSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = 
      activeTab === 'all' || 
      (activeTab === 'direct' && chat.type === 'direct') ||
      (activeTab === 'groups' && chat.type === 'group');
    
    return matchesSearch && matchesTab;
  });

  const handleChatClick = (chatId: string) => {
    if (onChatSelect) {
      onChatSelect(chatId);
    } else {
      navigate(`/chat/${chatId}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search messages..."
            className="pl-9 bg-transparent focus-visible:ring-yuhu-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 mb-2 bg-muted/70">
            <TabsTrigger value="all" className="text-xs">
              All
            </TabsTrigger>
            <TabsTrigger value="direct" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              Direct
            </TabsTrigger>
            <TabsTrigger value="groups" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              Groups
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="m-0">
            <Button variant="outline" className="w-full mb-3 text-yuhu-primary border-yuhu-primary/50 hover:bg-yuhu-primary/10">
              <Plus className="h-4 w-4 mr-2" />
              New Message
            </Button>
          </TabsContent>
          
          <TabsContent value="direct" className="m-0">
            <Button variant="outline" className="w-full mb-3 text-yuhu-primary border-yuhu-primary/50 hover:bg-yuhu-primary/10">
              <Plus className="h-4 w-4 mr-2" />
              New Direct Message
            </Button>
          </TabsContent>
          
          <TabsContent value="groups" className="m-0">
            <Button variant="outline" className="w-full mb-3 text-yuhu-primary border-yuhu-primary/50 hover:bg-yuhu-primary/10">
              <Plus className="h-4 w-4 mr-2" />
              New Group
            </Button>
          </TabsContent>
        </Tabs>
      </div>
      
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="space-y-4 p-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[120px]" />
                  <Skeleton className="h-3 w-[150px]" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChats.length > 0 ? (
          <div className="space-y-1">
            {filteredChats.map((chat) => (
              <button
                key={chat.id}
                className={cn(
                  "flex items-center justify-between p-3 w-full rounded-lg hover:bg-muted/60 relative",
                  chat.id === activeChatId && "bg-yuhu-primary/10 hover:bg-yuhu-primary/20"
                )}
                onClick={() => handleChatClick(chat.id)}
              >
                <div className="flex items-center">
                  <div className="relative">
                    <Avatar>
                      <AvatarImage src={chat.avatar} />
                      <AvatarFallback>{chat.name[0]}</AvatarFallback>
                    </Avatar>
                    
                    {chat.type === 'direct' && chat.online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                    )}
                  </div>
                  
                  <div className="ml-3 overflow-hidden text-left">
                    <div className="font-semibold truncate">{chat.name}</div>
                    
                    {chat.lastMessage ? (
                      <p className={cn(
                        "text-xs text-muted-foreground truncate max-w-[180px]",
                        !chat.lastMessage.isRead && "text-foreground font-medium"
                      )}>
                        {chat.lastMessage.text}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No messages yet
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col items-end">
                  {chat.lastMessage && (
                    <span className="text-xs text-muted-foreground mb-1">
                      {chat.lastMessage.time}
                    </span>
                  )}
                  
                  {chat.unreadCount && chat.unreadCount > 0 && (
                    <Badge className="bg-yuhu-primary">
                      {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            {searchQuery ? (
              <p>No chats match your search.</p>
            ) : (
              <p>No chats yet. Start a new conversation!</p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ChatList;
