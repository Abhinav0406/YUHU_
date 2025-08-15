-- Create message_reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_user_message_reaction UNIQUE (user_id, message_id, emoji)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON public.message_reactions(user_id);

-- Enable Row Level Security
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Create policies for message_reactions
CREATE POLICY "Users can view reactions on messages in their chats"
    ON public.message_reactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.chat_participants cp ON m.chat_id = cp.chat_id
            WHERE m.id = message_reactions.message_id
            AND cp.profile_id = auth.uid()
        )
    );

CREATE POLICY "Users can add reactions to messages in their chats"
    ON public.message_reactions FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.chat_participants cp ON m.chat_id = cp.chat_id
            WHERE m.id = message_reactions.message_id
            AND cp.profile_id = auth.uid()
        )
    );

CREATE POLICY "Users can remove their own reactions"
    ON public.message_reactions FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to get aggregated reactions for a message
CREATE OR REPLACE FUNCTION public.get_message_reactions(message_id_param UUID)
RETURNS TABLE (
    emoji TEXT,
    count BIGINT,
    users UUID[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mr.emoji,
        COUNT(*)::BIGINT,
        ARRAY_AGG(mr.user_id) as users
    FROM public.message_reactions mr
    WHERE mr.message_id = message_id_param
    GROUP BY mr.emoji
    ORDER BY COUNT(*) DESC, mr.emoji;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_message_reactions(UUID) TO authenticated;
