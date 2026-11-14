export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      checkin_evidence: {
        Row: {
          checkin_id: string
          id: string
          status: string
          storage_path: string
          uploaded_at: string | null
        }
        Insert: {
          checkin_id: string
          id?: string
          status?: string
          storage_path: string
          uploaded_at?: string | null
        }
        Update: {
          checkin_id?: string
          id?: string
          status?: string
          storage_path?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkin_evidence_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "habit_checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_reviews: {
        Row: {
          checkin_id: string
          comment: string | null
          created_at: string
          decision: string
          id: string
          reviewer_id: string
        }
        Insert: {
          checkin_id: string
          comment?: string | null
          created_at?: string
          decision: string
          id?: string
          reviewer_id: string
        }
        Update: {
          checkin_id?: string
          comment?: string | null
          created_at?: string
          decision?: string
          id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_reviews_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "habit_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invitations: {
        Row: {
          code: string
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          group_id: string
          id: string
          link_token: string
          max_uses: number
          status: Database["public"]["Enums"]["invitation_status"]
          updated_at: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          email?: string | null
          expires_at?: string
          group_id: string
          id?: string
          link_token?: string
          max_uses?: number
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          group_id?: string
          id?: string
          link_token?: string
          max_uses?: number
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          left_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          description: string | null
          id: string
          is_archived: boolean
          max_members: number
          name: string
          penalty_amount: number
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          max_members?: number
          name: string
          penalty_amount?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          max_members?: number
          name?: string
          penalty_amount?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_checkins: {
        Row: {
          created_at: string
          id: string
          occurrence_id: string
          profile_id: string
          quantity: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          occurrence_id: string
          profile_id: string
          quantity?: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          occurrence_id?: string
          profile_id?: string
          quantity?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_checkins_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "habit_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_checkins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_occurrences: {
        Row: {
          created_at: string
          id: string
          period_end: string
          period_start: string
          schedule_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          schedule_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          schedule_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_occurrences_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "habit_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_schedules: {
        Row: {
          created_at: string
          custom_cron: string | null
          frequency: string
          habit_id: string
          id: string
          target_quantity: number
        }
        Insert: {
          created_at?: string
          custom_cron?: string | null
          frequency: string
          habit_id: string
          id?: string
          target_quantity?: number
        }
        Update: {
          created_at?: string
          custom_cron?: string | null
          frequency?: string
          habit_id?: string
          id?: string
          target_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "habit_schedules_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_versions: {
        Row: {
          effective_from: string
          habit_id: string
          id: string
          payload: Json
          version: number
        }
        Insert: {
          effective_from?: string
          habit_id: string
          id?: string
          payload: Json
          version: number
        }
        Update: {
          effective_from?: string
          habit_id?: string
          id?: string
          payload?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "habit_versions_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habits_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          created_at: string
          group_id: string
          id: string
          metadata: Json | null
          related_payment_id: string | null
          related_penalty_id: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          group_id: string
          id?: string
          metadata?: Json | null
          related_payment_id?: string | null
          related_penalty_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          group_id?: string
          id?: string
          metadata?: Json | null
          related_payment_id?: string | null
          related_penalty_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_related_payment_id_fkey"
            columns: ["related_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_related_penalty_id_fkey"
            columns: ["related_penalty_id"]
            isOneToOne: false
            referencedRelation: "penalties"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          evidence_path: string | null
          group_id: string
          id: string
          receiver_id: string
          sender_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          evidence_path?: string | null
          group_id: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          evidence_path?: string | null
          group_id?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      penalties: {
        Row: {
          amount: number
          created_at: string
          id: string
          occurrence_id: string
          offender_id: string
          snapshot: Json
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          occurrence_id: string
          offender_id: string
          snapshot: Json
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          occurrence_id?: string
          offender_id?: string
          snapshot?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "penalties_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "habit_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalties_offender_id_fkey"
            columns: ["offender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      penalty_allocations: {
        Row: {
          penalty_id: string
          receiver_id: string
          share: number
        }
        Insert: {
          penalty_id: string
          receiver_id: string
          share: number
        }
        Update: {
          penalty_id?: string
          receiver_id?: string
          share?: number
        }
        Relationships: [
          {
            foreignKeyName: "penalty_allocations_penalty_id_fkey"
            columns: ["penalty_id"]
            isOneToOne: false
            referencedRelation: "penalties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalty_allocations_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          timezone: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          timezone?: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          timezone?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_group_invitation: {
        Args: { p_code?: string; p_link_token?: string }
        Returns: {
          group_id: string
          id: string
          joined_at: string
          left_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "group_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_payment: { Args: { p_payment_id: string }; Returns: Json }
      create_group_invitation: {
        Args: {
          p_created_by: string
          p_email?: string
          p_expires_in?: string
          p_group_id: string
          p_max_uses?: number
        }
        Returns: {
          code: string
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          group_id: string
          id: string
          link_token: string
          max_uses: number
          status: Database["public"]["Enums"]["invitation_status"]
          updated_at: string
          uses_count: number
        }
        SetofOptions: {
          from: "*"
          to: "group_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_group_with_owner: {
        Args: {
          p_currency: string
          p_description: string
          p_max_members: number
          p_name: string
          p_penalty_amount: number
          p_timezone: string
        }
        Returns: {
          created_at: string
          created_by: string
          currency: string
          description: string | null
          id: string
          is_archived: boolean
          max_members: number
          name: string
          penalty_amount: number
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_invite_code: { Args: never; Returns: string }
      has_group_role: {
        Args: {
          p_group_id: string
          p_roles: Database["public"]["Enums"]["user_role"][]
          p_user_id: string
        }
        Returns: boolean
      }
      is_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      record_habit_miss: {
        Args: { p_habit_id: string; p_notes?: string }
        Returns: Json
      }
      record_peer_settlement: {
        Args: {
          p_amount: number
          p_group_id: string
          p_method: string
          p_notes?: string
          p_receiver_id: string
        }
        Returns: Json
      }
      reject_payment: { Args: { p_payment_id: string }; Returns: Json }
      shares_group_with: { Args: { p_other: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      checkin_status:
        | "pending"
        | "submitted"
        | "verified"
        | "missed"
        | "disputed"
        | "excused"
      habit_frequency: "daily" | "weekly" | "monthly" | "quantity" | "custom"
      invitation_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "revoked"
        | "expired"
      notification_type:
        | "daily_reminder"
        | "upcoming_deadline"
        | "missed_commitment"
        | "successful_checkin"
        | "invitation"
        | "new_member"
        | "disputed_checkin"
        | "new_penalty"
        | "payment_request"
        | "payment_confirmation"
        | "weekly_report"
      payment_status: "pending" | "confirmed" | "rejected"
      penalty_status:
        | "active"
        | "paid"
        | "disputed"
        | "reversed"
        | "partially_paid"
      user_role: "owner" | "admin" | "member"
      verification_mode:
        | "self_reported"
        | "peer_review"
        | "admin_review"
        | "evidence_required"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      checkin_status: [
        "pending",
        "submitted",
        "verified",
        "missed",
        "disputed",
        "excused",
      ],
      habit_frequency: ["daily", "weekly", "monthly", "quantity", "custom"],
      invitation_status: [
        "pending",
        "accepted",
        "rejected",
        "revoked",
        "expired",
      ],
      notification_type: [
        "daily_reminder",
        "upcoming_deadline",
        "missed_commitment",
        "successful_checkin",
        "invitation",
        "new_member",
        "disputed_checkin",
        "new_penalty",
        "payment_request",
        "payment_confirmation",
        "weekly_report",
      ],
      payment_status: ["pending", "confirmed", "rejected"],
      penalty_status: [
        "active",
        "paid",
        "disputed",
        "reversed",
        "partially_paid",
      ],
      user_role: ["owner", "admin", "member"],
      verification_mode: [
        "self_reported",
        "peer_review",
        "admin_review",
        "evidence_required",
      ],
    },
  },
} as const
