import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Search, Plus, Users, MessageSquare, Settings, MoreVertical } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getChats } from '@/services/chatService';
import { Skeleton } from '@/components/ui/skeleton';
import { NewChatDialog } from './NewChatDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Fetch chats using React Query
  const { 
    data: chats = [], 
    isLoading,
    refetch
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

  const handleChatOptions = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Handle chat options (mute, archive, delete, etc.)
  };

  return (
    <div className="flex flex-col h-full bg-background border-r">
      <div className="p-4 border-b">
        <div className="relative mb-4">
          <Search className={cn(
            "absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 transition-colors",
            isSearchFocused && "text-yuhu-primary"
          )} />
          <Input
            placeholder="Search messages..."
            className={cn(
              "pl-9 bg-muted/50 focus-visible:ring-yuhu-primary transition-all",
              isSearchFocused && "bg-muted"
            )}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
          />
        </div>
        
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
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
            <NewChatDialog />
          </TabsContent>
          
          <TabsContent value="direct" className="m-0">
            <NewChatDialog />
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
        <AnimatePresence>
          {isLoading ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 p-4"
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[120px]" />
                    <Skeleton className="h-3 w-[150px]" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : filteredChats.length > 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-1 p-2"
            >
              {filteredChats.map((chat) => (
                <motion.button
                  key={chat.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={cn(
                    "flex items-center justify-between p-3 w-full rounded-lg hover:bg-muted/60 relative group transition-all duration-200",
                    chat.id === activeChatId && "bg-yuhu-primary/10 hover:bg-yuhu-primary/20"
                  )}
                  onClick={() => handleChatClick(chat.id)}
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={chat.avatar} />
                        <AvatarFallback>{chat.name[0]}</AvatarFallback>
                      </Avatar>
                      
                      {chat.type === 'direct' && chat.online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                      )}
                    </div>
                    
                    <div className="ml-3 overflow-hidden text-left flex-1">
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
                  
                  <div className="flex items-center gap-2">
                    {chat.lastMessage && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {chat.lastMessage.time}
                      </span>
                    )}
                    
                    {chat.unreadCount && chat.unreadCount > 0 && (
                      <Badge className="bg-yuhu-primary">
                        {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                      </Badge>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleChatOptions(chat.id, e)}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Settings className="h-4 w-4 mr-2" />
                          Chat Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          Archive Chat
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center text-muted-foreground"
            >
              {searchQuery ? (
                <p>No chats match your search.</p>
              ) : (
                <div className="space-y-4">
                  <p>No chats yet. Start a new conversation!</p>
                  <NewChatDialog />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
};

export default ChatList;
