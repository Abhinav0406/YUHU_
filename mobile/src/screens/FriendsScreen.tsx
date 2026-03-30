import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type Friend = {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  full_name?: string;
};

type FriendRequest = {
  id: string;
  sender_email: string;
  receiver_email: string;
  status: string;
  profile?: Friend;
};

export default function FriendsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'suggestions'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [suggestions, setSuggestions] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      loadData();
    }
  }, [user?.email, activeTab]);

  // Realtime updates for friend requests and friends list
  useEffect(() => {
    if (!user?.email) return;

    const email = user.email;

    // Listen for changes to friend_requests where current user is the receiver
    const friendRequestsChannel = supabase
      .channel('friend-requests-mobile')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_email=eq.${email}`,
        },
        () => {
          // Reload pending requests when something changes
          loadFriendRequests();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Friend requests realtime subscription active (mobile)');
        }
      });

    // Listen for changes to friends table that involve current user
    const friendsChannel = supabase
      .channel('friends-mobile')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friends',
          filter: `user1_email=eq.${email},user2_email=eq.${email}`,
        },
        () => {
          // Reload friends list when friendships change
          loadFriends();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Friends realtime subscription active (mobile)');
        }
      });

    return () => {
      supabase.removeChannel(friendRequestsChannel);
      supabase.removeChannel(friendsChannel);
    };
  }, [user?.email]);

  const loadData = async () => {
    if (!user?.email) return;
    setLoading(true);

    try {
      if (activeTab === 'friends') {
        await loadFriends();
      } else if (activeTab === 'requests') {
        await loadFriendRequests();
      } else if (activeTab === 'suggestions') {
        await loadSuggestions();
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    if (!user?.email) return;

    try {
      // Get friends from friends table
      const { data: friendsData } = await supabase
        .from('friends')
        .select('*')
        .or(`user1_email.eq.${user.email},user2_email.eq.${user.email}`);

      if (friendsData) {
        const friendEmails = friendsData.map(f =>
          f.user1_email === user.email ? f.user2_email : f.user1_email
        );

        if (friendEmails.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, email, avatar_url, full_name')
            .in('email', friendEmails);

          setFriends(profiles || []);
        } else {
          setFriends([]);
        }
      }
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const loadFriendRequests = async () => {
    if (!user?.email) return;

    try {
      const { data: requests } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('receiver_email', user.email)
        .eq('status', 'pending');

      if (requests) {
        const senderEmails = requests.map(r => r.sender_email);
        if (senderEmails.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, email, avatar_url, full_name')
            .in('email', senderEmails);

          const requestsWithProfiles = requests.map(req => ({
            ...req,
            profile: profiles?.find(p => p.email === req.sender_email),
          }));

          setPendingRequests(requestsWithProfiles);
        } else {
          setPendingRequests([]);
        }
      }
    } catch (error) {
      console.error('Error loading friend requests:', error);
    }
  };

  const loadSuggestions = async () => {
    if (!user?.email) return;

    try {
      // Get all users except current user and existing friends
      const { data: friendsData } = await supabase
        .from('friends')
        .select('*')
        .or(`user1_email.eq.${user.email},user2_email.eq.${user.email}`);

      const friendEmails = friendsData?.map(f =>
        f.user1_email === user.email ? f.user2_email : f.user1_email
      ) || [];

      const { data: allUsers } = await supabase
        .from('profiles')
        .select('id, username, email, avatar_url, full_name')
        .neq('email', user.email)
        .not('email', 'in', `(${friendEmails.map(e => `"${e}"`).join(',')})`);

      setSuggestions(allUsers || []);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const handleAcceptRequest = async (requestId: string, senderEmail: string) => {
    if (!user?.email) return;

    try {
      // Update request status
      await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      // Add to friends table
      await supabase.from('friends').insert({
        user1_email: user.email,
        user2_email: senderEmail,
      });

      Alert.alert('Success', 'Friend request accepted');
      loadFriendRequests();
      loadFriends();
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Failed to accept friend request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await supabase.from('friend_requests').delete().eq('id', requestId);
      Alert.alert('Success', 'Friend request rejected');
      loadFriendRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('Error', 'Failed to reject friend request');
    }
  };

  const handleAddFriend = async (suggestionEmail: string) => {
    if (!user?.email) return;

    try {
      await supabase.from('friend_requests').insert({
        sender_email: user.email,
        receiver_email: suggestionEmail,
        status: 'pending',
      });

      Alert.alert('Success', 'Friend request sent');
      loadSuggestions();
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request');
    }
  };

  const handleRemoveFriend = async (friendId: string, friendEmail: string) => {
    if (!user?.email) return;

    Alert.alert(
      'Remove Friend',
      'Are you sure you want to remove this friend?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('friends')
                .delete()
                .or(`user1_email.eq.${user.email},user2_email.eq.${user.email}`)
                .or(`user1_email.eq.${friendEmail},user2_email.eq.${friendEmail}`);

              Alert.alert('Success', 'Friend removed');
              loadFriends();
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend');
            }
          },
        },
      ]
    );
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <TouchableOpacity style={styles.friendItem}>
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={24} color="#6C63FF" />
        </View>
      )}
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.full_name || item.username}</Text>
        <Text style={styles.friendEmail}>{item.email}</Text>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemoveFriend(item.id, item.email)}
      >
        <Ionicons name="trash-outline" size={20} color="#ef4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderRequest = ({ item }: { item: FriendRequest }) => (
    <View style={styles.requestItem}>
      {item.profile?.avatar_url ? (
        <Image source={{ uri: item.profile.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={24} color="#6C63FF" />
        </View>
      )}
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>
          {item.profile?.full_name || item.profile?.username || item.sender_email}
        </Text>
        <Text style={styles.friendEmail}>{item.sender_email}</Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptRequest(item.id, item.sender_email)}
        >
          <Ionicons name="checkmark" size={20} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => handleRejectRequest(item.id)}
        >
          <Ionicons name="close" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSuggestion = ({ item }: { item: Friend }) => (
    <View style={styles.friendItem}>
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={24} color="#6C63FF" />
        </View>
      )}
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.full_name || item.username}</Text>
        <Text style={styles.friendEmail}>{item.email}</Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => handleAddFriend(item.email)}
      >
        <Ionicons name="person-add" size={20} color="#6C63FF" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#f9fafb" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friends & Connections</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
            Requests
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'suggestions' && styles.tabActive]}
          onPress={() => setActiveTab('suggestions')}
        >
          <Text style={[styles.tabText, activeTab === 'suggestions' && styles.tabTextActive]}>
            Suggestions
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : (
        <FlatList
          data={
            activeTab === 'friends'
              ? friends
              : activeTab === 'requests'
              ? pendingRequests
              : suggestions
          }
          keyExtractor={(item) => item.id || (item as FriendRequest).id}
          renderItem={
            activeTab === 'friends'
              ? renderFriend
              : activeTab === 'requests'
              ? renderRequest
              : renderSuggestion
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#374151" />
              <Text style={styles.emptyText}>
                {activeTab === 'friends'
                  ? 'No friends yet'
                  : activeTab === 'requests'
                  ? 'No pending requests'
                  : 'No suggestions available'}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#18181b',
  },
  header: {
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#18181b',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f9fafb',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#6C63FF',
  },
  tabText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#6C63FF',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#27272a',
    borderRadius: 12,
    marginBottom: 12,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#27272a',
    borderRadius: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3f3f46',
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3f3f46',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 4,
  },
  friendEmail: {
    fontSize: 14,
    color: '#9ca3af',
  },
  removeButton: {
    padding: 8,
  },
  addButton: {
    padding: 8,
    backgroundColor: '#27272a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#6C63FF',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
});
