import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import UserList from '../components/UserList';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { getFriends } from '../services/friendService';
import { supabase } from '@/lib/supabase';
import { getOrCreateDirectChatByEmail } from '../services/chatService';
import ChatWindow from '../components/ChatWindow';

const Chat = () => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [search, setSearch] = useState('');
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');

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
    }
    setLoadingChat(false);
  };

  return (
    <Layout>
      <div className="flex h-screen bg-zinc-900 text-zinc-100">
        {/* Sidebar */}
        <aside className="w-[340px] flex flex-col border-r border-zinc-800 bg-zinc-950/95 shadow-lg">
          <div className="p-4 border-b border-zinc-800">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 h-4 w-4" />
              <Input
                className="pl-9 py-2 rounded-lg bg-zinc-900 text-zinc-100 border-zinc-700 focus:ring-yuhu-primary"
                placeholder="Search chats or users..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2">
            {loading ? (
              <div className="text-zinc-400 text-center mt-8">Loading friends...</div>
            ) : (
              <UserList users={filteredFriends} onUserSelect={handleUserSelect} />
            )}
          </div>
        </aside>
        {/* Chat Window */}
        <section className="flex-1 flex flex-col bg-zinc-900">
          {loadingChat ? (
            <div className="flex-1 flex items-center justify-center text-zinc-500 bg-zinc-900">
              Loading chat...
            </div>
          ) : selectedUser && selectedChatId ? (
            <ChatWindow chatId={selectedChatId} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 bg-zinc-900">
              Select a user to start chatting.
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default Chat;
