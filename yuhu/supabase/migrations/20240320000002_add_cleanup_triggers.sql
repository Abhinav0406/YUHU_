-- Add cleanup triggers for when users are deleted
-- This will automatically clean up orphaned friend records

-- Function to clean up orphaned friend records when a profile is deleted
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_friends_on_profile_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete friend records where the deleted user was involved
  DELETE FROM public.friends 
  WHERE user1_email = OLD.email OR user2_email = OLD.email;
  
  -- Delete friend requests where the deleted user was involved
  DELETE FROM public.friend_requests 
  WHERE sender_email = OLD.email OR receiver_email = OLD.email;
  
  -- Log the cleanup
  RAISE NOTICE 'Cleaned up friend records for deleted user: %', OLD.email;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically clean up when profiles are deleted
DROP TRIGGER IF EXISTS trigger_cleanup_orphaned_friends ON public.profiles;
CREATE TRIGGER trigger_cleanup_orphaned_friends
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_orphaned_friends_on_profile_delete();

-- Function to clean up orphaned chat records when a profile is deleted
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_chats_on_profile_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete chat participants for the deleted user
  DELETE FROM public.chat_participants 
  WHERE profile_id = OLD.id;
  
  -- Delete messages sent by the deleted user
  DELETE FROM public.messages 
  WHERE sender_id = OLD.id;
  
  -- Log the cleanup
  RAISE NOTICE 'Cleaned up chat records for deleted user: %', OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically clean up chat records when profiles are deleted
DROP TRIGGER IF EXISTS trigger_cleanup_orphaned_chats ON public.profiles;
CREATE TRIGGER trigger_cleanup_orphaned_chats
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_orphaned_chats_on_profile_delete();

-- Function to clean up orphaned call history when a profile is deleted
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_calls_on_profile_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete call history records for the deleted user
  DELETE FROM public.call_history 
  WHERE user_id = OLD.id OR peer_id = OLD.id;
  
  -- Log the cleanup
  RAISE NOTICE 'Cleaned up call history for deleted user: %', OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically clean up call history when profiles are deleted
DROP TRIGGER IF EXISTS trigger_cleanup_orphaned_calls ON public.profiles;
CREATE TRIGGER trigger_cleanup_orphaned_calls
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_orphaned_calls_on_profile_delete();

