import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';
import { supabase } from '../lib/supabase';

const KEY_SECRET_PREFIX = 'e2ee:secret:';
const KEY_PUBLIC_PREFIX = 'e2ee:public:';
const KEY_ID_PREFIX = 'e2ee:keyId:';
const ENCRYPTION_VERSION = 1;

type EncryptResult = {
  text: string;
  ciphertext: string | null;
  nonce: string | null;
  encryption_version: number | null;
  sender_key_id: string | null;
  content_type: 'text';
};

class E2EEService {
  private publicKeyCache = new Map<string, { keyId: string; publicKey: Uint8Array }>();
  private mySecretKey: Uint8Array | null = null;
  private myPublicKey: Uint8Array | null = null;
  private myKeyId: string | null = null;
  private initializedForUserId: string | null = null;

  private randomId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async initializeForUser(userId: string): Promise<void> {
    if (this.initializedForUserId === userId && this.mySecretKey && this.myPublicKey && this.myKeyId) {
      return;
    }

    const secretKeyStored = await SecureStore.getItemAsync(`${KEY_SECRET_PREFIX}${userId}`);
    const publicKeyStored = await SecureStore.getItemAsync(`${KEY_PUBLIC_PREFIX}${userId}`);
    const keyIdStored = await SecureStore.getItemAsync(`${KEY_ID_PREFIX}${userId}`);

    if (secretKeyStored && publicKeyStored && keyIdStored) {
      this.mySecretKey = decodeBase64(secretKeyStored);
      this.myPublicKey = decodeBase64(publicKeyStored);
      this.myKeyId = keyIdStored;
      this.initializedForUserId = userId;
    } else {
      const pair = nacl.box.keyPair();
      const keyId = this.randomId();

      await SecureStore.setItemAsync(`${KEY_SECRET_PREFIX}${userId}`, encodeBase64(pair.secretKey));
      await SecureStore.setItemAsync(`${KEY_PUBLIC_PREFIX}${userId}`, encodeBase64(pair.publicKey));
      await SecureStore.setItemAsync(`${KEY_ID_PREFIX}${userId}`, keyId);

      this.mySecretKey = pair.secretKey;
      this.myPublicKey = pair.publicKey;
      this.myKeyId = keyId;
      this.initializedForUserId = userId;
    }

    await this.publishPublicKey(userId);
  }

  private async publishPublicKey(userId: string): Promise<void> {
    if (!this.myPublicKey || !this.myKeyId) return;

    // Revoke previous active keys, then publish this device key
    await supabase
      .from('user_public_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null)
      .neq('key_id', this.myKeyId as string);

    const { error } = await supabase
      .from('user_public_keys')
      .upsert(
        {
          key_id: this.myKeyId,
          user_id: userId,
          curve: 'x25519',
          public_key: encodeBase64(this.myPublicKey),
          revoked_at: null,
        },
        { onConflict: 'key_id' }
      );

    if (error) {
      console.error('Failed to publish public key:', error);
    }
  }

  private async getRecipientPublicKey(recipientUserId: string): Promise<{ keyId: string; publicKey: Uint8Array } | null> {
    const cached = this.publicKeyCache.get(recipientUserId);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('user_public_keys')
      .select('key_id, public_key')
      .eq('user_id', recipientUserId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data?.public_key) return null;

    const resolved = { keyId: data.key_id as string, publicKey: decodeBase64(data.public_key as string) };
    this.publicKeyCache.set(recipientUserId, resolved);
    return resolved;
  }

  async getDirectRecipientId(chatId: string, currentUserId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('chat_participants')
      .select('profile_id')
      .eq('chat_id', chatId)
      .neq('profile_id', currentUserId)
      .limit(1);

    if (error || !data || data.length === 0) return null;
    return data[0].profile_id;
  }

  async encryptDirectMessage(params: {
    chatId: string;
    currentUserId: string;
    plaintext: string;
    isDirectChat: boolean;
  }): Promise<EncryptResult> {
    const { chatId, currentUserId, plaintext, isDirectChat } = params;

    if (!isDirectChat) {
      return {
        text: plaintext,
        ciphertext: null,
        nonce: null,
        encryption_version: null,
        sender_key_id: null,
        content_type: 'text',
      };
    }

    await this.initializeForUser(currentUserId);
    if (!this.mySecretKey || !this.myKeyId) {
      throw new Error('Failed to initialize sender encryption keys');
    }

    const recipientUserId = await this.getDirectRecipientId(chatId, currentUserId);
    if (!recipientUserId) {
      throw new Error('Could not resolve direct recipient');
    }

    const recipientKey = await this.getRecipientPublicKey(recipientUserId);
    if (!recipientKey) {
      throw new Error('Recipient public key not available');
    }

    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const sharedKey = nacl.box.before(recipientKey.publicKey, this.mySecretKey);
    const ciphertext = nacl.box.after(decodeUTF8(plaintext), nonce, sharedKey);

    return {
      text: '[encrypted]',
      ciphertext: encodeBase64(ciphertext),
      nonce: encodeBase64(nonce),
      encryption_version: ENCRYPTION_VERSION,
      sender_key_id: this.myKeyId,
      content_type: 'text',
    };
  }

  async decryptDirectMessage(params: {
    currentUserId: string;
    senderUserId: string;
    ciphertext?: string | null;
    nonce?: string | null;
  }): Promise<string | null> {
    const { currentUserId, senderUserId, ciphertext, nonce } = params;
    if (!ciphertext || !nonce) return null;

    await this.initializeForUser(currentUserId);
    if (!this.mySecretKey) return null;

    const senderKey = await this.getRecipientPublicKey(senderUserId);
    if (!senderKey) return null;

    try {
      const sharedKey = nacl.box.before(senderKey.publicKey, this.mySecretKey);
      const opened = nacl.box.open.after(
        decodeBase64(ciphertext),
        decodeBase64(nonce),
        sharedKey
      );
      if (!opened) return null;
      return encodeUTF8(opened);
    } catch {
      return null;
    }
  }
}

export const e2eeService = new E2EEService();
