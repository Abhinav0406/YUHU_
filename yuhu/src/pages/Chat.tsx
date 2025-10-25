import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Header from '../components/Header';
import UserList from '../components/UserList';
import NotificationPermission from '../components/NotificationPermission';
import { Input } from '@/components/ui/input';
import { Search, X, RefreshCw } from 'lucide-react';
import { getFriends, getPendingRequests, fetchAllUsersExceptCurrent, respondToFriendRequest, subscribeToProfileChanges, subscribeToFriendsChanges, refreshFriendsList, removeFriend } from '../services/friendService';
import { supabase } from '@/lib/supabase';
import { getOrCreateDirectChatByEmail } from '../services/chatService';
import ChatWindow from '../components/ChatWindow';
import { useToast } from '@/hooks/use-toast';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

const Chat = () => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [search, setSearch] = useState('');
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [friendToDelete, setFriendToDelete] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isMobileChatActive, setIsMobileChatActive] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);

  const { toast } = useToast();

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      if (window.innerWidth < 768 && selectedChatId) {
        setSelectedChatId(null);
        setSelectedUser(null);
        setSidebarOpen(true);
        setIsMobileChatActive(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedChatId]);

  useEffect(() => {
    const fetchUserEmail = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data && data.user && data.user.email) {
        setUserEmail(data.user.email);
      }
    };
    fetchUserEmail();
  }, []);

  useEffect(() => {
    if (!userEmail) return;
    const fetchFriends = async () => {
      setLoading(true);
      const friendsData = await getFriends(userEmail);
      // Get the other user's email
      const friendEmails = friendsData.map(f => f.user1_email === userEmail ? f.user2_email : f.user1_email);
      // Fetch their profiles
      if (friendEmails.length > 0) {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, username, email, avatar_url')
          .in('email', friendEmails);
        if (!error && profiles) {
          setFriends(profiles);
        } else {
          setFriends([]);
        }
      } else {
        setFriends([]);
      }
      setLoading(false);
    };
    fetchFriends();
  }, [userEmail]);

  // Add real-time subscriptions for profile and friends changes
  useEffect(() => {
    if (!userEmail) return;

    // Subscribe to profile changes (including deletions)
    const profileSubscription = subscribeToProfileChanges((change) => {
      console.log('Profile change detected:', change);
      
      if (change.event === 'DELETE') {
        // Remove deleted user from friends list
        setFriends(prevFriends => 
          prevFriends.filter(friend => friend.id !== change.old.id)
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
      }
    });

    // Subscribe to friends table changes
    const friendsSubscription = subscribeToFriendsChanges((change) => {
      console.log('Friends change detected:', change);
      
      if (change.event === 'DELETE') {
        // Refresh friends list when friendship is removed
        const refreshFriends = async () => {
          const friendsData = await getFriends(userEmail);
          const friendEmails = friendsData.map(f => f.user1_email === userEmail ? f.user2_email : f.user1_email);
          if (friendEmails.length > 0) {
            const { data: profiles, error } = await supabase
              .from('profiles')
              .select('id, username, email, avatar_url')
              .in('email', friendEmails);
            if (!error && profiles) {
              setFriends(profiles);
            } else {
              setFriends([]);
            }
          } else {
            setFriends([]);
          }
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

  // Filter friends by search
  const filteredFriends = friends.filter(friend =>
    friend.username?.toLowerCase().includes(search.toLowerCase()) ||
    friend.email?.toLowerCase().includes(search.toLowerCase())
  );

  // When a user is selected, get or create the chatId
  const handleUserSelect = async (user) => {
    setLoadingChat(true);
    if (userEmail && user.email) {
      const chatId = await getOrCreateDirectChatByEmail(userEmail, user.email);
      setSelectedUser(user);
      setSelectedChatId(chatId);
      // Add to browser history when selecting a chat
      if (window.innerWidth < 768) {
        window.history.pushState({ chatId }, '');
        setIsMobileChatActive(true);
      }
    }
    setLoadingChat(false);
    setSidebarOpen(false); // Close sidebar on mobile after selecting
  };

  // Manual refresh function
  const handleRefreshFriends = async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const refreshedFriends = await refreshFriendsList(userEmail);
      setFriends(refreshedFriends);
    } catch (error) {
      console.error('Error refreshing friends:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle friend deletion
  const handleDeleteFriend = async (friend: any) => {
    setFriendToDelete(friend);
    setShowDeleteDialog(true);
  };

  // Handle search toggle
  const handleSearchToggle = () => {
    setIsSearchActive(!isSearchActive);
    if (!isSearchActive) {
      // Clear search when opening search
      setSearch('');
    }
  };

  // Confirm friend deletion
  const confirmDeleteFriend = async () => {
    if (!friendToDelete || !userEmail || !friendToDelete.email) return;
    
    try {
      await removeFriend(userEmail, friendToDelete.email);
      
      // Remove the friend from the local state
      setFriends(prevFriends => prevFriends.filter(f => f.id !== friendToDelete.id));
      
      // If the deleted friend was selected, clear the selection
      if (selectedUser?.id === friendToDelete.id) {
        setSelectedUser(null);
        setSelectedChatId(null);
        setIsMobileChatActive(false);
      }
      
      // Show success message
      toast({
        title: "Friend removed",
        description: `${friendToDelete.username || friendToDelete.email} has been removed from your friends list.`,
      });
    } catch (error) {
      console.error('Error removing friend:', error);
      toast({
        title: "Error",
        description: "Failed to remove friend. Please try again.",
        variant: "destructive",
      });
    } finally {
      setShowDeleteDialog(false);
      setFriendToDelete(null);
    }
  };


  return (
    <Layout hideFooter={isMobileChatActive}>
      <div className="flex flex-col h-screen bg-zinc-900 text-zinc-100">
        <Header 
          onSearchToggle={handleSearchToggle}
          isSearchActive={isSearchActive}
        />
        <div className="flex flex-1 min-h-0 pb-16 md:pb-0 -mt-4">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-[340px] flex-col bg-zinc-900 h-full">
          {isSearchActive && (
            <div className="bg-zinc-800 px-4 py-3 border-b border-zinc-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 h-4 w-4" />
                <Input
                  className="pl-10 pr-4 py-2 rounded-full bg-zinc-700 text-zinc-100 border-0 focus:ring-2 focus:ring-yuhu-primary placeholder-zinc-400"
                  placeholder="Search or start new chat"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}
          
          {/* Notification Permission Component */}
          <div className="px-4 py-2 bg-zinc-800/50">
            <NotificationPermission />
          </div>
          
          {/* Friends list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-zinc-400 mx-auto mb-2" />
                  <p className="text-zinc-400 text-sm">Loading friends...</p>
                </div>
              </div>
            ) : (
              <UserList 
                users={filteredFriends} 
                onUserSelect={handleUserSelect}
                onUserDelete={handleDeleteFriend}
                showDeleteButton={true}
              />
            )}
          </div>
        </aside>
        {/* Mobile Friends List - Always visible */}
        <aside className="md:hidden w-full flex flex-col bg-zinc-900">
          {isSearchActive && (
            <div className="bg-zinc-800 px-4 py-3 border-b border-zinc-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 h-4 w-4" />
                <Input
                  className="pl-10 pr-4 py-2 rounded-full bg-zinc-700 text-zinc-100 border-0 focus:ring-2 focus:ring-yuhu-primary placeholder-zinc-400"
                  placeholder="Search friends"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}
          
          {/* Notification Permission Component */}
          <div className="px-4 py-2 bg-zinc-800/50">
            <NotificationPermission />
          </div>
          
          {/* Friends list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-zinc-400 mx-auto mb-2" />
                  <p className="text-zinc-400 text-sm">Loading friends...</p>
                </div>
              </div>
            ) : (
              <UserList 
                users={filteredFriends} 
                onUserSelect={handleUserSelect}
                onUserDelete={handleDeleteFriend}
                showDeleteButton={true}
              />
            )}
          </div>
        </aside>
        {/* Chat Window */}
        <section className="flex-1 flex flex-col bg-zinc-900 hidden md:flex">
          {loadingChat ? (
            <div className="flex-1 flex items-center justify-center text-zinc-500 bg-zinc-900">
              Loading chat...
            </div>
          ) : selectedUser && selectedChatId ? (
            <ChatWindow chatId={selectedChatId} onClose={() => {}} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 bg-zinc-900 p-8">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-zinc-300">Select a friend to start chatting</h3>
                  <p className="text-sm text-zinc-500">Choose someone from the sidebar to begin your conversation</p>
                </div>
              </div>
            </div>
          )}
        </section>
        
        {/* Mobile Chat Window - Full screen when chat is selected */}
        {selectedUser && selectedChatId && (
          <div className="md:hidden fixed inset-0 z-50 bg-zinc-900">
            <ChatWindow chatId={selectedChatId} onClose={() => {
              setSelectedUser(null);
              setSelectedChatId(null);
              setIsMobileChatActive(false);
            }} />
          </div>
        )}
      </div>

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
      </div>
    </Layout>
  );
};

export default Chat;
