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
  public: {
    Tables: {
      thread_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          parts?: Json
          role: string
          thread_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          parts?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      households: {
        Row: { id: string; name: string; created_by: string | null; created_at: string }
        Insert: { id?: string; name?: string; created_by?: string | null; created_at?: string }
        Update: { id?: string; name?: string; created_by?: string | null; created_at?: string }
        Relationships: []
      }
      members: {
        Row: {
          id: string
          household_id: string | null
          privy_user_id: string | null
          wallet_address: string | null
          display_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          household_id?: string | null
          privy_user_id?: string | null
          wallet_address?: string | null
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          household_id?: string | null
          privy_user_id?: string | null
          wallet_address?: string | null
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      household_members: {
        Row: { household_id: string; member_id: string; role: string; created_at: string }
        Insert: { household_id: string; member_id: string; role?: string; created_at?: string }
        Update: { household_id?: string; member_id?: string; role?: string; created_at?: string }
        Relationships: []
      }
      money_plans: {
        Row: {
          id: string
          household_id: string
          member_id: string
          thread_id: string | null
          title: string
          status: string
          currency: string
          reserve_floor_cents: number
          spending_cap_cents: number | null
          expires_at: string | null
          approved_at: string | null
          plan_json: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          member_id: string
          thread_id?: string | null
          title?: string
          status?: string
          currency?: string
          reserve_floor_cents?: number
          spending_cap_cents?: number | null
          expires_at?: string | null
          approved_at?: string | null
          plan_json?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          member_id?: string
          thread_id?: string | null
          title?: string
          status?: string
          currency?: string
          reserve_floor_cents?: number
          spending_cap_cents?: number | null
          expires_at?: string | null
          approved_at?: string | null
          plan_json?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_rules: {
        Row: {
          id: string
          plan_id: string
          kind: string
          label: string
          config: Json
          pinned: boolean
          created_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          kind: string
          label: string
          config?: Json
          pinned?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          kind?: string
          label?: string
          config?: Json
          pinned?: boolean
          created_at?: string
        }
        Relationships: []
      }
      intents: {
        Row: {
          id: string
          plan_id: string
          member_id: string
          source: string
          raw_text: string
          parsed: Json
          status: string
          deny_reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          member_id: string
          source?: string
          raw_text: string
          parsed?: Json
          status?: string
          deny_reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          member_id?: string
          source?: string
          raw_text?: string
          parsed?: Json
          status?: string
          deny_reason?: string | null
          created_at?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          id: string
          intent_id: string
          plan_id: string
          member_id: string
          rail: string
          status: string
          amount_cents: number
          asset: string
          tx_hash: string | null
          explorer_url: string | null
          receipt_json: Json
          created_at: string
        }
        Insert: {
          id?: string
          intent_id: string
          plan_id: string
          member_id: string
          rail?: string
          status: string
          amount_cents?: number
          asset?: string
          tx_hash?: string | null
          explorer_url?: string | null
          receipt_json?: Json
          created_at?: string
        }
        Update: {
          id?: string
          intent_id?: string
          plan_id?: string
          member_id?: string
          rail?: string
          status?: string
          amount_cents?: number
          asset?: string
          tx_hash?: string | null
          explorer_url?: string | null
          receipt_json?: Json
          created_at?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          id: string
          settlement_id: string | null
          household_id: string
          member_id: string
          plain_english: string
          kind: string
          envio_entity_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          settlement_id?: string | null
          household_id: string
          member_id: string
          plain_english: string
          kind: string
          envio_entity_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          settlement_id?: string | null
          household_id?: string
          member_id?: string
          plain_english?: string
          kind?: string
          envio_entity_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_household_member: {
        Args: { hh: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
