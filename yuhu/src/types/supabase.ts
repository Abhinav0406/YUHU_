
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          full_name: string | null
          email: string
          avatar_url: string | null
          bio: string | null
          college: string | null
          major: string | null
          status: 'online' | 'offline' | 'away' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          full_name?: string | null
          email: string
          avatar_url?: string | null
          bio?: string | null
          college?: string | null
          major?: string | null
          status?: 'online' | 'offline' | 'away' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          full_name?: string | null
          email?: string
          avatar_url?: string | null
          bio?: string | null
          college?: string | null
          major?: string | null
          status?: 'online' | 'offline' | 'away' | null
          updated_at?: string
        }
      }
      chats: {
        Row: {
          id: string
          type: 'direct' | 'group'
          name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: 'direct' | 'group'
          name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: 'direct' | 'group'
          name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      chat_participants: {
        Row: {
          id: string
          chat_id: string
          profile_id: string
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          profile_id: string
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          profile_id?: string
        }
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          sender_id: string
          text: string
          time: string
          status: 'sent' | 'delivered' | 'read'
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          sender_id: string
          text: string
          time?: string
          status?: 'sent' | 'delivered' | 'read'
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          sender_id?: string
          text?: string
          time?: string
          status?: 'sent' | 'delivered' | 'read'
        }
      }
      friends: {
        Row: {
          id: string
          profile_id: string
          friend_id: string
          status: 'pending' | 'accepted' | 'declined' | 'blocked'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          friend_id: string
          status?: 'pending' | 'accepted' | 'declined' | 'blocked'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          friend_id?: string
          status?: 'pending' | 'accepted' | 'declined' | 'blocked'
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
