import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Dimensions,
  ScrollView,
  ImageBackground,
  Linking,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Audio } from 'expo-av';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import notificationService from '../services/notificationService';
import { e2eeService } from '../services/e2eeService';

const MESSAGES_PAGE_SIZE = 80;

// Helper function to decode base64 in React Native
const base64ToUint8Array = (base64: string): Uint8Array => {
  // Use global.atob if available (web), otherwise use a polyfill
  let binaryString: string;
  if (typeof atob !== 'undefined') {
    binaryString = atob(base64);
  } else {
    // React Native polyfill for atob
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    let i = 0;
    base64 = base64.replace(/[^A-Za-z0-9\+\/\=]/g, '');
    while (i < base64.length) {
      const enc1 = chars.indexOf(base64.charAt(i++));
      const enc2 = chars.indexOf(base64.charAt(i++));
      const enc3 = chars.indexOf(base64.charAt(i++));
      const enc4 = chars.indexOf(base64.charAt(i++));
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      output += String.fromCharCode(chr1);
      if (enc3 !== 64) output += String.fromCharCode(chr2);
      if (enc4 !== 64) output += String.fromCharCode(chr3);
    }
    binaryString = output;
  }
  
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Voice Message Player Component
const VoiceMessagePlayer = ({
  messageId,
  audioUrl,
  isMe,
  isPlaying,
  onPlayPause,
  duration,
}: {
  messageId: string;
  audioUrl: string;
  isMe: boolean;
  isPlaying: boolean;
  onPlayPause: () => void;
  duration?: number;
}) => {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <TouchableOpacity
      style={[styles.voicePlayerContainer, isMe && styles.voicePlayerContainerMe]}
      onPress={onPlayPause}
      activeOpacity={0.7}
    >
      <Ionicons
        name={isPlaying ? 'pause-circle' : 'play-circle'}
        size={32}
        color={isMe ? '#ffffff' : '#6C63FF'}
      />
      <View style={styles.voicePlayerInfo}>
        <View style={[styles.voiceWaveform, isPlaying && styles.voiceWaveformPlaying]} />
        <Text style={[styles.voiceDuration, isMe && styles.voiceDurationMe]}>
          {formatDuration(duration)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

type Reaction = {
  emoji: string;
  count: number;
  users: string[];
};

type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender_name?: string;
  media_url?: string;
  type?: string;
  reactions?: Reaction[];
};

// Helper to check if URL is an image
const isImageUrl = (url: string): boolean => {
  if (!url) return false;
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const lowerUrl = url.toLowerCase();
  // Check for image extensions first
  const hasImageExtension = imageExtensions.some(ext => lowerUrl.includes(ext));
  // If it has image extension, it's an image
  if (hasImageExtension) return true;
  // Check if URL explicitly mentions 'image' (but not 'chat-files' alone)
  if (lowerUrl.includes('image') && !lowerUrl.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar|mp4|mp3|wav|avi|mov)$/i)) {
    return true;
  }
  return false;
};

// Helper to check if URL is a voice/audio message
const isVoiceMessage = (url: string): boolean => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('voice-messages') || lowerUrl.includes('audio-files') || /\.(m4a|mp3|wav|ogg|webm)$/i.test(url);
};

// Helper to check if URL is a non-image file (PDF, docs, etc.)
const isFileUrl = (content: string): boolean => {
  if (!content) return false;
  const lower = content.toLowerCase();
  // First check if it's an image - if so, it's NOT a file
  if (isImageUrl(content)) return false;
  // Check if it's a voice message - if so, it's NOT a file
  if (isVoiceMessage(content)) return false;
  // Check for file extensions or chat-files bucket
  const hasFileExtension = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar|mp4|mp3|wav|avi|mov)$/i.test(content);
  const isFromChatFiles = lower.includes('chat-files');
  // If it has a file extension OR is from chat-files bucket (and not an image), it's a file
  return hasFileExtension || (isFromChatFiles && !lower.includes('image'));
};

const extractFileName = (url: string): string => {
  try {
    const withoutQuery = url.split('?')[0];
    const parts = withoutQuery.split('/');
    const last = parts[parts.length - 1] || 'File';
    return decodeURIComponent(last);
  } catch {
    return 'File';
  }
};

// Helper to extract image URLs from content
const extractImageUrls = (content: string): string[] => {
  const urls: string[] = [];
  if (!content || typeof content !== 'string') return urls;
  
  // Check if content is a JSON array of URLs
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      parsed.forEach((item: any) => {
        if (typeof item === 'string' && isImageUrl(item)) {
          urls.push(item);
        }
      });
      if (urls.length > 0) return urls;
    }
  } catch {
    // Not JSON, continue to check direct URL
  }
  
  // Check if it's a direct URL (including Supabase storage URLs)
  if (isImageUrl(content)) {
    urls.push(content);
  }
  
  // Also check for URLs in the text that might be image links
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = content.match(urlRegex);
  if (matches) {
    matches.forEach(match => {
      if (isImageUrl(match) && !urls.includes(match)) {
        urls.push(match);
      }
    });
  }
  
  return urls;
};

const formatDateLabel = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
};

