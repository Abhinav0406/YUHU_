-- Create user_tokens table to store FCM tokens
CREATE TABLE IF NOT EXISTS user_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_fcm_token ON user_tokens(fcm_token);

-- Enable RLS (Row Level Security)
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to manage their own tokens
CREATE POLICY "Users can manage their own tokens" ON user_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Create policy to allow service role to read all tokens (for sending notifications)
CREATE POLICY "Service role can read all tokens" ON user_tokens
  FOR SELECT USING (auth.role() = 'service_role');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_tokens_updated_at 
  BEFORE UPDATE ON user_tokens 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

