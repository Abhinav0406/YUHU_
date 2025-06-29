import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { fetchAllUsersExceptCurrent } from './friendService';

export type ChatType = 'direct' | 'group';

export interface Chat {
  id: string;
  type: ChatType;
  name: string;
  avatar: string;
  lastMessage?: {
    text: string;
    time: string;
    isRead: boolean;
  };
  online?: boolean;
  unreadCount?: number;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  time: string;
  status: 'sent' | 'delivered' | 'read';
  sender: {
    id: string;
    name: string;
    avatar: string;
  };
  isFirst?: boolean;
  isConsecutive?: boolean;
  type?: string;
  replyTo?: string;
  replyToMessage?: {
    id: string;
    text: string;
    senderId: string;
  };
}

export async function getChats(userId: string): Promise<Chat[]> {
  // Get all chats where user is a participant
  const { data: participations, error: participationError } = await supabase
    .from('chat_participants')
    .select('chat_id')
    .eq('profile_id', userId);

  if (participationError) {
    console.error('Error fetching chat participations:', participationError);
    return [];
  }

  if (!participations || participations.length === 0) {
    return [];
  }

  const chatIds = participations.map(p => p.chat_id);

  // Get chat details
  const { data: chats, error: chatError } = await supabase
    .from('chats')
    .select('*')
    .in('id', chatIds);

  if (chatError) {
    console.error('Error fetching chats:', chatError);
    return [];
  }

  // For direct chats, get the other participant's info
  const processedChats = await Promise.all(chats.map(async (chat) => {
    if (chat.type === 'direct') {
      // Get the other participant
      const { data: participants, error: participantError } = await supabase
        .from('chat_participants')
        .select('profile_id')
        .eq('chat_id', chat.id)
        .neq('profile_id', userId);

      if (participantError) {
        console.error('Error fetching other participant:', participantError);
        return null;
      }

      if (!participants || participants.length === 0) {
        return null;
      }

      const otherUserId = participants[0].profile_id;

      // Get the other user's profile
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', otherUserId)
        .single();

      if (userError) {
        console.error('Error fetching user profile:', userError);
        return null;
      }

      // Get the last message
      const { data: messages, error: messageError } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: false })
        .limit(1);

      let lastMessage = undefined;
      
      if (!messageError && messages && messages.length > 0) {
        lastMessage = {
          text: messages[0].text,
          time: new Date(messages[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
          isRead: messages[0].status === 'read' || messages[0].sender_id === userId
        };
      }

      // Count unread messages
      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chat.id)
        .eq('status', 'delivered')
        .neq('sender_id', userId);

      const unreadCount = countError ? 0 : (count || 0);

      return {
        id: chat.id,
        type: chat.type,
        name: userProfile.full_name || userProfile.username,
        avatar: userProfile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.username}`,
        online: userProfile.status === 'online',
        lastMessage,
        unreadCount
      };
    } else {
      // For group chats
      // Get the last message
      const { data: messages, error: messageError } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: false })
        .limit(1);

      let lastMessage = undefined;
      
      if (!messageError && messages && messages.length > 0) {
        lastMessage = {
          text: messages[0].text,
          time: new Date(messages[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
          isRead: messages[0].status === 'read' || messages[0].sender_id === userId
        };
      }

      // Count unread messages
      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chat.id)
        .eq('status', 'delivered')
        .neq('sender_id', userId);

      const unreadCount = countError ? 0 : (count || 0);

      return {
        id: chat.id,
        type: chat.type,
        name: chat.name || 'Group Chat',
        avatar: chat.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${chat.id}`,
        lastMessage,
        unreadCount
      };
    }
  }));

  return processedChats.filter(Boolean) as Chat[];
}

