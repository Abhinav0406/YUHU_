import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { getOrCreateDirectChatByEmail } from '@/services/chatService';
import { Plus, Search, UserPlus, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

export function NewChatDialog() {
  const [email, setEmail] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('email');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch recent contacts
  const { data: recentContacts = [], isLoading: isLoadingContacts } = useQuery({
    queryKey: ['recentContacts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: chats, error } = await supabase
        .from('chat_participants')
        .select('chat_id')
        .eq('profile_id', user.id);

      if (error || !chats) return [];

      const chatIds = chats.map(c => c.chat_id);
      
      const { data: participants, error: participantsError } = await supabase
        .from('chat_participants')
        .select('profile_id')
        .in('chat_id', chatIds)
        .neq('profile_id', user.id);

      if (participantsError || !participants) return [];

      const userIds = participants.map(p => p.profile_id);
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError || !profiles) return [];

      return profiles;
    },
    enabled: !!user?.id && isOpen,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !email) return;

    setIsLoading(true);
    try {
      const chatId = await getOrCreateDirectChatByEmail(user.email, email);
      if (chatId) {
        setIsOpen(false);
        navigate(`/chat/${chatId}`);
        toast({
          title: "Chat created",
          description: "You can now start messaging with this user.",
        });
      } else {
        toast({
          title: "Error",
          description: "Could not create chat. Please check if the email is correct.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactSelect = async (contactEmail: string) => {
    if (!user?.email) return;
    
    setIsLoading(true);
    try {
      const chatId = await getOrCreateDirectChatByEmail(user.email, contactEmail);
      if (chatId) {
        setIsOpen(false);
        navigate(`/chat/${chatId}`);
        toast({
          title: "Chat created",
          description: "You can now start messaging with this user.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredContacts = recentContacts.filter(contact => 
    contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full text-yuhu-primary border-yuhu-primary/50 hover:bg-yuhu-primary/10">
          <Plus className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Start a New Chat</DialogTitle>
          <DialogDescription>
            Choose a contact or enter an email address to start chatting.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="email" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="email" className="text-sm">
              <UserPlus className="h-4 w-4 mr-2" />
              New Contact
            </TabsTrigger>
            <TabsTrigger value="recent" className="text-sm">
              <Users className="h-4 w-4 mr-2" />
              Recent Contacts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="m-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating..." : "Start Chat"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="recent" className="m-0">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search contacts..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <ScrollArea className="h-[200px]">
                <AnimatePresence>
                  {isLoadingContacts ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center space-x-4">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-[120px]" />
                            <Skeleton className="h-3 w-[80px]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredContacts.length > 0 ? (
                    <div className="space-y-2">
                      {filteredContacts.map((contact) => (
                        <motion.button
                          key={contact.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="flex items-center w-full p-2 rounded-lg hover:bg-muted/60 transition-colors"
                          onClick={() => handleContactSelect(contact.email)}
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={contact.avatar_url} />
                            <AvatarFallback>
                              {contact.full_name?.[0] || contact.username?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="ml-3 text-left">
                            <div className="font-medium">
                              {contact.full_name || contact.username}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {contact.email}
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      {searchQuery ? (
                        <p>No contacts found matching your search.</p>
                      ) : (
                        <p>No recent contacts found.</p>
                      )}
                    </div>
                  )}
                </AnimatePresence>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 