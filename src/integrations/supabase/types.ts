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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          points_earned: number
          task_id: string | null
          user_id: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          points_earned?: number
          task_id?: string | null
          user_id: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          points_earned?: number
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      admin_permissions: {
        Row: {
          created_at: string
          id: string
          permission_key: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_key: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          role_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          role_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          net_amount: number
          processed_at: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["claim_status"]
          tax_amount: number
          tx_hash: string | null
          updated_at: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          net_amount: number
          processed_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          tax_amount?: number
          tx_hash?: string | null
          updated_at?: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          net_amount?: number
          processed_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          tax_amount?: number
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_flags: {
        Row: {
          created_at: string
          flag_type: string
          id: string
          reason: string
          related_id: string | null
          related_table: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: Database["public"]["Enums"]["fraud_flag_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          flag_type: string
          id?: string
          reason: string
          related_id?: string | null
          related_table?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: Database["public"]["Enums"]["fraud_flag_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          flag_type?: string
          id?: string
          reason?: string
          related_id?: string | null
          related_table?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: Database["public"]["Enums"]["fraud_flag_status"]
          user_id?: string
        }
        Relationships: []
      }
      platform_revenue: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          source: string
          transaction_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          source: string
          transaction_date?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          source?: string
          transaction_date?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          is_frozen: boolean
          referral_code: string | null
          referred_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          is_frozen?: boolean
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          is_frozen?: boolean
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "v_admin_user_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_limits: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          limit_type: string
          limit_value: number
          period: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          limit_type: string
          limit_value: number
          period?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          limit_type?: string
          limit_value?: number
          period?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      reward_transactions: {
        Row: {
          activity_id: string | null
          created_at: string
          description: string | null
          gross_amount: number
          id: string
          idempotency_key: string | null
          metadata: Json | null
          net_amount: number
          running_balance: number
          task_id: string | null
          tax_amount: number
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          description?: string | null
          gross_amount: number
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          net_amount: number
          running_balance?: number
          task_id?: string | null
          tax_amount?: number
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          description?: string | null
          gross_amount?: number
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          net_amount?: number
          running_balance?: number
          task_id?: string | null
          tax_amount?: number
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_transactions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_transactions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean
          max_completions_per_user: number | null
          name: string
          requirements: Json | null
          reward_points: number
          start_date: string | null
          task_type: Database["public"]["Enums"]["activity_type"]
          total_budget: number | null
          total_claimed: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          max_completions_per_user?: number | null
          name: string
          requirements?: Json | null
          reward_points?: number
          start_date?: string | null
          task_type?: Database["public"]["Enums"]["activity_type"]
          total_budget?: number | null
          total_claimed?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          max_completions_per_user?: number | null
          name?: string
          requirements?: Json | null
          reward_points?: number
          start_date?: string | null
          task_type?: Database["public"]["Enums"]["activity_type"]
          total_budget?: number | null
          total_claimed?: number
          updated_at?: string
        }
        Relationships: []
      }
      tax_rules: {
        Row: {
          applicable_to: string
          created_at: string
          description: string | null
          effective_from: string
          effective_until: string | null
          id: string
          is_active: boolean
          min_threshold: number | null
          name: string
          rate: number
        }
        Insert: {
          applicable_to?: string
          created_at?: string
          description?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean
          min_threshold?: number | null
          name: string
          rate?: number
        }
        Update: {
          applicable_to?: string
          created_at?: string
          description?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean
          min_threshold?: number | null
          name?: string
          rate?: number
        }
        Relationships: []
      }
      tax_transactions: {
        Row: {
          created_at: string
          id: string
          reward_transaction_id: string | null
          tax_amount: number
          tax_rate: number
          tax_rule_id: string | null
          taxable_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reward_transaction_id?: string | null
          tax_amount: number
          tax_rate: number
          tax_rule_id?: string | null
          taxable_amount: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reward_transaction_id?: string | null
          tax_amount?: number
          tax_rate?: number
          tax_rule_id?: string | null
          taxable_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_transactions_reward_transaction_id_fkey"
            columns: ["reward_transaction_id"]
            isOneToOne: false
            referencedRelation: "reward_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_transactions_tax_rule_id_fkey"
            columns: ["tax_rule_id"]
            isOneToOne: false
            referencedRelation: "tax_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          address: string | null
          balance: number
          created_at: string
          id: string
          is_primary: boolean
          is_verified: boolean
          pending_balance: number
          updated_at: string
          user_id: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Insert: {
          address?: string | null
          balance?: number
          created_at?: string
          id?: string
          is_primary?: boolean
          is_verified?: boolean
          pending_balance?: number
          updated_at?: string
          user_id: string
          wallet_type?: Database["public"]["Enums"]["wallet_type"]
        }
        Update: {
          address?: string | null
          balance?: number
          created_at?: string
          id?: string
          is_primary?: boolean
          is_verified?: boolean
          pending_balance?: number
          updated_at?: string
          user_id?: string
          wallet_type?: Database["public"]["Enums"]["wallet_type"]
        }
        Relationships: []
      }
    }
    Views: {
      v_admin_claims_overview: {
        Row: {
          amount: number | null
          approved_at: string | null
          created_at: string | null
          id: string | null
          net_amount: number | null
          status: Database["public"]["Enums"]["claim_status"] | null
          tax_amount: number | null
          user_name: string | null
          wallet_address: string | null
          wallet_type: Database["public"]["Enums"]["wallet_type"] | null
        }
        Relationships: []
      }
      v_admin_user_summary: {
        Row: {
          bix_balance: number | null
          created_at: string | null
          display_name: string | null
          id: string | null
          is_active: boolean | null
          is_frozen: boolean | null
          open_fraud_flags: number | null
          pending_balance: number | null
          total_activities: number | null
          total_claims: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_platform_stats: {
        Row: {
          active_users: number | null
          pending_claims: number | null
          total_approved_claims: number | null
          total_bix_in_circulation: number | null
          total_revenue: number | null
          total_users: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_admin_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      activity_type:
        | "task_completion"
        | "referral"
        | "staking"
        | "login"
        | "social"
        | "custom"
      claim_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "processing"
      fraud_flag_status: "open" | "investigating" | "resolved" | "dismissed"
      transaction_type:
        | "earn"
        | "spend"
        | "adjustment"
        | "tax_deduction"
        | "bonus"
        | "referral"
      wallet_type: "bix" | "eth" | "btc" | "usdt"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "task_completion",
        "referral",
        "staking",
        "login",
        "social",
        "custom",
      ],
      claim_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "processing",
      ],
      fraud_flag_status: ["open", "investigating", "resolved", "dismissed"],
      transaction_type: [
        "earn",
        "spend",
        "adjustment",
        "tax_deduction",
        "bonus",
        "referral",
      ],
      wallet_type: ["bix", "eth", "btc", "usdt"],
    },
  },
} as const
