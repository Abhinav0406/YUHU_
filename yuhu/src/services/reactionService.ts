import { supabase } from '@/lib/supabase';

export interface Reaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface ReactionData {
  emoji: string;
  count: number;
  users: string[];
}

/**
 * Add a reaction to a message
 */
export async function addReaction(messageId: string, userId: string, emoji: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('message_reactions')
      .insert({
        message_id: messageId,
        user_id: userId,
        emoji: emoji
      });

    if (error) {
      console.error('Error adding reaction:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error adding reaction:', error);
    return false;
  }
}

/**
 * Remove a reaction from a message
 */
export async function removeReaction(messageId: string, userId: string, emoji: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji);

    if (error) {
      console.error('Error removing reaction:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error removing reaction:', error);
    return false;
  }
}

/**
 * Get all reactions for a message
 */
export async function getMessageReactions(messageId: string): Promise<Reaction[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_message_reactions', { message_id_param: messageId });

    if (error) {
      console.error('Error getting reactions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting reactions:', error);
    return [];
  }
}

/**
 * Toggle a reaction (add if not exists, remove if exists)
 */
export async function toggleReaction(messageId: string, userId: string, emoji: string): Promise<boolean> {
  try {
    // Check if reaction already exists
    const { data: existingReaction } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .single();

    if (existingReaction) {
      // Remove existing reaction
      return await removeReaction(messageId, userId, emoji);
    } else {
      // Add new reaction
      return await addReaction(messageId, userId, emoji);
    }
  } catch (error) {
    console.error('Error toggling reaction:', error);
    return false;
  }
}

/**
 * Get reactions for multiple messages
 */
export async function getMessagesReactions(messageIds: string[]): Promise<Map<string, Reaction[]>> {
  try {
    const reactionsMap = new Map<string, Reaction[]>();
    
    // Get reactions for all messages in parallel
    const reactionsPromises = messageIds.map(async (messageId) => {
      const reactions = await getMessageReactions(messageId);
      return { messageId, reactions };
    });

    const results = await Promise.all(reactionsPromises);
    
    results.forEach(({ messageId, reactions }) => {
      reactionsMap.set(messageId, reactions);
    });

    return reactionsMap;
  } catch (error) {
    console.error('Error getting messages reactions:', error);
    return new Map();
  }
}
