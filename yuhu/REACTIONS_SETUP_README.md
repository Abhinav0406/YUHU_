# Message Reactions Setup Guide

This guide explains how to set up and use the new message reactions functionality in your chat application.

## What's New

The chat application now supports:
- ✅ Adding emoji reactions to messages
- ✅ Real-time reaction updates
- ✅ Visual feedback for user's own reactions
- ✅ Reaction counts and user tracking
- ✅ Hover-based quick reaction buttons

## Database Setup

### 1. Run the Migration

First, you need to run the new database migration to create the reactions table:

```bash
# Navigate to your Supabase project
cd yuhu/supabase

# Run the migration (you'll need to do this in your Supabase dashboard)
# Copy the contents of: migrations/20240320000003_create_reactions_table.sql
```

### 2. Migration Contents

The migration creates:
- `message_reactions` table for storing reactions
- Proper indexes for performance
- Row Level Security (RLS) policies
- A function to aggregate reactions by emoji

## Features

### Quick Reactions
- Hover over any message to see quick reaction buttons
- Click any emoji to add/remove your reaction
- Available emojis: 👍 ❤️ 😂 😮 😢 🔥

### Reaction Display
- Reactions appear below messages with counts
- Your own reactions are highlighted with a special border
- Click on existing reactions to toggle them

### Real-time Updates
- Reactions update in real-time across all users
- No need to refresh the page
- Instant feedback when adding/removing reactions

## How It Works

### Frontend
1. **Message Component**: Displays reactions and handles user interactions
2. **Reaction Service**: Manages API calls for adding/removing reactions
3. **Real-time Updates**: Subscribes to database changes for live updates

### Backend
1. **Database Table**: Stores user reactions with proper constraints
2. **RLS Policies**: Ensures users can only react to messages in their chats
3. **Aggregation Function**: Groups reactions by emoji for efficient display

## Usage

### Adding a Reaction
1. Hover over any message
2. Click on an emoji button (👍 ❤️ 😂 😮 😢 🔥)
3. The reaction will be added immediately

### Removing a Reaction
1. Click on the same emoji again
2. The reaction will be removed

### Viewing Reactions
- Reactions appear below messages with counts
- Hover over reaction counts to see tooltips
- Your reactions are highlighted with a special style

## Technical Details

### Database Schema
```sql
message_reactions (
  id: UUID (Primary Key)
  message_id: UUID (References messages.id)
  user_id: UUID (References auth.users.id)
  emoji: TEXT (The emoji character)
  created_at: TIMESTAMP
)
```

### API Endpoints
- `POST /message_reactions` - Add a reaction
- `DELETE /message_reactions` - Remove a reaction
- `GET /rpc/get_message_reactions` - Get aggregated reactions

### Security
- Row Level Security (RLS) enabled
- Users can only react to messages in their chats
- Users can only remove their own reactions

## Troubleshooting

### Reactions Not Appearing
1. Check if the migration was run successfully
2. Verify RLS policies are in place
3. Check browser console for errors

### Real-time Updates Not Working
1. Ensure Supabase real-time is enabled
2. Check if the subscription is properly set up
3. Verify database permissions

### Performance Issues
1. Reactions are fetched in batches with messages
2. Indexes are in place for efficient queries
3. Consider pagination for very long chat histories

## Future Enhancements

Potential improvements:
- Custom emoji picker
- Reaction animations
- Reaction notifications
- Reaction analytics
- Bulk reaction management

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Verify database permissions
3. Ensure all migrations are applied
4. Check Supabase real-time configuration