export async function getMessages(chatId: string, userId: string): Promise<Message[]> {
  // Get messages for this chat
  const { data: messagesData, error: messagesError } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (messagesError || !messagesData) {
    console.error('Error fetching messages:', messagesError);
    return [];
  }

  // Mark messages as read
  const messagesToMark = messagesData
    .filter(m => m.sender_id !== userId && m.status !== 'read')
    .map(m => m.id);

  if (messagesToMark.length > 0) {
    await supabase
      .from('messages')
      .update({ status: 'read' })
      .in('id', messagesToMark);
  }

  // Get all unique sender IDs
  const senderIds = Array.from(new Set(messagesData.map(m => m.sender_id)));

  // Fetch all senders at once
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', senderIds);

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    return [];
  }

  // Create a map of profiles for easy lookup
  const profilesMap = new Map();
  profiles?.forEach(profile => {
    profilesMap.set(profile.id, {
      id: profile.id,
      name: profile.full_name || profile.username,
      avatar: profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`
    });
  });

  // Fetch all replyTo messages in one go
  const replyToIds = messagesData.filter(m => m.replyTo).map(m => m.replyTo);
  let replyToMap = new Map();
  if (replyToIds.length > 0) {
    const { data: replyMessages } = await supabase
      .from('messages')
      .select('id, text, sender_id')
      .in('id', replyToIds);
    if (replyMessages) {
      replyToMap = new Map(replyMessages.map(m => [m.id, m]));
    }
  }

  // Format messages
  const messages = messagesData.map((message, index) => {
    const prevMessage = index > 0 ? messagesData[index - 1] : null;
    const isFirst = !prevMessage || prevMessage.sender_id !== message.sender_id;
    const isConsecutive = !isFirst;
    const senderProfile = profilesMap.get(message.sender_id);
    let replyToMessage = undefined;
    if (message.replyTo && replyToMap.has(message.replyTo)) {
      const replyMsg = replyToMap.get(message.replyTo);
      replyToMessage = {
        id: replyMsg.id,
        text: replyMsg.text,
        senderId: replyMsg.sender_id
      };
    }
    return {
      id: message.id,
      senderId: message.sender_id,
      text: message.text,
      time: new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      status: message.status,
      type: message.type,
      sender: senderProfile || {
        id: message.sender_id,
        name: 'Unknown',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=unknown`
      },
      isFirst,
      isConsecutive,
      replyTo: message.replyTo,
      replyToMessage
    };
  });

  return messages;
}

