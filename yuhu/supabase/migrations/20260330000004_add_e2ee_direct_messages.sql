-- E2EE support for direct chats: store ciphertext envelope fields

-- 1) Public keys table (private keys never leave device)
CREATE TABLE IF NOT EXISTS public.user_public_keys (
  key_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curve TEXT NOT NULL DEFAULT 'x25519',
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_public_keys_user_id
  ON public.user_public_keys(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_public_keys_active_user
  ON public.user_public_keys(user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.user_public_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own public keys" ON public.user_public_keys;
CREATE POLICY "Users manage own public keys"
  ON public.user_public_keys
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read keys for chats they participate in" ON public.user_public_keys;
CREATE POLICY "Users can read keys for chats they participate in"
  ON public.user_public_keys
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.chat_participants me
      JOIN public.chat_participants other
        ON me.chat_id = other.chat_id
      WHERE me.profile_id = auth.uid()
        AND other.profile_id = user_public_keys.user_id
    )
  );

-- 2) Ciphertext envelope fields on messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS nonce TEXT,
  ADD COLUMN IF NOT EXISTS encryption_version INTEGER,
  ADD COLUMN IF NOT EXISTS sender_key_id UUID REFERENCES public.user_public_keys(key_id),
  ADD COLUMN IF NOT EXISTS content_type TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_sender_key_id
  ON public.messages(sender_key_id);

CREATE INDEX IF NOT EXISTS idx_messages_encryption_version
  ON public.messages(encryption_version);
