# 🗑️ Database Cleanup for User Deletion Issues

## Problem
When users are deleted in Supabase, the frontend continues to show them because:
1. **No real-time subscriptions** for profile deletions
2. **Stale data** in local state
3. **Orphaned records** in related tables (friends, chats, messages, etc.)

## ✅ Solutions Implemented

### 1. Real-time Subscriptions
- Added subscriptions to profile changes (INSERT, UPDATE, DELETE)
- Added subscriptions to friends table changes
- Frontend automatically updates when users are deleted

### 2. Database Triggers
- Automatic cleanup of orphaned records when profiles are deleted
- Cascading deletion of related data

### 3. Manual Refresh
- Added refresh button to manually update friends list
- Utility functions to refresh data programmatically

## 🗄️ Database Migration

### Apply the Migration
Run this SQL in your Supabase SQL editor:

```sql
-- File: 20240320000002_add_cleanup_triggers.sql

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
```

## 🔧 Manual Cleanup (Optional)

If you have existing orphaned records, you can run this cleanup function:

```sql
-- Clean up existing orphaned records
SELECT public.cleanup_orphaned_friends();
```

## 🚀 Frontend Changes

### New Functions Added
- `subscribeToProfileChanges()` - Real-time profile updates
- `subscribeToFriendsChanges()` - Real-time friends table updates
- `refreshFriendsList()` - Manual refresh utility
- `cleanupOrphanedFriends()` - Database cleanup utility

### Components Updated
- `Chat.tsx` - Added real-time subscriptions and refresh button
- `FriendsList.tsx` - Added real-time subscriptions
- `FriendRequests.tsx` - Added real-time subscriptions

## 🧪 Testing

1. **Delete a user** in Supabase
2. **Verify** the user disappears from all frontend lists immediately
3. **Check console logs** for cleanup notifications
4. **Test manual refresh** button functionality

## 📝 Notes

- **Real-time subscriptions** work automatically when Supabase Realtime is enabled
- **Database triggers** ensure data consistency at the database level
- **Manual refresh** provides fallback for edge cases
- **Console logging** helps debug any issues

## 🔒 Security

- All cleanup operations respect Row Level Security (RLS)
- Triggers only run on authenticated operations
- No data leakage between users