export async function sendMessage(chatId: string, senderId: string, text: string | { type: string; content: string; replyTo?: string }, replyTo?: string): Promise<Message | null> {
  // Support for replyTo in text or as argument
  let msgText = text;
  let msgType = 'text';
  let replyToId = replyTo;
  if (typeof text === 'object') {
    msgType = text.type;
    msgText = text.content;
    if (text.replyTo) replyToId = text.replyTo;
  }
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_id: senderId,
      text: typeof msgText === 'string' ? msgText : '',
      type: msgType,
      status: 'sent',
      created_at: new Date().toISOString(),
      replyTo: replyToId || null
    })
    .select()
    .single();

  if (error) {
    console.error('Error sending message:', error);
    return null;
  }

  // Get the sender profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('username, full_name, avatar_url')
    .eq('id', senderId)
    .single();

  if (profileError) {
    console.error('Error fetching sender profile:', profileError);
    return null;
  }

  return {
    id: message.id,
    senderId: message.sender_id,
    text: message.text,
    time: new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
    status: message.status,
    type: message.type,
    sender: {
      id: senderId,
      name: profile.full_name || profile.username,
      avatar: profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`
    },
    isFirst: true,
    isConsecutive: false,
    replyTo: message.replyTo
  };
}

export async function createDirectChat(userId: string, otherUserId: string): Promise<string | null> {
  // Check if a direct chat already exists between these users
  const { data: existingChats, error: chatCheckError } = await supabase
    .from('chat_participants')
    .select('chat_id')
    .eq('profile_id', userId);

  if (chatCheckError) {
    console.error('Error checking existing chats:', chatCheckError);
    return null;
  }

  if (existingChats && existingChats.length > 0) {
    const chatIds = existingChats.map(c => c.chat_id);
    
    const { data: otherParticipations, error: otherPartError } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('profile_id', otherUserId)
      .in('chat_id', chatIds);

    if (!otherPartError && otherParticipations && otherParticipations.length > 0) {
      // Check if this is a direct chat (has exactly 2 participants)
      for (const participation of otherParticipations) {
        const { count, error: countError } = await supabase
          .from('chat_participants')
          .select('*', { count: 'exact', head: true })
          .eq('chat_id', participation.chat_id);
        
        if (!countError && count === 2) {
          // This is a direct chat between these users
          const { data: chatData } = await supabase
            .from('chats')
            .select('type')
            .eq('id', participation.chat_id)
            .single();
          
          if (chatData && chatData.type === 'direct') {
            return participation.chat_id;
          }
        }
      }
    }
  }

  // Create a new chat
  const { data: newChat, error: createChatError } = await supabase
    .from('chats')
    .insert({
      type: 'direct',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (createChatError) {
    console.error('Error creating chat:', createChatError);
    return null;
  }

  // Add participants
  const { error: addUser1Error } = await supabase
    .from('chat_participants')
    .insert({
      chat_id: newChat.id,
      profile_id: userId,
      created_at: new Date().toISOString()
    });

  if (addUser1Error) {
    console.error('Error adding first participant:', addUser1Error);
    return null;
  }

  const { error: addUser2Error } = await supabase
    .from('chat_participants')
    .insert({
      chat_id: newChat.id,
      profile_id: otherUserId,
      created_at: new Date().toISOString()
    });

  if (addUser2Error) {
    console.error('Error adding second participant:', addUser2Error);
    return null;
  }

  return newChat.id;
}

export async function getChatDetails(chatId: string, userId: string): Promise<{
  id: string;
  type: ChatType;
  name: string;
  avatar: string;
  online?: boolean;
  members?: { id: string; name: string }[];
  friendId?: string;
} | null> {
  // Get chat info
  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .single();

  if (chatError) {
    console.error('Error fetching chat:', chatError);
    return null;
  }

  if (chat.type === 'direct') {
    // Get the other participant
    const { data: participants, error: participantError } = await supabase
      .from('chat_participants')
      .select('profile_id')
      .eq('chat_id', chatId)
      .neq('profile_id', userId);

    if (participantError || !participants || participants.length === 0) {
      console.error('Error fetching other participant:', participantError);
      return null;
    }

    const otherUserId = participants[0].profile_id;

    // Get the other user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', otherUserId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return null;
    }

    return {
      id: chat.id,
      type: chat.type,
      name: profile.full_name || profile.username,
      avatar: profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`,
      online: profile.status === 'online',
      friendId: profile.id
    };
  } else {
    // For group chats
    // Get all members
    const { data: memberParticipations, error: membersError } = await supabase
      .from('chat_participants')
      .select('profile_id')
      .eq('chat_id', chatId);

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return null;
    }

    const memberIds = memberParticipations.map(m => m.profile_id);

    // Get member profiles
    const { data: memberProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name')
      .in('id', memberIds);

    if (profilesError) {
      console.error('Error fetching member profiles:', profilesError);
      return null;
    }

    const members = memberProfiles.map(profile => ({
      id: profile.id,
      name: profile.full_name || profile.username
    }));

    return {
      id: chat.id,
      type: chat.type,
      name: chat.name || 'Group Chat',
      avatar: chat.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${chat.id}`,
      members
    };
  }
}

// Function to send a message
export async function sendDirectMessage(senderEmail, receiverEmail, content) {
  if (!senderEmail || !receiverEmail || !content) {
    throw new Error('All fields are required');
  }

  const { error } = await supabase
    .from('messages')
    .insert({
      sender_email: senderEmail,
      receiver_email: receiverEmail,
      content,
      timestamp: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Failed to send message: ${error.message}`);
  }
}

// Function to fetch chat history
export async function fetchChatHistory(userEmail, friendEmail) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_email.eq.${userEmail},receiver_email.eq.${friendEmail}),and(sender_email.eq.${friendEmail},receiver_email.eq.${userEmail})`
    )
    .order('timestamp', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch chat history: ${error.message}`);
  }

  return data;
}