export default function ChatScreen() {
  const route = useRoute();
  const { chatId, chatName } = route.params as { chatId: string; chatName: string };
  const { user } = useAuth();
  const navigation = useNavigation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const [otherUserProfile, setOtherUserProfile] = useState<{ avatar_url?: string; id?: string } | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [customModal, setCustomModal] = useState<{ visible: boolean; title: string; message: string; type?: 'error' | 'success' | 'info'; onConfirm?: () => void }>({ visible: false, title: '', message: '' });
  const [actionSheet, setActionSheet] = useState<{ visible: boolean; title: string; options: Array<{ label: string; icon?: string; onPress: () => void }> }>({ visible: false, title: '', options: [] });
  const [uploadingMessages, setUploadingMessages] = useState<Set<string>>(new Set());
  const audioRefs = useRef<Record<string, Audio.Sound>>({});
  const [isDirectChat, setIsDirectChat] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState(true);
  const isUserAtBottomRef = useRef(true);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const isSelecting = selectedMessages.size > 0;
  const [headerAvatarFailed, setHeaderAvatarFailed] = useState(false);

  useEffect(() => {
    isUserAtBottomRef.current = isUserAtBottom;
  }, [isUserAtBottom]);

  useEffect(() => {
    if (!chatId || !user?.id) return;

    const initE2EE = async () => {
      await e2eeService.initializeForUser(user.id);

      const { data: chatRow } = await supabase
        .from('chats')
        .select('type')
        .eq('id', chatId)
        .single();

      setIsDirectChat(chatRow?.type === 'direct');
    };

    initE2EE().catch((err) => {
      console.error('Failed to initialize chat encryption context:', err);
    });
  }, [chatId, user?.id]);

  // Track which chat the user is currently viewing for notification suppression
  useEffect(() => {
    if (!user || !chatId) return;

    const now = new Date().toISOString();

    supabase
      .from('profiles')
      .update({ current_chat_id: chatId, last_active_at: now })
      .eq('id', user.id)
      .then(({ error }) => {
        if (error) {
          console.error('Error updating current_chat_id on enter:', error);
        }
      });

    return () => {
      const leaveTime = new Date().toISOString();
      supabase
        .from('profiles')
        .update({ current_chat_id: null, last_active_at: leaveTime })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) {
            console.error('Error clearing current_chat_id on leave:', error);
          }
        });
    };
  }, [chatId, user?.id]);

  // Load other user's profile for direct chats
  useEffect(() => {
    if (!chatId || !user) return;

    const loadOtherUserProfile = async () => {
      try {
        // Get chat participants
        const { data: participants } = await supabase
          .from('chat_participants')
          .select('profile_id')
          .eq('chat_id', chatId)
          .neq('profile_id', user.id);

        if (participants && participants.length > 0) {
          const otherUserId = participants[0].profile_id;
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, avatar_url, username, full_name')
            .eq('id', otherUserId)
            .single();

          if (profile) {
            setOtherUserProfile(profile);
          }
        }
      } catch (error) {
        console.error('Error loading other user profile:', error);
      }
    };

    loadOtherUserProfile();
  }, [chatId, user, isDirectChat]);

  // Helper function to send push notifications to chat recipients
  const sendPushNotificationToRecipients = async (messageText: string, messageType: 'text' | 'image' | 'voice' | 'file' = 'text') => {
    if (!user || !chatId) return;

    try {
      // Get all chat participants except the sender
      const { data: participants } = await supabase
        .from('chat_participants')
        .select('profile_id')
        .eq('chat_id', chatId)
        .neq('profile_id', user.id);

      if (!participants || participants.length === 0) return;

      // Get sender's profile name
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .single();

      const senderName = senderProfile?.full_name || senderProfile?.username || 'Someone';

      // Prepare notification title and body based on message type
      let title = `New message from ${senderName}`;
      let body = 'You have a new message';

      if (messageType === 'image') {
        title = `${senderName} sent a photo`;
        body = '📷 Photo';
      } else if (messageType === 'voice') {
        title = `${senderName} sent a voice message`;
        body = '🎤 Voice message';
      } else if (messageType === 'file') {
        title = `${senderName} sent a file`;
        body = '📎 File';
      }

      // Send push notification to each recipient
      for (const participant of participants) {
        await notificationService.sendPushNotification(
          participant.profile_id,
          title,
          body,
          {
            chatId,
            chatName,
            senderName,
            type: 'message',
            messageType,
          }
        );
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
      // Don't show error to user - push notifications are best effort
    }
  };

  const buildEncryptedInsertPayload = async (plainText: string) => {
    if (!user || !chatId) {
      return {
        text: plainText,
        ciphertext: null,
        nonce: null,
        encryption_version: null,
        sender_key_id: null,
        content_type: 'text' as const,
      };
    }

    try {
      return await e2eeService.encryptDirectMessage({
        chatId,
        currentUserId: user.id,
        plaintext: plainText,
        isDirectChat,
      });
    } catch (error) {
      console.error('Encryption failed, sending legacy plaintext fallback:', error);
      return {
        text: plainText,
        ciphertext: null,
        nonce: null,
        encryption_version: null,
        sender_key_id: null,
        content_type: 'text' as const,
      };
    }
  };

  const resolveMessageText = async (msg: any): Promise<string> => {
    const fallback = msg.text || msg.content || '';
    if (!user?.id || !isDirectChat || !msg.ciphertext || !msg.nonce) {
      return fallback;
    }

    const decrypted = await e2eeService.decryptDirectMessage({
      currentUserId: user.id,
      senderUserId: msg.sender_id,
      ciphertext: msg.ciphertext,
      nonce: msg.nonce,
    });

    return decrypted ?? 'Unable to decrypt message';
  };

  const loadMessages = useCallback(async () => {
    if (!chatId || !user) return;
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PAGE_SIZE);

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    if (data && data.length > 0) {
      const ordered = [...data].reverse();
      const senderIds = Array.from(new Set(ordered.map((m: any) => m.sender_id)));
      const messageIds = ordered.map((m: any) => m.id);
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .in('id', senderIds);

      // Load reactions for all messages
      const { data: reactionsData } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', messageIds);

      const profilesMap = new Map();
      profiles?.forEach((p: any) => profilesMap.set(p.id, p));

      // Group reactions by message_id and emoji
      const reactionsMap = new Map<string, Map<string, Reaction>>();
      reactionsData?.forEach((r: any) => {
        if (!reactionsMap.has(r.message_id)) {
          reactionsMap.set(r.message_id, new Map());
        }
        const msgReactions = reactionsMap.get(r.message_id)!;
        if (!msgReactions.has(r.emoji)) {
          msgReactions.set(r.emoji, { emoji: r.emoji, count: 0, users: [] });
        }
        const reaction = msgReactions.get(r.emoji)!;
        reaction.count++;
        if (!reaction.users.includes(r.user_id)) {
          reaction.users.push(r.user_id);
        }
      });

      const formatted: Message[] = await Promise.all(ordered.map(async (msg: any) => {
        const profile = profilesMap.get(msg.sender_id);
        const text = await resolveMessageText(msg);
        const isImage = isImageUrl(text);
        const isVoice = isVoiceMessage(text);
        const messageReactions = reactionsMap.get(msg.id);
        
        return {
          id: msg.id,
          content: text,
          sender_id: msg.sender_id,
          created_at: msg.created_at,
          sender_name: profile?.full_name || profile?.username || 'Unknown',
          media_url: (isImage || isVoice) ? text : undefined,
          type: isVoice ? 'voice' : isImage ? 'image' : undefined,
          reactions: messageReactions ? Array.from(messageReactions.values()) : [],
        };
      }));

      setMessages(formatted);
      // Auto-scroll to bottom only if user is already near bottom
      if (isUserAtBottomRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
    } else {
      setMessages([]);
    }
  }, [chatId, user]);

  // Use refs to store current values to avoid stale closures
  const chatIdRef = useRef(chatId);
  const userIdRef = useRef(user?.id);
  const loadMessagesRef = useRef(loadMessages);

  useEffect(() => {
    chatIdRef.current = chatId;
    userIdRef.current = user?.id;
    loadMessagesRef.current = loadMessages;
  }, [chatId, user?.id, loadMessages]);

  // Global subscription to all messages (like web version) - set up once
  useEffect(() => {
    if (!user) return;

    // Set up global real-time subscription

    // Subscribe to ALL messages (no filter) - like web version
    const globalChannel = supabase
      .channel('realtime:messages:mobile')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          // Get current chatId from ref to avoid stale closure
          const activeChatId = chatIdRef.current;
          const activeUserId = userIdRef.current;

          // Only process if this message is for the current chat
          if (!activeChatId || payload.new.chat_id !== activeChatId) {
            return;
          }

          // Don't process our own messages (they're added optimistically)
          if (payload.new.sender_id === activeUserId) {
            return;
          }

          try {
            const text = await resolveMessageText(payload.new);
            const isImage = isImageUrl(text);
            const isVoice = isVoiceMessage(text);

            // Check if message already exists (prevent duplicates)
            setMessages((prev) => {
              const exists = prev.some((msg) => msg.id === payload.new.id);
              if (exists) {
                return prev;
              }

              // Add message immediately (profile will update later)
              const newMessage: Message = {
                id: payload.new.id,
                content: text,
                sender_id: payload.new.sender_id,
                created_at: payload.new.created_at,
                sender_name: 'Loading...',
                media_url: (isImage || isVoice) ? text : undefined,
                type: isVoice ? 'voice' : isImage ? 'image' : undefined,
                reactions: [],
              };

              return [...prev, newMessage];
            });

            // Fetch profile in background and update (fire and forget)
            (async () => {
              try {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('username, full_name')
                  .eq('id', payload.new.sender_id)
                  .single();

                setMessages((current) => {
                  const index = current.findIndex((msg) => msg.id === payload.new.id);
                  if (index >= 0) {
                    const updated = [...current];
                    updated[index] = {
                      ...updated[index],
                      sender_name: profile?.full_name || profile?.username || 'Unknown',
                    };
                    return updated;
                  }
                  return current;
                });
              } catch {
                // Update to Unknown if profile fetch fails
                setMessages((current) => {
                  const index = current.findIndex((msg) => msg.id === payload.new.id);
                  if (index >= 0) {
                    const updated = [...current];
                    updated[index] = {
                      ...updated[index],
                      sender_name: 'Unknown',
                    };
                    return updated;
                  }
                  return current;
                });
              }
            })();

            // Immediate scroll for fast message display (only if user is at bottom)
            if (isUserAtBottomRef.current) {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 50);
            }
            
            // Backup reload after short delay to ensure message appears
            setTimeout(() => {
              if (chatIdRef.current === activeChatId) {
                loadMessagesRef.current();
              }
            }, 500);
          } catch (error) {
            console.error('❌ Error handling new message:', error);
            // Still add message even if profile fetch fails
            const text = await resolveMessageText(payload.new);
            const isImage = isImageUrl(text);
            const isVoice = isVoiceMessage(text);
            
            const newMessage: Message = {
              id: payload.new.id,
              content: text,
              sender_id: payload.new.sender_id,
              created_at: payload.new.created_at,
              sender_name: 'Unknown',
              media_url: (isImage || isVoice) ? text : undefined,
              type: isVoice ? 'voice' : isImage ? 'image' : undefined,
              reactions: [],
            };

            setMessages((current) => {
              const stillExists = current.some((msg) => msg.id === payload.new.id);
              if (stillExists) {
                return current;
              }
              return [...current, newMessage];
            });

            if (isUserAtBottomRef.current) {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 200);
              
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 500);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        () => {
          // Reload messages to get updated reactions for current chat
          const activeChatId = chatIdRef.current;
          if (activeChatId && userIdRef.current) {
            // Use ref to call the latest loadMessages function
            loadMessagesRef.current();
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error('❌ Global subscription error:', err);
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Global subscription error');
        }
      });

    return () => {
      globalChannel.unsubscribe();
      supabase.removeChannel(globalChannel);
    };
  }, [user?.id]); // Only re-run if user ID changes, not when chatId or loadMessages changes

  // Load messages when chatId changes
  useEffect(() => {
    if (!chatId || !user) return;
    loadMessages();
  }, [chatId, user?.id]);

  // Reload messages when screen is focused, with light polling as backup
  useFocusEffect(
    useCallback(() => {
      if (!chatId || !user) return;

      loadMessages();

      const interval = setInterval(() => {
        if (chatIdRef.current && userIdRef.current) {
          loadMessagesRef.current();
        }
      }, 2000);

      return () => {
        clearInterval(interval);
      };
    }, [chatId, user?.id, loadMessages])
  );

  // Auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Use multiple timeouts to ensure scroll happens
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 500);
    }
  }, [messages.length]); // Trigger when message count changes

  const sendMessage = async () => {
    if (!inputText.trim() || !user || sending) return;

    const text = inputText.trim();
    setSending(true);

    try {
      // Build combined text including reply prefix (so all devices see it)
      const replyPrefix =
        replyTo && replyTo.content
          ? `↩️ ${replyTo.sender_id === user.id ? 'You' : replyTo.sender_name || 'User'}: ${
              replyTo.content.length > 80
                ? `${replyTo.content.slice(0, 77).replace(/\n/g, ' ')}...`
                : replyTo.content.replace(/\n/g, ' ')
            }\n\n`
          : '';
      const combinedText = `${replyPrefix}${text}`;
      const encryptedPayload = await buildEncryptedInsertPayload(combinedText);

      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          text: encryptedPayload.text,
          ciphertext: encryptedPayload.ciphertext,
          nonce: encryptedPayload.nonce,
          encryption_version: encryptedPayload.encryption_version,
          sender_key_id: encryptedPayload.sender_key_id,
          content_type: encryptedPayload.content_type,
          status: 'sent',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!error && data) {
        const optimisticMessage: Message = {
          id: data.id,
          content: combinedText,
          sender_id: data.sender_id,
          created_at: data.created_at,
          sender_name: 'You',
          media_url: data.media_url,
          type: data.type,
          reactions: [],
        };

        // Add message optimistically, but real-time subscription will also add it
        // We prevent duplicates by checking message ID in the subscription handler
        setMessages((prev) => {
          // Check if message already exists (shouldn't happen, but just in case)
          const exists = prev.some((msg) => msg.id === data.id);
          if (exists) {
            return prev;
          }
          return [...prev, optimisticMessage];
        });
        setInputText('');
        setReplyTo(null);

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 50);

        // Send push notification to recipients
        await sendPushNotificationToRecipients(text, 'text');
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    if (isRecording) {
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setCustomModal({ visible: true, title: 'Permission Required', message: 'Please enable microphone access to send voice messages.', type: 'info' });
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording', error);
    }
  };

  const stopRecordingAndSend = async () => {
    if (!recording || !user) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        setCustomModal({ visible: true, title: 'Error', message: 'Failed to get recording URI', type: 'error' });
        return;
      }

      // Read file as base64 for React Native using legacy API
      let base64: string;
      try {
        base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (readError: any) {
        console.error('Error reading audio file:', readError);
        setCustomModal({ visible: true, title: 'Error', message: 'Failed to read audio file: ' + (readError?.message || 'Unknown error'), type: 'error' });
        return;
      }

      // Convert base64 to Uint8Array for Supabase
      const bytes = base64ToUint8Array(base64);

      const fileName = `voice-${user.id}-${Date.now()}.m4a`;

      const { data: storageData, error: storageError } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, bytes, {
          contentType: 'audio/m4a',
          upsert: false,
        });

      if (storageError) {
        console.error('Error uploading voice message:', storageError);
        setCustomModal({ visible: true, title: 'Upload Failed', message: storageError.message || 'Failed to upload voice message', type: 'error' });
        return;
      }

      if (!storageData) {
        setCustomModal({ visible: true, title: 'Upload Failed', message: 'No data returned from storage', type: 'error' });
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('voice-messages')
        .getPublicUrl(storageData.path);

      const url = publicUrlData.publicUrl;
      const encryptedPayload = await buildEncryptedInsertPayload(url);

      // Store voice URL in text field like web PWA does
      const { data: messageData, error: messageError } = await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: user.id,
        text: encryptedPayload.text,
        ciphertext: encryptedPayload.ciphertext,
        nonce: encryptedPayload.nonce,
        encryption_version: encryptedPayload.encryption_version,
        sender_key_id: encryptedPayload.sender_key_id,
        content_type: encryptedPayload.content_type,
        status: 'sent',
        created_at: new Date().toISOString(),
      }).select().single();

      if (messageError) {
        console.error('Error saving message:', messageError);
        setCustomModal({ visible: true, title: 'Error', message: 'Failed to save voice message', type: 'error' });
      } else if (messageData) {
        const optimisticMessage: Message = {
          id: messageData.id,
          content: url,
          sender_id: messageData.sender_id,
          created_at: messageData.created_at,
          sender_name: 'You',
          media_url: url, // Keep for display purposes
          type: 'voice',
        };
        setMessages((prev) => [...prev, optimisticMessage]);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 50);

        // Send push notification to recipients
        await sendPushNotificationToRecipients('', 'voice');
      }
    } catch (error: any) {
      console.error('Error stopping/uploading recording', error);
      setCustomModal({ visible: true, title: 'Error', message: error?.message || 'Failed to upload voice message', type: 'error' });
    }
  };

  const handleAttachFile = async () => {
    if (!user) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];

      if (!asset.uri) {
        setCustomModal({ visible: true, title: 'Error', message: 'No file URI found', type: 'error' });
        return;
      }

      // Create temporary loading message
      const tempId = `temp-${Date.now()}`;
      const isImage = asset.mimeType?.startsWith('image/');
      const loadingMessage: Message = {
        id: tempId,
        content: '',
        sender_id: user.id,
        created_at: new Date().toISOString(),
        sender_name: 'You',
        type: isImage ? 'image' : 'file',
      };
      
      setMessages((prev) => [...prev, loadingMessage]);
      setUploadingMessages(prev => new Set(prev).add(tempId));
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);

      // Read file as base64 for React Native using legacy API
      let base64: string;
      try {
        base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (readError: any) {
        // Remove loading message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setUploadingMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(tempId);
          return newSet;
        });
        console.error('Error reading file:', readError);
        setCustomModal({ visible: true, title: 'Error', message: 'Failed to read file: ' + (readError?.message || 'Unknown error'), type: 'error' });
        return;
      }

      // Convert base64 to Uint8Array for Supabase
      const bytes = base64ToUint8Array(base64);

      const fileExt = asset.name?.split('.').pop() || 'file';
      const fileName = `attachment-${user.id}-${Date.now()}.${fileExt}`;

      const { data: storageData, error: storageError } = await supabase.storage
        .from('chat-files')
        .upload(fileName, bytes, {
          contentType: asset.mimeType || 'application/octet-stream',
          upsert: false,
        });

      if (storageError) {
        // Remove loading message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setUploadingMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(tempId);
          return newSet;
        });
        console.error('Error uploading attachment:', storageError);
        setCustomModal({ visible: true, title: 'Upload Failed', message: storageError.message || 'Failed to upload file', type: 'error' });
        return;
      }

      if (!storageData) {
        // Remove loading message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setUploadingMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(tempId);
          return newSet;
        });
        setCustomModal({ visible: true, title: 'Upload Failed', message: 'No data returned from storage', type: 'error' });
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('chat-files')
        .getPublicUrl(storageData.path);

      const url = publicUrlData.publicUrl;

      // Store file URL in text field like web PWA does
      const messageText = url;
      const encryptedPayload = await buildEncryptedInsertPayload(messageText);
      
      const { data: messageData, error: messageError } = await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: user.id,
        text: encryptedPayload.text,
        ciphertext: encryptedPayload.ciphertext,
        nonce: encryptedPayload.nonce,
        encryption_version: encryptedPayload.encryption_version,
        sender_key_id: encryptedPayload.sender_key_id,
        content_type: encryptedPayload.content_type,
        status: 'sent',
        created_at: new Date().toISOString(),
      }).select().single();

      if (messageError) {
        // Remove loading message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setUploadingMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(tempId);
          return newSet;
        });
        console.error('Error saving message:', messageError);
        setCustomModal({ visible: true, title: 'Error', message: 'Failed to save file message', type: 'error' });
      } else if (messageData) {
        // Replace loading message with actual message
        setMessages((prev) => prev.map((m) => 
          m.id === tempId 
            ? {
                id: messageData.id,
                content: messageText,
                sender_id: messageData.sender_id,
                created_at: messageData.created_at,
                sender_name: 'You',
                media_url: url,
                type: isImage ? 'image' : 'file',
              }
            : m
        ));
        setUploadingMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(tempId);
          return newSet;
        });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 50);

        // Send push notification to recipients
        await sendPushNotificationToRecipients('', isImage ? 'image' : 'file');
      }
    } catch (error: any) {
      console.error('Error picking/uploading file', error);
      setCustomModal({ visible: true, title: 'Error', message: error?.message || 'Failed to upload file', type: 'error' });
    }
  };

  const uploadImageAndSend = async (uri: string, mimeType: string = 'image/jpeg') => {
    if (!user) return;

    try {
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const bytes = base64ToUint8Array(base64);
      const fileName = `image-${user.id}-${Date.now()}.jpg`;

      const { data: storageData, error: storageError } = await supabase.storage
        .from('chat-files')
        .upload(fileName, bytes, {
          contentType: mimeType,
          upsert: false,
        });

      if (storageError || !storageData) {
        console.error('Error uploading image:', storageError);
        setCustomModal({ visible: true, title: 'Upload Failed', message: storageError?.message || 'Failed to upload image', type: 'error' });
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('chat-files')
        .getPublicUrl(storageData.path);

      const url = publicUrlData.publicUrl;
      const encryptedPayload = await buildEncryptedInsertPayload(url);

      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          text: encryptedPayload.text,
          ciphertext: encryptedPayload.ciphertext,
          nonce: encryptedPayload.nonce,
          encryption_version: encryptedPayload.encryption_version,
          sender_key_id: encryptedPayload.sender_key_id,
          content_type: encryptedPayload.content_type,
          status: 'sent',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (messageError || !messageData) {
        console.error('Error saving image message:', messageError);
        setCustomModal({ visible: true, title: 'Error', message: 'Failed to save image message', type: 'error' });
        return;
      }

      const optimisticMessage: Message = {
        id: messageData.id,
        content: url,
        sender_id: messageData.sender_id,
        created_at: messageData.created_at,
        sender_name: 'You',
        media_url: url,
        type: 'image',
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      // When you send a voice message, force scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);

      // Send push notification to recipients
      await sendPushNotificationToRecipients('', 'image');
    } catch (error: any) {
      console.error('Error uploading/sending image', error);
      setCustomModal({ visible: true, title: 'Error', message: error?.message || 'Failed to send image', type: 'error' });
    }
  };

  const uploadMultipleImages = async (uris: string[], mimeTypes: string[] = []) => {
    if (!user || uris.length === 0) return;

    // Create temporary loading message
    const tempId = `temp-${Date.now()}`;
    const loadingMessage: Message = {
      id: tempId,
      content: '',
      sender_id: user.id,
      created_at: new Date().toISOString(),
      sender_name: 'You',
      type: uris.length > 1 ? 'multiple-images' : 'image',
    };
    
    setMessages((prev) => [...prev, loadingMessage]);
    setUploadingMessages(prev => new Set(prev).add(tempId));
      // When you start uploading a file, force scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);

    try {
      const imageUrls: string[] = [];
      
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i];
        const mimeType = mimeTypes[i] || 'image/jpeg';
        
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const bytes = base64ToUint8Array(base64);
        const fileName = `image-${user.id}-${Date.now()}-${i}.jpg`;

        const { data: storageData, error: storageError } = await supabase.storage
          .from('chat-files')
          .upload(fileName, bytes, {
            contentType: mimeType,
            upsert: false,
          });

        if (storageError || !storageData) {
          console.error('Error uploading image:', storageError);
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from('chat-files')
          .getPublicUrl(storageData.path);

        imageUrls.push(publicUrlData.publicUrl);
      }

      if (imageUrls.length === 0) {
        // Remove loading message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setUploadingMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(tempId);
          return newSet;
        });
        setCustomModal({ visible: true, title: 'Upload Failed', message: 'Failed to upload images. Please try again.', type: 'error' });
        return;
      }

      // Store as JSON array if multiple, or single URL if one
      const messageText = imageUrls.length > 1 ? JSON.stringify(imageUrls) : imageUrls[0];
      const encryptedPayload = await buildEncryptedInsertPayload(messageText);

      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          text: encryptedPayload.text,
          ciphertext: encryptedPayload.ciphertext,
          nonce: encryptedPayload.nonce,
          encryption_version: encryptedPayload.encryption_version,
          sender_key_id: encryptedPayload.sender_key_id,
          content_type: encryptedPayload.content_type,
          status: 'sent',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (messageError || !messageData) {
        // Remove loading message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setUploadingMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(tempId);
          return newSet;
        });
        console.error('Error saving image message:', messageError);
        setCustomModal({ visible: true, title: 'Error', message: 'Failed to save image message', type: 'error' });
        return;
      }

      // Replace loading message with actual message
      setMessages((prev) => prev.map((m) => 
        m.id === tempId 
          ? {
              id: messageData.id,
              content: messageText,
              sender_id: messageData.sender_id,
              created_at: messageData.created_at,
              sender_name: 'You',
              media_url: imageUrls[0],
              type: imageUrls.length > 1 ? 'multiple-images' : 'image',
            }
          : m
      ));
      setUploadingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        return newSet;
      });
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);

      // Send push notification to recipients
      await sendPushNotificationToRecipients('', 'image');
    } catch (error: any) {
      // Remove loading message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setUploadingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        return newSet;
      });
      console.error('Error uploading images:', error);
      setCustomModal({ visible: true, title: 'Error', message: error?.message || 'Failed to send images', type: 'error' });
    }
  };

  const handleCameraOrGallery = async () => {
    if (!user) return;

    try {
      const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (camStatus !== 'granted' && libStatus !== 'granted') {
        setCustomModal({ 
          visible: true, 
          title: 'Permission Needed', 
          message: 'Please allow camera or photo library access to send photos.',
          type: 'info'
        });
        return;
      }

      setActionSheet({
        visible: true,
        title: 'Send Photo',
        options: [
          {
            label: 'Camera',
            icon: 'camera',
            onPress: async () => {
              setActionSheet({ visible: false, title: '', options: [] });
              const result = await ImagePicker.launchCameraAsync({
                quality: 0.8,
                allowsEditing: false,
              });
              if (!result.canceled && result.assets && result.assets[0]?.uri) {
                await uploadMultipleImages([result.assets[0].uri], [result.assets[0].mimeType || 'image/jpeg']);
              }
            },
          },
          {
            label: 'Gallery',
            icon: 'images',
            onPress: async () => {
              setActionSheet({ visible: false, title: '', options: [] });
              const result = await ImagePicker.launchImageLibraryAsync({
                quality: 0.8,
                allowsEditing: false,
                allowsMultipleSelection: true,
                selectionLimit: 10,
              });
              if (!result.canceled && result.assets && result.assets.length > 0) {
                const uris = result.assets.map(asset => asset.uri);
                const mimeTypes = result.assets.map(asset => asset.mimeType || 'image/jpeg');
                await uploadMultipleImages(uris, mimeTypes);
              }
            },
          },
          {
            label: 'Cancel',
            icon: 'close',
            onPress: () => setActionSheet({ visible: false, title: '', options: [] }),
          },
        ],
      });
    } catch (error) {
      console.error('Error opening camera/gallery:', error);
      setCustomModal({ visible: true, title: 'Error', message: 'Failed to open camera or gallery', type: 'error' });
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) || '';
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    try {
      // Check if reaction exists
      const { data: existing } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle();

      if (existing) {
        // Remove reaction
        await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id)
          .eq('emoji', emoji);
      } else {
        // Add reaction
        await supabase.from('message_reactions').insert({
          message_id: messageId,
          user_id: user.id,
          emoji: emoji,
        });
      }

      // Reload messages to update reactions
      loadMessages();
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await supabase.from('messages').delete().eq('id', messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
      setCustomModal({ visible: true, title: 'Error', message: 'Failed to delete message', type: 'error' });
    }
  };

  const handleClearChat = async () => {
    if (!chatId || !user) return;
    
    try {
      // Delete all messages in this chat
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('chat_id', chatId);
      
      if (error) {
        throw error;
      }
      
      // Clear local messages
      setMessages([]);
      setCustomModal({ visible: true, title: 'Chat Cleared', message: 'All messages have been deleted.', type: 'success' });
    } catch (error: any) {
      console.error('Error clearing chat:', error);
      setCustomModal({ visible: true, title: 'Error', message: error?.message || 'Failed to clear chat', type: 'error' });
    }
  };

  const handleMessageLongPress = (message: Message) => {
    const isMe = message.sender_id === user?.id;

    const options = [
      { label: '👍', icon: 'thumbs-up', onPress: () => { setActionSheet({ visible: false, title: '', options: [] }); handleToggleReaction(message.id, '👍'); } },
      { label: '❤️', icon: 'heart', onPress: () => { setActionSheet({ visible: false, title: '', options: [] }); handleToggleReaction(message.id, '❤️'); } },
      { label: '😂', icon: 'happy', onPress: () => { setActionSheet({ visible: false, title: '', options: [] }); handleToggleReaction(message.id, '😂'); } },
      { label: '😮', icon: 'surprise', onPress: () => { setActionSheet({ visible: false, title: '', options: [] }); handleToggleReaction(message.id, '😮'); } },
      { label: '😢', icon: 'sad', onPress: () => { setActionSheet({ visible: false, title: '', options: [] }); handleToggleReaction(message.id, '😢'); } },
    ];

    if (isMe) {
      options.push({
        label: 'Delete',
        icon: 'trash',
        onPress: () => {
          setActionSheet({ visible: false, title: '', options: [] });
          setCustomModal({
            visible: true,
            title: 'Delete Message',
            message: 'Are you sure you want to delete this message? This action cannot be undone.',
            type: 'info',
            onConfirm: () => {
              setCustomModal({ visible: false, title: '', message: '' });
              handleDeleteMessage(message.id);
            },
          });
        },
      });
    }

    options.push({ label: 'Cancel', icon: 'close', onPress: () => setActionSheet({ visible: false, title: '', options: [] }) });

    setActionSheet({ visible: true, title: 'Message Actions', options });
  };

  const handleDownload = async (url: string) => {
    try {
      if (!url) return;

      // If it's an image, save directly to gallery
      if (isImageUrl(url)) {
        // Download image first
        const filename = extractFileName(url);
        const downloadPath = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${filename}`;

        const downloadResult = await FileSystem.downloadAsync(url, downloadPath);
        if (downloadResult.status !== 200) {
          throw new Error('Image download failed');
        }

        // Try MediaLibrary first (if permissions work)
        try {
          // Check permissions first without requesting
          const permissionResult = await MediaLibrary.getPermissionsAsync();
          
          if (permissionResult.granted) {
            // Permissions already granted, use MediaLibrary
            const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
            
            // Try to add to album (optional)
            try {
              const existingAlbum = await MediaLibrary.getAlbumAsync('Yuhu');
              if (existingAlbum) {
                await MediaLibrary.addAssetsToAlbumAsync([asset], existingAlbum, false);
              } else {
                try {
                  await MediaLibrary.createAlbumAsync('Yuhu', asset, false);
                } catch (createError) {
                  console.log('Could not create album, but image is saved');
                }
              }
            } catch (albumError) {
              console.log('Album operation failed, but image is saved');
            }

            setCustomModal({ visible: true, title: 'Saved', message: 'Image saved to your gallery.', type: 'success' });
            return;
          }
        } catch (mediaError: any) {
          // MediaLibrary failed, will use sharing fallback
          console.log('MediaLibrary not available, using sharing:', mediaError);
        }

        // Fallback to sharing (works without special permissions)
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri);
          setCustomModal({ 
            visible: true, 
            title: 'Image Ready', 
            message: 'Image downloaded. Use the share menu to save it to your gallery.',
            type: 'success' 
          });
        } else {
          setCustomModal({ 
            visible: true, 
            title: 'Download Complete', 
            message: 'Image downloaded. You can find it in your app cache.',
            type: 'success' 
          });
        }
        return;
      }

      // Otherwise treat as a generic file and download/share
      const filename = extractFileName(url);
      const downloadDir = `${FileSystem.documentDirectory}downloads/`;
      const fileUri = `${downloadDir}${filename}`;

      const dirInfo = await FileSystem.getInfoAsync(downloadDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
      }

      const downloadResult = await FileSystem.downloadAsync(url, fileUri);

      if (downloadResult.status === 200) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri);
        } else {
          setCustomModal({ visible: true, title: 'Download Complete', message: 'File downloaded successfully.', type: 'success' });
        }
      } else {
        throw new Error('Download failed');
      }
    } catch (error: any) {
      console.error('Error downloading file:', error);
      setCustomModal({ visible: true, title: 'Download Failed', message: error?.message || 'Failed to download file. Please try again.', type: 'error' });
    }
  };

  const handlePlayPauseAudio = async (messageId: string, audioUrl: string) => {
    try {
      if (playingAudioId === messageId) {
        // Stop current audio
        const sound = audioRefs.current[messageId];
        if (sound) {
          await sound.stopAsync();
          await sound.unloadAsync();
          delete audioRefs.current[messageId];
        }
        setPlayingAudioId(null);
      } else {
        // Stop any currently playing audio
        if (playingAudioId) {
          const currentSound = audioRefs.current[playingAudioId];
          if (currentSound) {
            await currentSound.stopAsync();
            await currentSound.unloadAsync();
            delete audioRefs.current[playingAudioId];
          }
        }

        // Load and play new audio
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true }
        );

        audioRefs.current[messageId] = sound;

        // Get duration
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis !== undefined && status.durationMillis !== null) {
          setAudioDurations(prev => ({
            ...prev,
            [messageId]: Math.floor(status.durationMillis! / 1000),
          }));
        }

        setPlayingAudioId(messageId);

        // Handle playback finish
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlayingAudioId(null);
            sound.unloadAsync();
            delete audioRefs.current[messageId];
          }
        });
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setCustomModal({ visible: true, title: 'Error', message: 'Failed to play audio message', type: 'error' });
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach(async (sound) => {
        try {
          await sound.unloadAsync();
        } catch (e) {
          // Ignore cleanup errors
        }
      });
    };
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => {
            if (isSelecting) {
              setSelectedMessages(new Set());
            } else {
              (navigation as any).goBack();
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name={isSelecting ? 'close' : 'chevron-back'} size={24} color="#f9fafb" />
        </TouchableOpacity>

        {!isSelecting && (
          <TouchableOpacity
            style={styles.headerProfileButton}
            onPress={() => otherUserProfile && setShowProfileModal(true)}
            activeOpacity={0.7}
          >
          {otherUserProfile?.avatar_url &&
          otherUserProfile.avatar_url.trim().length > 0 &&
          !headerAvatarFailed ? (
            <Image
              source={{ uri: otherUserProfile.avatar_url }}
              style={styles.headerAvatar}
              onError={() => setHeaderAvatarFailed(true)}
            />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.headerAvatarInitial}>
                {(chatName || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          </TouchableOpacity>
        )}

        <Text style={styles.headerTitle} numberOfLines={1}>
          {isSelecting ? `${selectedMessages.size} selected` : chatName}
        </Text>

        {isSelecting ? (
          <TouchableOpacity
            style={styles.headerMenuButton}
            onPress={async () => {
              const ids = Array.from(selectedMessages);
              if (ids.length === 0) return;
              try {
                await supabase.from('messages').delete().in('id', ids);
                setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
                setSelectedMessages(new Set());
              } catch (error) {
                console.error('Error deleting selected messages', error);
                setCustomModal({
                  visible: true,
                  title: 'Error',
                  message: 'Failed to delete selected messages.',
                  type: 'error',
                });
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={22} color="#f97373" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.headerMenuButton}
            onPress={() => {
              setActionSheet({
                visible: true,
                title: 'Chat Options',
                options: [
                  {
                    label: 'Clear Chat',
                    icon: 'trash-outline',
                    onPress: () => {
                      setActionSheet({ visible: false, title: '', options: [] });
                      setCustomModal({
                        visible: true,
                        title: 'Clear Chat',
                        message:
                          'Are you sure you want to clear all messages in this chat? This action cannot be undone.',
                        type: 'info',
                        onConfirm: () => {
                          setCustomModal({ visible: false, title: '', message: '' });
                          handleClearChat();
                        },
                      });
                    },
                  },
                  {
                    label: 'Cancel',
                    icon: 'close',
                    onPress: () => setActionSheet({ visible: false, title: '', options: [] }),
                  },
                ],
              });
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={22} color="#e5e7eb" />
          </TouchableOpacity>
        )}
      </View>

      <ImageBackground
        source={require('../../assets/chat2.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
        imageStyle={styles.backgroundImageStyle}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          style={styles.flatList}
          onScroll={(event) => {
            const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
            const paddingToBottom = 40;
            const isBottom =
              layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
            setIsUserAtBottom(isBottom);
          }}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            // Only auto-scroll when content changes if user is at bottom
            if (isUserAtBottomRef.current) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          onLayout={() => {
            // Auto-scroll when layout changes
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          renderItem={({ item, index }) => {
          const isMe = item.sender_id === user?.id;
          const isUploading = uploadingMessages.has(item.id);
          const isVoice = item.type === 'voice' || isVoiceMessage(item.content);
          // Check for images first
          const imageUrls = isImageUrl(item.content) ? extractImageUrls(item.content) : [];
          const hasImages = imageUrls.length > 0;
          // Only check for files if it's NOT a voice message and NOT an image
          const isFile = !isVoice && !hasImages && isFileUrl(item.content);
          // Show text only if it's not voice, not images, and not a file
          const showText = !isVoice && !hasImages && !isFile && item.content && !item.content.startsWith('http');

          // Parse inline "reply" prefix if present: "↩️ Name: snippet\n\nactual text"
          let replyHeader: string | null = null;
          let replySnippet: string | null = null;
          let mainText = item.content;

          if (mainText && mainText.startsWith('↩️ ') && mainText.includes('\n\n')) {
            const [headerPart, rest] = mainText.split('\n\n', 2);
            replyHeader = headerPart.replace('↩️ ', '').trim();
            replySnippet = headerPart.replace('↩️ ', '').split(':', 2)[1]?.trim() || null;
            mainText = rest || '';
          }

          const currentDateLabel = formatDateLabel(item.created_at);
          const previousMessage = index > 0 ? messages[index - 1] : null;
          const previousDateLabel = previousMessage ? formatDateLabel(previousMessage.created_at) : null;
          const showDateHeader = !!currentDateLabel && currentDateLabel !== previousDateLabel;

          const isSelected = selectedMessages.has(item.id);

          const toggleSelection = () => {
            setSelectedMessages((prev) => {
              const next = new Set(prev);
              if (next.has(item.id)) {
                next.delete(item.id);
              } else {
                next.add(item.id);
              }
              return next;
            });
          };

          return (
            <Swipeable
              renderLeftActions={() => (
                <View style={styles.swipeReplyAction}>
                  <Ionicons name="arrow-undo-outline" size={20} color="#e5e7eb" />
                </View>
              )}
              overshootLeft={false}
              onSwipeableOpen={() => {
                if (!isSelecting) {
                  setReplyTo(item);
                }
              }}
            >
            <View>
              {showDateHeader && (
                <View style={styles.dateHeaderContainer}>
                  <View style={styles.dateHeaderLine} />
                  <Text style={styles.dateHeaderText}>{currentDateLabel}</Text>
                  <View style={styles.dateHeaderLine} />
                </View>
              )}
            <View style={[styles.messageContainer, isMe && styles.messageContainerMe]}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (isSelecting) {
                    toggleSelection();
                  }
                }}
                onLongPress={() => {
                  if (isSelecting) {
                    toggleSelection();
                  } else {
                    handleMessageLongPress(item);
                  }
                }}
              >
              <View style={[
                styles.messageBubble,
                isMe && styles.messageBubbleMe,
                isSelected && styles.messageBubbleSelected,
              ]}>
                {!isMe && item.sender_name ? (
                  <Text style={styles.senderName}>{item.sender_name}</Text>
                ) : null}
                
                {isVoice ? (
                  <VoiceMessagePlayer
                    messageId={item.id}
                    audioUrl={item.content}
                    isMe={isMe}
                    isPlaying={playingAudioId === item.id}
                    onPlayPause={() => handlePlayPauseAudio(item.id, item.content)}
                    duration={audioDurations[item.id]}
                  />
                ) : null}
                
                {(hasImages || (isUploading && (item.type === 'image' || item.type === 'multiple-images'))) ? (
                  <View style={styles.imagesContainer}>
                    {isUploading && imageUrls.length === 0 ? (
                      <View style={styles.messageImageWrapper}>
                        <View style={[styles.messageImage, styles.loadingImageContainer]}>
                          <Ionicons name="cloud-upload-outline" size={32} color="#6C63FF" />
                          <Text style={styles.loadingText}>Uploading...</Text>
                        </View>
                      </View>
                    ) : (
                      imageUrls.map((url, index) => (
                        <View key={index} style={styles.messageImageWrapper}>
                          {isUploading ? (
                            <View style={[styles.messageImage, styles.loadingImageContainer]}>
                              <Ionicons name="cloud-upload-outline" size={32} color="#6C63FF" />
                              <Text style={styles.loadingText}>Uploading...</Text>
                            </View>
                          ) : (
                            <>
                              <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={() => setSelectedImage(url)}
                              >
                                <Image
                                  source={{ uri: url }}
                                  style={styles.messageImage}
                                  resizeMode="cover"
                                  onError={(e) => {
                                    console.error('Image load error:', e.nativeEvent.error);
                                  }}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.downloadIconOverlay}
                                activeOpacity={0.7}
                                onPress={() => handleDownload(url)}
                              >
                                <Ionicons name="download-outline" size={16} color="#ffffff" />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      ))
                    )}
                  </View>
                ) : null}

                {isFile ? (
                  <View style={styles.fileBubble}>
                    {isUploading ? (
                      <View style={styles.loadingFileContainer}>
                        <Ionicons name="cloud-upload-outline" size={24} color="#6C63FF" />
                        <View style={styles.fileInfo}>
                          <Text style={styles.fileName}>Uploading...</Text>
                          <Text style={styles.fileSubText}>Please wait</Text>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.fileBubbleContent}
                        activeOpacity={0.7}
                        onPress={() => handleDownload(item.content)}
                      >
                        <Ionicons name="document-attach-outline" size={20} color="#e5e7eb" />
                        <View style={styles.fileInfo}>
                          <Text style={styles.fileName} numberOfLines={1}>
                            {extractFileName(item.content)}
                          </Text>
                          <Text style={styles.fileSubText}>Tap to download</Text>
                        </View>
                        <Ionicons name="download-outline" size={18} color="#e5e7eb" />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}
                
                {showText && mainText ? (
                  <>
                    {replyHeader && (
                      <View style={styles.bubbleReplyContainer}>
                        <View style={styles.bubbleReplyBar} />
                        <View style={styles.bubbleReplyContent}>
                          <Text style={styles.bubbleReplyTitle}>{replyHeader}</Text>
                          {replySnippet ? (
                            <Text
                              style={styles.bubbleReplySnippet}
                              numberOfLines={1}
                            >
                              {replySnippet}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    )}
                  <Text style={[styles.messageText, isMe && styles.messageTextMe, hasImages && styles.messageTextWithImage]}>
                    {mainText}
                  </Text>
                  </>
                ) : null}
                
                {item.reactions && item.reactions.length > 0 ? (
                  <View style={styles.reactionsContainer}>
                    {item.reactions.map((reaction: Reaction, idx: number) => {
                      const hasReacted = reaction.users.includes(user?.id || '');
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.reactionButton, hasReacted && styles.reactionButtonActive]}
                          onPress={() => handleToggleReaction(item.id, reaction.emoji)}
                        >
                          <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                          <Text style={[styles.reactionCount, hasReacted && styles.reactionCountActive]}>
                            {reaction.count}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
                
                <View style={styles.messageFooter}>
                  <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
                    {formatTime(item.created_at || new Date().toISOString())}
                  </Text>
                </View>
              </View>
              </TouchableOpacity>
            </View>
            </View>
            </Swipeable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#374151" />
            <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
          </View>
        }
        />
      </ImageBackground>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={styles.inputWrapper}
      >
        {replyTo && (
          <View style={styles.replyContainer}>
            <View style={styles.replyBar} />
            <View style={styles.replyContent}>
              <Text style={styles.replyTitle}>
                Replying to {replyTo.sender_id === user?.id ? 'You' : replyTo.sender_name || 'User'}
              </Text>
              {replyTo.content ? (
                <Text
                  style={styles.replySnippet}
                  numberOfLines={1}
                >
                  {replyTo.content}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.replyCloseButton}
              onPress={() => setReplyTo(null)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={16} color="#e5e7eb" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleAttachFile}
            activeOpacity={0.7}
          >
            <Ionicons name="attach" size={22} color="#e5e7eb" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleCameraOrGallery}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={22} color="#e5e7eb" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton, isRecording && styles.iconButtonRecording]}
            onPress={isRecording ? stopRecordingAndSend : startRecording}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isRecording ? 'stop-circle' : 'mic-outline'}
              size={22}
              color={isRecording ? '#ef4444' : '#e5e7eb'}
            />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#6b7280"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
          <Ionicons name="send" size={20} color="#ffffff" />
        </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Image Enlargement Modal */}
      <Modal
        visible={selectedImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <TouchableOpacity
          style={styles.imageModalContainer}
          activeOpacity={1}
          onPress={() => setSelectedImage(null)}
        >
          <TouchableOpacity
            style={styles.imageModalCloseButton}
            onPress={() => setSelectedImage(null)}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color="#ffffff" />
          </TouchableOpacity>
          <ScrollView
            style={styles.imageModalScrollView}
            contentContainerStyle={styles.imageModalContent}
            maximumZoomScale={5}
            minimumZoomScale={1}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            bouncesZoom={true}
            scrollEnabled={true}
          >
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={styles.enlargedImage}
                resizeMode="contain"
                onError={(e) => {
                  console.error('Image modal load error:', e.nativeEvent.error, selectedImage);
                }}
                onLoad={() => {
                  console.log('Image loaded successfully:', selectedImage);
                }}
              />
            )}
          </ScrollView>
        </TouchableOpacity>
      </Modal>

      {/* Profile Photo Modal */}
      <Modal
        visible={showProfileModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <TouchableOpacity
          style={styles.profileModalContainer}
          activeOpacity={1}
          onPress={() => setShowProfileModal(false)}
        >
          <TouchableOpacity
            style={styles.profileModalCloseButton}
            onPress={() => setShowProfileModal(false)}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color="#ffffff" />
          </TouchableOpacity>
          {otherUserProfile?.avatar_url && otherUserProfile.avatar_url.trim().length > 0 && (
            <Image
              source={{ uri: otherUserProfile.avatar_url }}
              style={styles.profileModalImage}
              resizeMode="contain"
            />
          )}
          </TouchableOpacity>
        </Modal>

      {/* Custom Alert Modal */}
      <Modal
        visible={customModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCustomModal({ visible: false, title: '', message: '' })}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCustomModal({ visible: false, title: '', message: '' })}
        >
          <View style={styles.customModalContainer}>
            <View style={[
              styles.customModalHeader,
              customModal.type === 'error' && styles.customModalHeaderError,
              customModal.type === 'success' && styles.customModalHeaderSuccess,
            ]}>
              <Ionicons
                name={customModal.type === 'error' ? 'close-circle' : customModal.type === 'success' ? 'checkmark-circle' : 'information-circle'}
                size={24}
                color={customModal.type === 'error' ? '#ef4444' : customModal.type === 'success' ? '#10b981' : '#6C63FF'}
              />
              <Text style={styles.customModalTitle}>{customModal.title}</Text>
            </View>
            <Text style={styles.customModalMessage}>{customModal.message}</Text>
            <View style={styles.customModalButtons}>
              {customModal.onConfirm ? (
                <>
                  <TouchableOpacity
                    style={[styles.customModalButton, styles.customModalButtonCancel]}
                    onPress={() => setCustomModal({ visible: false, title: '', message: '' })}
                  >
                    <Text style={styles.customModalButtonCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.customModalButton, styles.customModalButtonConfirm]}
                    onPress={() => {
                      customModal.onConfirm?.();
                    }}
                  >
                    <Text style={styles.customModalButtonConfirmText}>Confirm</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.customModalButton, styles.customModalButtonConfirm]}
                  onPress={() => setCustomModal({ visible: false, title: '', message: '' })}
                >
                  <Text style={styles.customModalButtonConfirmText}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Custom Action Sheet */}
      <Modal
        visible={actionSheet.visible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActionSheet({ visible: false, title: '', options: [] })}
      >
        <TouchableOpacity
          style={styles.actionSheetOverlay}
          activeOpacity={1}
          onPress={() => setActionSheet({ visible: false, title: '', options: [] })}
        >
          <View style={styles.actionSheetContainer}>
            {actionSheet.title ? (
              <Text style={styles.actionSheetTitle}>{actionSheet.title}</Text>
            ) : null}
            {actionSheet.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.actionSheetOption,
                  index === actionSheet.options.length - 1 && styles.actionSheetOptionLast,
                  option.label === 'Cancel' && styles.actionSheetOptionCancel,
                ]}
                onPress={option.onPress}
                activeOpacity={0.7}
              >
                {option.icon && (
                  <Ionicons
                    name={option.icon as any}
                    size={20}
                    color={option.label === 'Cancel' ? '#ef4444' : '#e5e7eb'}
                    style={styles.actionSheetIcon}
                  />
                )}
                <Text style={[
                  styles.actionSheetOptionText,
                  option.label === 'Cancel' && styles.actionSheetOptionCancelText,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.84)',
    borderBottomWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  headerBackButton: {
    marginRight: 8,
    padding: 4,
  },
  headerProfileButton: {
    marginRight: 12,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarInitial: {
    color: '#f9fafb',
    fontSize: 16,
    fontWeight: '700',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#f9fafb',
  },
  headerMenuButton: {
    padding: 8,
    marginLeft: 8,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  messageContainerMe: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    backgroundColor: '#27272a',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomLeftRadius: 4,
  },
  messageBubbleMe: {
    backgroundColor: '#6C63FF',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  messageBubbleSelected: {
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C63FF',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#e5e7eb',
    lineHeight: 20,
  },
  messageTextMe: {
    color: '#ffffff',
  },
  messageTextWithImage: {
    marginTop: 8,
  },
  imagesContainer: {
    marginBottom: 8,
    gap: 6,
  },
  bubbleReplyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
  },
  bubbleReplyBar: {
    width: 3,
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#6366f1',
    marginRight: 6,
  },
  bubbleReplyContent: {
    flex: 1,
  },
  bubbleReplyTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 1,
  },
  bubbleReplySnippet: {
    fontSize: 11,
    color: '#9ca3af',
  },
  messageImageWrapper: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  messageImage: {
    width: 170,
    height: 170,
    borderRadius: 12,
    backgroundColor: '#000000',
  },
  downloadIconOverlay: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#27272a',
    borderRadius: 20,
    minWidth: 150,
    marginBottom: 4,
  },
  voicePlayerContainerMe: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  voicePlayerInfo: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceWaveform: {
    flex: 1,
    height: 4,
    backgroundColor: '#6C63FF',
    borderRadius: 2,
    marginRight: 8,
    opacity: 0.5,
  },
  voiceWaveformPlaying: {
    opacity: 1,
  },
  voiceDuration: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  voiceDurationMe: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalScrollView: {
    flex: 1,
    width: '100%',
  },
  imageModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: Dimensions.get('window').width,
    minHeight: Dimensions.get('window').height,
  },
  enlargedImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 6,
  },
  messageTime: {
    fontSize: 11,
    color: '#9ca3af',
  },
  messageTimeMe: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.3)',
  },
  reactionButtonActive: {
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
    borderColor: '#6C63FF',
  },
  reactionEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  reactionCount: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  reactionCountActive: {
    color: '#6C63FF',
    fontWeight: '600',
  },
  reactionAddButton: {
    padding: 4,
  },
  backgroundImage: {
    flex: 1,
  },
  backgroundImageStyle: {
    opacity: 1,
  },
  flatList: {
    flex: 1,
  },
  inputWrapper: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderTopWidth: 0,
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  replyBar: {
    width: 3,
    height: 32,
    borderRadius: 2,
    backgroundColor: '#6366f1',
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replyTitle: {
    fontSize: 12,
    color: '#e5e7eb',
    fontWeight: '600',
    marginBottom: 2,
  },
  replySnippet: {
    fontSize: 12,
    color: '#9ca3af',
  },
  replyCloseButton: {
    padding: 4,
    marginLeft: 8,
  },
  fileBubble: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '500',
  },
  fileSubText: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 2,
  },
  fileBubbleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3f3f46',
  },
  loadingFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6C63FF',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  iconButtonRecording: {
    backgroundColor: '#3f1d1d',
  },
  input: {
    flex: 1,
    backgroundColor: '#27272a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#f9fafb',
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#3f3f46',
    opacity: 0.5,
  },
  swipeReplyAction: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginVertical: 8,
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
  dateHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(31, 41, 55, 0.8)',
  },
  dateHeaderText: {
    marginHorizontal: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    color: '#e5e7eb',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  // Custom Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customModalContainer: {
    backgroundColor: '#27272a',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  customModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  customModalHeaderError: {
    // Error styling
  },
  customModalHeaderSuccess: {
    // Success styling
  },
  customModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f9fafb',
    flex: 1,
  },
  customModalMessage: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
    marginBottom: 20,
  },
  customModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  customModalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  customModalButtonCancel: {
    backgroundColor: '#3f3f46',
  },
  customModalButtonConfirm: {
    backgroundColor: '#6C63FF',
  },
  customModalButtonCancelText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
  },
  customModalButtonConfirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Action Sheet Styles
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: '#27272a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: '#3f3f46',
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
    padding: 20,
    paddingBottom: 10,
    textAlign: 'center',
  },
  actionSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#3f3f46',
  },
  actionSheetOptionLast: {
    borderBottomWidth: 0,
  },
  actionSheetOptionCancel: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#3f3f46',
  },
  actionSheetIcon: {
    marginRight: 12,
  },
  actionSheetOptionText: {
    fontSize: 16,
    color: '#e5e7eb',
    flex: 1,
  },
  actionSheetOptionCancelText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  profileModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModalImage: {
    width: Dimensions.get('window').width * 0.9,
    height: Dimensions.get('window').height * 0.7,
    borderRadius: 12,
  },
});

