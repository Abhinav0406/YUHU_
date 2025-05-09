-- Create friend_requests table
CREATE TABLE IF NOT EXISTS public.friend_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_email TEXT NOT NULL,
    receiver_email TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_friend_request UNIQUE (sender_email, receiver_email)
);

-- Create friends table
CREATE TABLE IF NOT EXISTS public.friends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user1_email TEXT NOT NULL,
    user2_email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_friendship UNIQUE (user1_email, user2_email),
    CONSTRAINT different_users CHECK (user1_email != user2_email)
);

-- Enable Row Level Security
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- Create policies for friend_requests
CREATE POLICY "Users can view their own friend requests"
    ON public.friend_requests FOR SELECT
    USING (auth.email() = sender_email OR auth.email() = receiver_email);

CREATE POLICY "Users can create friend requests"
    ON public.friend_requests FOR INSERT
    WITH CHECK (auth.email() = sender_email);

CREATE POLICY "Users can update their own friend requests"
    ON public.friend_requests FOR UPDATE
    USING (auth.email() = receiver_email);

-- Create policies for friends
CREATE POLICY "Users can view their own friendships"
    ON public.friends FOR SELECT
    USING (auth.email() = user1_email OR auth.email() = user2_email);

CREATE POLICY "Users can create friendships"
    ON public.friends FOR INSERT
    WITH CHECK (auth.email() = user1_email OR auth.email() = user2_email);

CREATE POLICY "Users can delete their own friendships"
    ON public.friends FOR DELETE
    USING (auth.email() = user1_email OR auth.email() = user2_email);

-- Create triggers for updated_at
CREATE TRIGGER handle_friend_requests_updated_at
    BEFORE UPDATE ON public.friend_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_friends_updated_at
    BEFORE UPDATE ON public.friends
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create function to handle friend request acceptance
CREATE OR REPLACE FUNCTION public.handle_friend_request_acceptance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        -- Insert into friends table
        INSERT INTO public.friends (user1_email, user2_email)
        VALUES (NEW.sender_email, NEW.receiver_email);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for friend request acceptance
CREATE TRIGGER on_friend_request_accepted
    AFTER UPDATE ON public.friend_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_friend_request_acceptance(); 