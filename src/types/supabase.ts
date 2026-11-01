export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          timezone: string
          avatar_url: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          username: string
          timezone: string
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          username?: string
          timezone?: string
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      groups: {
        Row: {
          id: string
          name: string
          description: string | null
          penalty_currency: string
          penalty_amount: number
          max_members: number
          timezone: string
          owner_id: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          name: string
          description?: string | null
          penalty_currency?: string
          penalty_amount?: number
          max_members?: number
          timezone?: string
          owner_id: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          penalty_currency?: string
          penalty_amount?: number
          max_members?: number
          timezone?: string
          owner_id?: string
          created_at?: string | null
          updated_at?: string | null
        }
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string
          role: string
          joined_at: string | null
          left_at: string | null
        }
        Insert: {
          group_id: string
          user_id: string
          role?: string
          joined_at?: string | null
          left_at?: string | null
        }
        Update: {
          group_id?: string
          user_id?: string
          role?: string
          joined_at?: string | null
          left_at?: string | null
        }
      }
      group_invitations: {
        Row: {
          id: string
          group_id: string
          email: string | null
          inviter_id: string | null
          code: string
          link_token: string | null
          status: string
          max_uses: number | null
          expires_at: string | null
          created_at: string | null
        }
        Insert: {
          group_id: string
          email?: string | null
          inviter_id?: string | null
          code: string
          link_token?: string | null
          status?: string
          max_uses?: number | null
          expires_at?: string | null
          created_at?: string | null
        }
        Update: {
          group_id?: string
          email?: string | null
          inviter_id?: string | null
          code?: string
          link_token?: string | null
          status?: string
          max_uses?: number | null
          expires_at?: string | null
          created_at?: string | null
        }
      }
      habits: {
        Row: {
          id: string
          name: string
          description: string | null
          target_quantity: number
          frequency: string
          timezone: string
          penalty_cents: number | null
          verification_mode: string
          archived_at: string | null
          owner_id: string | null
          version: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          name: string
          description?: string | null
          target_quantity?: number
          frequency: string
          timezone: string
          penalty_cents?: number | null
          verification_mode?: string
          archived_at?: string | null
          owner_id?: string | null
          version?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          target_quantity?: number
          frequency?: string
          timezone?: string
          penalty_cents?: number | null
          verification_mode?: string
          archived_at?: string | null
          owner_id?: string | null
          version?: number
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      accept_group_invitation: {
        Args: { p_code: string; p_link_token: string }
        Returns: { group_id: string }
      }
      create_invitation: {
        Args: { _group_id: string; _email: string }
        Returns: string
      }
      create_profile: {
        Args: { _user_id: string; _username: string; _timezone: string }
        Returns: boolean
      }
    }
    Enums: {
      user_role: 'owner' | 'admin' | 'member'
      invitation_status: 'pending' | 'accepted' | 'revoked' | 'expired' | 'invalid'
      habit_frequency: 'daily' | 'weekly' | 'monthly' | 'custom'
      checkin_status: 'pending' | 'submitted' | 'verified' | 'missed' | 'disputed' | 'excused'
      verification_mode: 'self_reported' | 'peer_review' | 'admin_review' | 'evidence_required'
      penalty_status: 'pending' | 'distributed' | 'paid'
      payment_status: 'pending' | 'sent' | 'confirmed' | 'rejected' | 'canceled'
      notification_type: 'reminder' | 'deadline' | 'missed' | 'verified' | 'invitation' | 'new_member' | 'disputed' | 'new_penalty' | 'payment_request' | 'payment_confirmed' | 'weekly_report'
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables'] = keyof Database['public']['Tables']> = Database['public']['Tables'][T] extends infer T
  ? T extends Record<string, unknown>
    ? { [K in keyof T]: T[K] }
    : never
  : never

export type Views<T extends keyof Database['public']['Views'] = keyof Database['public']['Views']> = Database['public']['Views'][T]

export type Functions<
  T extends keyof Database['public']['Functions'] = keyof Database['public']['Functions']
> = Database['public']['Functions'][T]

export type Enums<
  T extends keyof Database['public']['Enums'] = keyof Database['public']['Enums']
> = Database['public']['Enums'][T]

export type SupabaseClient = ReturnType<typeof import('@/lib/supabase/client').createClient>