// Function to subscribe to real-time updates
export function subscribeToMessages(userEmail, friendEmail, callback) {
  return supabase
    .channel('realtime:messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `or(and(sender_email.eq.${userEmail},receiver_email.eq.${friendEmail}),and(sender_email.eq.${friendEmail},receiver_email.eq.${userEmail}))`,
    }, (payload) => {
      callback(payload.new);
    })
    .subscribe();
}

export async function getOrCreateDirectChatByEmail(currentUserEmail: string, otherUserEmail: string) {
  const emails = [currentUserEmail.trim().toLowerCase(), otherUserEmail.trim().toLowerCase()];
  const { data: users, error: usersError } = await supabase
    .from('profiles')
    .select('id, email')
    .in('email', emails);

  if (usersError || !users || users.length !== 2) {
    console.error('User lookup failed:', { currentUserEmail, otherUserEmail, users });
    throw new Error('Could not find both users');
  }

  const currentUserId = users.find(u => u.email.toLowerCase() === currentUserEmail.trim().toLowerCase())?.id;
  const otherUserId = users.find(u => u.email.toLowerCase() === otherUserEmail.trim().toLowerCase())?.id;

  // Find all chat IDs where current user is a participant
  const { data: myChats, error: myChatsError } = await supabase
    .from('chat_participants')
    .select('chat_id')
    .eq('profile_id', currentUserId);

  if (myChatsError || !myChats) {
    throw new Error('Could not fetch user chats');
  }

  const chatIds = myChats.map(c => c.chat_id);

  // Find chats where the other user is also a participant
  const { data: sharedChats, error: sharedChatsError } = await supabase
    .from('chat_participants')
    .select('chat_id')
    .eq('profile_id', otherUserId)
    .in('chat_id', chatIds);

  if (sharedChatsError) {
    throw new Error('Could not fetch shared chats');
  }

  // Check if any shared chat is of type 'direct'
  for (const chat of sharedChats) {
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .select('id, type')
      .eq('id', chat.chat_id)
      .single();

    if (!chatError && chatData && chatData.type === 'direct') {
      return chatData.id; // always return the chat ID
    }
  }

  // If not found, create a new direct chat and add both users as participants
  const { data: newChat, error: newChatError } = await supabase
    .from('chats')
    .insert({ type: 'direct' })
    .select()
    .single();

  if (newChatError || !newChat) {
    throw new Error('Could not create new chat');
  }

  // Add both users as participants
  const { error: addParticipantsError } = await supabase
    .from('chat_participants')
    .insert([
      { chat_id: newChat.id, profile_id: currentUserId },
      { chat_id: newChat.id, profile_id: otherUserId }
    ]);

  if (addParticipantsError) {
    throw new Error('Could not add participants to chat');
  }

  return newChat.id; // always return the chat ID
}

export async function deleteMessage(messageId: string, fileUrl?: string): Promise<boolean> {
  // 1. Delete the message from the table
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId);

  // 2. If it's a file message, delete the file from storage
  if (fileUrl) {
    let bucket = '';
    let path = '';
    const urlMatch = fileUrl.match(/storage\/v1\/object\/public\/([^/]+)\/(.+)$/) || fileUrl.match(/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (urlMatch && urlMatch[1] && urlMatch[2]) {
      bucket = urlMatch[1];
      path = urlMatch[2].split('?')[0];
    } else {
      // fallback for public url
      const parts = fileUrl.split('/storage/v1/object/public/');
      if (parts[1]) {
        const [bucketAndPath] = parts[1].split('?');
        const [b, ...p] = bucketAndPath.split('/');
        bucket = b;
        path = p.join('/');
      }
    }
    console.log('Deleting from storage:', bucket, path);
    if (bucket && path) {
      const { data: storageData, error: storageError } = await supabase.storage.from(bucket).remove([path]);
      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
      }
    }
  }

  if (error) {
    console.error('Error deleting message:', error);
    return false;
  }
  return true;
}

export async function clearChat(chatId: string): Promise<boolean> {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('chat_id', chatId);

  if (error) {
    console.error('Error clearing chat:', error);
    return false;
  }
  return true;
}
