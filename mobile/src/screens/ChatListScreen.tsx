import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type Chat = {
  id: string;
  name: string;
  avatar: string;
  lastMessage?: {
    text: string;
    time: string;
    isRead: boolean;
  };
  type: 'direct' | 'group';
  unreadCount?: number;
  online?: boolean;
};

type TabType = 'all' | 'direct' | 'groups';

export default function ChatListScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<{ id: string; name: string; avatar: string } | null>(null);
  const [brokenAvatars, setBrokenAvatars] = useState<Set<string>>(new Set());

  const normalizeAvatarUrl = (url: any): string | null => {
    if (typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (trimmed === 'null' || trimmed === 'undefined') return null;
    if (!trimmed.startsWith('http')) return null;
    return trimmed;
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return 'now';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'now';

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString() || 'now';
  };

  const loadChats = async () => {
    if (!user) return;

    const { data: participations, error: participationError } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('profile_id', user.id);

    if (participationError) {
      console.error('Error loading participations', participationError);
      setChats([]);
      return;
    }

    if (!participations || participations.length === 0) {
      setChats([]);
      return;
    }

    const ids = participations.map((p: any) => p.chat_id);
    const { data: chatsData, error: chatsError } = await supabase
      .from('chats')
      .select('*')
      .in('id', ids);

    if (chatsError || !chatsData) {
      console.error('Error loading chats', chatsError);
      setChats([]);
      return;
    }

    const chatsWithMeta = await Promise.all(
      chatsData.map(async (c: any) => {
        let chatName = c.name || 'Chat';
        // Default: no avatar until we resolve a profile (for direct chats) or explicit group avatar
        let chatAvatar: string | null = null;
        let onlineStatus = false;

        if (c.type === 'direct') {
          const { data: participants } = await supabase
            .from('chat_participants')
            .select('profile_id')
            .eq('chat_id', c.id)
            .neq('profile_id', user.id);

          if (participants && participants.length > 0) {
            const otherUserId = participants[0].profile_id;
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, full_name, avatar_url, status')
              .eq('id', otherUserId)
              .single();

            if (profile) {
              chatName = profile.full_name || profile.username || chatName;
              chatAvatar = normalizeAvatarUrl(profile.avatar_url);
              onlineStatus = profile.status === 'online';
            }
          }
        }

        // For groups, allow an explicit chat avatar if present
        if (c.type === 'group' && !chatAvatar) {
          chatAvatar = normalizeAvatarUrl(c.avatar_url);
        }

        const { data: messages } = await supabase
          .from('messages')
          .select('text, created_at, sender_id, status')
          .eq('chat_id', c.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastMessage =
          messages && messages[0]
            ? {
                text: messages[0].text,
                time: formatTime(messages[0].created_at),
                isRead: messages[0].status === 'read' || messages[0].sender_id === user.id,
              }
            : undefined;

        const { count, error: countError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('chat_id', c.id)
          .neq('sender_id', user.id)
          .eq('status', 'delivered');

        const unreadCount = countError ? 0 : count || 0;

        return {
          id: c.id,
          name: chatName,
          avatar: chatAvatar || '',
          lastMessage,
          type: c.type || 'direct',
          unreadCount,
          online: onlineStatus,
        } as Chat;
      })
    );

    setChats(chatsWithMeta);
  };

  useEffect(() => {
    if (!user) return;

    loadChats();

    const subscription = supabase
      .channel('chat-list-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadChats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chats',
        },
        () => {
          loadChats();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Chat list subscription active');
        }
      });

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(subscription);
    };
  }, [user?.id]);

  const filteredChats = chats.filter((chat) => {
    const matchesSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'direct' && chat.type === 'direct') ||
      (activeTab === 'groups' && chat.type === 'group');

    return matchesSearch && matchesTab;
  });

  const handleChatPress = (chatId: string, chatName: string) => {
    (navigation as any).navigate('Chat', { chatId, chatName });
  };

  const handleDeleteChat = (chatId: string, chatName: string) => {
    Alert.alert(
      'Delete Chat',
      `Are you sure you want to delete chat with ${chatName}? This will delete all messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('messages').delete().eq('chat_id', chatId);
              await supabase.from('chat_participants').delete().eq('chat_id', chatId);
              await supabase.from('chats').delete().eq('id', chatId);

              if (user) {
                const { data: participations } = await supabase
                  .from('chat_participants')
                  .select('chat_id')
                  .eq('profile_id', user.id);

                if (participations) {
                  setChats([]);
                  setTimeout(() => {
                    // reload via useEffect
                  }, 100);
                }
              }
            } catch (error) {
              console.error('Error deleting chat:', error);
              Alert.alert('Error', 'Failed to delete chat');
            }
          },
        },
      ]
    );
  };

  return (
    <LinearGradient
      colors={['#111827', '#020617']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.headerContainer}>
        <View>
          <Text style={styles.header}>Chats</Text>
          <Text style={styles.headerSubtitle}>Stay in sync with your people</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={18}
          color={isSearchFocused ? '#a855f7' : '#6b7280'}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, isSearchFocused && styles.searchInputFocused]}
          placeholder="Search messages or people"
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
        />
      </View>

      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'all' && styles.tabActive]}
            onPress={() => setActiveTab('all')}
          >
            <Ionicons
              name="sparkles"
              size={14}
              color={activeTab === 'all' ? '#0f172a' : '#9ca3af'}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'direct' && styles.tabActive]}
            onPress={() => setActiveTab('direct')}
          >
            <Ionicons
              name="chatbubble"
              size={14}
              color={activeTab === 'direct' ? '#0f172a' : '#9ca3af'}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'direct' && styles.tabTextActive]}>Direct</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'groups' && styles.tabActive]}
            onPress={() => setActiveTab('groups')}
          >
            <Ionicons
              name="people"
              size={14}
              color={activeTab === 'groups' ? '#0f172a' : '#9ca3af'}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>Groups</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => handleChatPress(item.id, item.name)}
            onLongPress={() => handleDeleteChat(item.id, item.name)}
            activeOpacity={0.85}
          >
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={async (e) => {
                e.stopPropagation();
                if (item.type === 'direct') {
                  try {
                    const { data: participants } = await supabase
                      .from('chat_participants')
                      .select('profile_id')
                      .eq('chat_id', item.id)
                      .neq('profile_id', user?.id || '')
                      .limit(1)
                      .single();

                    if (participants) {
                      const { data: profile } = await supabase
                        .from('profiles')
                        .select('id, username, full_name, avatar_url')
                        .eq('id', participants.profile_id)
                        .single();

                      if (profile) {
                        const normalized = normalizeAvatarUrl(profile.avatar_url) || normalizeAvatarUrl(item.avatar);
                        setSelectedProfile({
                          id: profile.id,
                          name: profile.full_name || profile.username || 'Unknown',
                          avatar: normalized || '',
                        });
                      }
                    }
                  } catch (error) {
                    console.error('Error loading profile:', error);
                  }
                }
              }}
              activeOpacity={0.7}
            >
              {item.avatar && !brokenAvatars.has(item.id) ? (
                <Image
                  source={{ uri: item.avatar }}
                  style={styles.avatar}
                  onError={() => {
                    setBrokenAvatars((prev) => {
                      const next = new Set(prev);
                      next.add(item.id);
                      return next;
                    });
                  }}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>
                    {(item.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {item.type === 'direct' && item.online && <View style={styles.onlineIndicator} />}
            </TouchableOpacity>

            <View style={styles.chatInfo}>
              <View style={styles.chatHeader}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name || 'Chat'}
                </Text>
                {item.lastMessage && item.lastMessage.time ? (
                  <Text style={styles.time}>{item.lastMessage.time}</Text>
                ) : null}
              </View>

              {item.lastMessage && item.lastMessage.text ? (
                <View style={styles.messageRow}>
                  <Text
                    style={[
                      styles.lastMessage,
                      !item.lastMessage.isRead && styles.lastMessageUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {item.lastMessage.text || ''}
                  </Text>
                  {item.unreadCount && item.unreadCount > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {item.unreadCount > 99 ? '99+' : String(item.unreadCount)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.noMessage}>No messages yet</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons name="chatbubbles-outline" size={54} color="#4b5563" />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No chats found' : 'No conversations yet'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'Try a different name or keyword.'
                : 'Start a chat with a friend to see it here.'}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.newChatButton}
        onPress={() => (navigation as any).navigate('Friends')}
      >
        <LinearGradient
          colors={['#a855f7', '#6366f1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.newChatGradient}
        >
          <Ionicons name="add" size={22} color="#0f172a" />
        </LinearGradient>
      </TouchableOpacity>

      <Modal
        visible={selectedProfile !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedProfile(null)}
      >
        <TouchableOpacity
          style={styles.profileModalContainer}
          activeOpacity={1}
          onPress={() => setSelectedProfile(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.profileModalContent}
          >
            <TouchableOpacity
              style={styles.profileModalClose}
              onPress={() => setSelectedProfile(null)}
            >
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>

            {selectedProfile && (
              <>
                <Image
                  source={{ uri: selectedProfile.avatar }}
                  style={styles.profileModalImage}
                  resizeMode="contain"
                />
                <Text style={styles.profileModalName}>{selectedProfile.name}</Text>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  profileModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModalContent: {
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  profileModalClose: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  profileModalImage: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    marginBottom: 20,
  },
  profileModalName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerContainer: {
    paddingTop: 45,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  header: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f9fafb',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#9ca3af',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(75, 85, 99, 0.7)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#f9fafb',
    fontSize: 15,
    paddingVertical: 10,
  },
  searchInputFocused: {
    borderColor: '#6C63FF',
  },
  tabsContainer: {
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(55, 65, 81, 0.8)',
  },
  tabActive: {
    backgroundColor: '#e5e7eb',
    borderColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#0f172a',
    fontWeight: '600',
  },
  tabIcon: {
    marginRight: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(31, 41, 55, 0.9)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f9fafb',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#18181b',
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
    flex: 1,
  },
  time: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: 14,
    color: '#9ca3af',
    flex: 1,
  },
  lastMessageUnread: {
    color: '#e5e7eb',
    fontWeight: '500',
  },
  noMessage: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  badge: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    minWidth: 24,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 4,
  },
  emptyText: {
    marginTop: 2,
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  newChatButton: {
    position: 'absolute',
    right: 20,
    bottom: 32,
  },
  newChatGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
  },
});

