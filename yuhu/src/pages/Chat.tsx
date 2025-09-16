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

  const { toast } = useToast();

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      if (window.innerWidth < 768 && selectedChatId) {
        setSelectedChatId(null);
        setSelectedUser(null);
        setSidebarOpen(true);
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
    <div className="flex flex-col h-screen bg-zinc-900 text-zinc-100">
      <Header onSidebarToggle={() => setSidebarOpen(true)} />
      <div className="flex flex-1 min-h-0">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-[340px] flex-col border-r border-zinc-800 bg-zinc-950/95 shadow-lg h-full">
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <div className="relative flex-1 mr-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 h-4 w-4" />
                <Input
                  className="pl-9 py-2 rounded-lg bg-zinc-900 text-zinc-100 border-zinc-700 focus:ring-yuhu-primary"
                  placeholder="Search chats or users..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button
                onClick={handleRefreshFriends}
                disabled={loading}
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
                title="Refresh friends list"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {/* Notification Permission Component */}
            <div className="px-2">
              <NotificationPermission />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2">
            {loading ? (
              <div className="text-zinc-400 text-center mt-8">Loading friends...</div>
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
        {/* Sidebar - Mobile Drawer */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-black/60"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar overlay"
            />
            {/* Drawer */}
            <aside className="relative w-4/5 max-w-xs bg-zinc-950 border-r border-zinc-800 shadow-lg h-full flex flex-col animate-slide-in-left">
              <button
                className="absolute top-4 right-4 z-50 bg-zinc-800 p-2 rounded-full shadow-lg focus:outline-none"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <X className="h-6 w-6 text-white" />
              </button>
              <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="relative flex-1 mr-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 h-4 w-4" />
                    <Input
                      className="pl-9 py-2 rounded-lg bg-zinc-900 text-zinc-100 border-zinc-700 focus:ring-yuhu-primary"
                      placeholder="Search chats or users..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleRefreshFriends}
                    disabled={loading}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
                    title="Refresh friends list"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2">
                {loading ? (
                  <div className="text-zinc-400 text-center mt-8">Loading friends...</div>
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
          </div>
        )}
        {/* Chat Window */}
        <section className="flex-1 flex flex-col bg-zinc-900">
          {loadingChat ? (
            <div className="flex-1 flex items-center justify-center text-zinc-500 bg-zinc-900">
              Loading chat...
            </div>
          ) : selectedUser && selectedChatId ? (
            <ChatWindow chatId={selectedChatId} onClose={() => {}} />
          ) : (
            <div
              className="flex-1 flex items-center justify-center text-zinc-500 bg-zinc-900 cursor-pointer select-none"
              onClick={() => {
                if (window.innerWidth < 768) setSidebarOpen(true);
              }}
            >
            tap here to start chatting.
                         
            </div>
          )}
        </section>
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
  );
};

export default Chat;
