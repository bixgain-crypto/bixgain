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
      achievements: {
        Row: {
          condition_type: string | null
          condition_value: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string | null
          xp_reward: number | null
        }
        Insert: {
          condition_type?: string | null
          condition_value?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          xp_reward?: number | null
        }
        Update: {
          condition_type?: string | null
          condition_value?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          xp_reward?: number | null
        }
        Relationships: []
      }
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
          activity_type?: Database["public"]["Enums"]["activity_type"]
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
      admin_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          target_user: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      admin_settings: {
        Row: {
          created_at: string | null
          daily_reward_bix: number | null
          id: number
          max_daily_claims: number | null
          max_referrals_per_day: number | null
          referral_reward_bix: number | null
          spin_reward_max: number | null
          spin_reward_min: number | null
          updated_at: string | null
          username_change_days: number | null
          withdraw_fee_percent: number | null
          withdraw_min_bix: number | null
        }
        Insert: {
          created_at?: string | null
          daily_reward_bix?: number | null
          id?: number
          max_daily_claims?: number | null
          max_referrals_per_day?: number | null
          referral_reward_bix?: number | null
          spin_reward_max?: number | null
          spin_reward_min?: number | null
          updated_at?: string | null
          username_change_days?: number | null
          withdraw_fee_percent?: number | null
          withdraw_min_bix?: number | null
        }
        Update: {
          created_at?: string | null
          daily_reward_bix?: number | null
          id?: number
          max_daily_claims?: number | null
          max_referrals_per_day?: number | null
          referral_reward_bix?: number | null
          spin_reward_max?: number | null
          spin_reward_min?: number | null
          updated_at?: string | null
          username_change_days?: number | null
          withdraw_fee_percent?: number | null
          withdraw_min_bix?: number | null
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
      daily_rewards: {
        Row: {
          bix_earned: number | null
          created_at: string | null
          id: string
          reward_date: string | null
          user_id: string | null
          xp_earned: number | null
        }
        Insert: {
          bix_earned?: number | null
          created_at?: string | null
          id?: string
          reward_date?: string | null
          user_id?: string | null
          xp_earned?: number | null
        }
        Update: {
          bix_earned?: number | null
          created_at?: string | null
          id?: string
          reward_date?: string | null
          user_id?: string | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      missions: {
        Row: {
          cooldown_hours: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          level_required: number | null
          mission_type: string | null
          name: string | null
          xp_reward: number | null
        }
        Insert: {
          cooldown_hours?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          level_required?: number | null
          mission_type?: string | null
          name?: string | null
          xp_reward?: number | null
        }
        Update: {
          cooldown_hours?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          level_required?: number | null
          mission_type?: string | null
          name?: string | null
          xp_reward?: number | null
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
      referrals: {
        Row: {
          created_at: string
          id: string
          qualified: boolean
          qualified_at: string | null
          referred_device_id: string | null
          referred_id: string
          referred_ip: string | null
          referrer_id: string
          referrer_ip: string | null
          reward_granted: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          qualified?: boolean
          qualified_at?: string | null
          referred_device_id?: string | null
          referred_id: string
          referred_ip?: string | null
          referrer_id: string
          referrer_ip?: string | null
          reward_granted?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          qualified?: boolean
          qualified_at?: string | null
          referred_device_id?: string | null
          referred_id?: string
          referred_ip?: string | null
          referrer_id?: string
          referrer_ip?: string | null
          reward_granted?: boolean
        }
        Relationships: []
      }
      reward_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          reference_id: string | null
          reference_type: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string
        }
        Relationships: []
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
      seasons: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          name: string | null
          start_date: string | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          start_date?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          start_date?: string | null
        }
        Relationships: []
      }
      spin_records: {
        Row: {
          created_at: string
          id: string
          reward_amount: number
          spun_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reward_amount?: number
          spun_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reward_amount?: number
          spun_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stakes: {
        Row: {
          accrued_reward: number
          amount: number
          completed_at: string | null
          created_at: string
          id: string
          last_accrual_at: string
          matures_at: string
          plan_id: string
          staked_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accrued_reward?: number
          amount: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_accrual_at?: string
          matures_at: string
          plan_id: string
          staked_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accrued_reward?: number
          amount?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_accrual_at?: string
          matures_at?: string
          plan_id?: string
          staked_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "staking_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      staking_plans: {
        Row: {
          apy_rate: number
          created_at: string
          duration_days: number
          early_unstake_penalty: number
          id: string
          is_active: boolean
          max_amount: number | null
          min_amount: number
          name: string
          updated_at: string
        }
        Insert: {
          apy_rate?: number
          created_at?: string
          duration_days: number
          early_unstake_penalty?: number
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number
          name: string
          updated_at?: string
        }
        Update: {
          apy_rate?: number
          created_at?: string
          duration_days?: number
          early_unstake_penalty?: number
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_attempts: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          ip_address: string | null
          proof_text: string | null
          proof_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suspicious: boolean | null
          task_id: string
          user_id: string
          visit_token: string | null
          watch_seconds: number | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          ip_address?: string | null
          proof_text?: string | null
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suspicious?: boolean | null
          task_id: string
          user_id: string
          visit_token?: string | null
          watch_seconds?: number | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          ip_address?: string | null
          proof_text?: string | null
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suspicious?: boolean | null
          task_id?: string
          user_id?: string
          visit_token?: string | null
          watch_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attempts_task_id_fkey"
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
          max_attempts: number | null
          max_completions_per_user: number | null
          name: string
          required_seconds: number | null
          requirements: Json | null
          reward_points: number
          start_date: string | null
          target_url: string | null
          task_type: Database["public"]["Enums"]["activity_type"]
          total_budget: number | null
          total_claimed: number
          updated_at: string
          verification_rules: Json | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          max_attempts?: number | null
          max_completions_per_user?: number | null
          name: string
          required_seconds?: number | null
          requirements?: Json | null
          reward_points?: number
          start_date?: string | null
          target_url?: string | null
          task_type?: Database["public"]["Enums"]["activity_type"]
          total_budget?: number | null
          total_claimed?: number
          updated_at?: string
          verification_rules?: Json | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          max_attempts?: number | null
          max_completions_per_user?: number | null
          name?: string
          required_seconds?: number | null
          requirements?: Json | null
          reward_points?: number
          start_date?: string | null
          target_url?: string | null
          task_type?: Database["public"]["Enums"]["activity_type"]
          total_budget?: number | null
          total_claimed?: number
          updated_at?: string
          verification_rules?: Json | null
          video_url?: string | null
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
      user_achievements: {
        Row: {
          achievement_id: string | null
          id: string
          unlocked_at: string | null
          user_id: string | null
        }
        Insert: {
          achievement_id?: string | null
          id?: string
          unlocked_at?: string | null
          user_id?: string | null
        }
        Update: {
          achievement_id?: string | null
          id?: string
          unlocked_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_missions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          mission_id: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          mission_id?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          mission_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_missions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          admin_role: string
          avatar_url: string | null
          badge_color: string | null
          badge_icon: string | null
          badge_title: string | null
          bio: string | null
          bix: number | null
          bix_balance: number
          boost_expires_at: string | null
          converted_xp: number
          created_at: string | null
          current_level: number
          display_name: string | null
          id: string
          is_admin: boolean
          join_date: string | null
          last_active_date: string | null
          last_username_change: string | null
          level: number
          level_name: string
          longest_streak: number | null
          season_xp: number | null
          streak_count: number | null
          total_bix: number
          total_bix_earned: number | null
          total_xp: number
          total_xp_earned: number | null
          username: string
          weekly_xp: number | null
          xp: number
          xp_multiplier: number | null
        }
        Insert: {
          admin_role?: string
          avatar_url?: string | null
          badge_color?: string | null
          badge_icon?: string | null
          badge_title?: string | null
          bio?: string | null
          bix?: number | null
          bix_balance?: number
          boost_expires_at?: string | null
          converted_xp?: number
          created_at?: string | null
          current_level?: number
          display_name?: string | null
          id: string
          is_admin?: boolean
          join_date?: string | null
          last_active_date?: string | null
          last_username_change?: string | null
          level?: number
          level_name?: string
          longest_streak?: number | null
          season_xp?: number | null
          streak_count?: number | null
          total_bix?: number
          total_bix_earned?: number | null
          total_xp?: number
          total_xp_earned?: number | null
          username?: string
          weekly_xp?: number | null
          xp?: number
          xp_multiplier?: number | null
        }
        Update: {
          admin_role?: string
          avatar_url?: string | null
          badge_color?: string | null
          badge_icon?: string | null
          badge_title?: string | null
          bio?: string | null
          bix?: number | null
          bix_balance?: number
          boost_expires_at?: string | null
          converted_xp?: number
          created_at?: string | null
          current_level?: number
          display_name?: string | null
          id?: string
          is_admin?: boolean
          join_date?: string | null
          last_active_date?: string | null
          last_username_change?: string | null
          level?: number
          level_name?: string
          longest_streak?: number | null
          season_xp?: number | null
          streak_count?: number | null
          total_bix?: number
          total_bix_earned?: number | null
          total_xp?: number
          total_xp_earned?: number | null
          username?: string
          weekly_xp?: number | null
          xp?: number
          xp_multiplier?: number | null
        }
        Relationships: []
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
      withdrawals: {
        Row: {
          amount: number | null
          created_at: string | null
          id: string
          network: string | null
          status: string | null
          user_id: string | null
          wallet_address: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id?: string
          network?: string | null
          status?: string | null
          user_id?: string | null
          wallet_address?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          network?: string | null
          status?: string | null
          user_id?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leaderboard_season: {
        Row: {
          display_name: string | null
          rank: number | null
          season_xp: number | null
          username: string | null
        }
        Relationships: []
      }
      leaderboard_total: {
        Row: {
          current_level: number | null
          display_name: string | null
          rank: number | null
          total_xp: number | null
          username: string | null
        }
        Relationships: []
      }
      leaderboard_weekly: {
        Row: {
          display_name: string | null
          rank: number | null
          username: string | null
          weekly_xp: number | null
        }
        Relationships: []
      }
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
      activate_boost: {
        Args: { hours: number; multiplier: number }
        Returns: string
      }
      admin_grant_bix: {
        Args: { p_bix: number; p_user: string }
        Returns: undefined
      }
      admin_grant_reward_bulk: {
        Args: { p_items: Json; p_reason?: string }
        Returns: Json
      }
      admin_grant_reward_single: {
        Args: {
          p_bix?: number
          p_description?: string
          p_reason?: string
          p_target_user_id: string
          p_xp?: number
        }
        Returns: Json
      }
      admin_grant_xp: {
        Args: { p_user: string; p_xp: number }
        Returns: undefined
      }
      admin_list_users: {
        Args: never
        Returns: {
          admin_role: string
          avatar_url: string | null
          badge_color: string | null
          badge_icon: string | null
          badge_title: string | null
          bio: string | null
          bix: number | null
          bix_balance: number
          boost_expires_at: string | null
          converted_xp: number
          created_at: string | null
          current_level: number
          display_name: string | null
          id: string
          is_admin: boolean
          join_date: string | null
          last_active_date: string | null
          last_username_change: string | null
          level: number
          level_name: string
          longest_streak: number | null
          season_xp: number | null
          streak_count: number | null
          total_bix: number
          total_bix_earned: number | null
          total_xp: number
          total_xp_earned: number | null
          username: string
          weekly_xp: number | null
          xp: number
          xp_multiplier: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_update_setting: {
        Args: { p_key: string; p_value: string }
        Returns: undefined
      }
      approve_withdrawal: { Args: { wid: string }; Returns: string }
      award_xp: {
        Args: { user_id: string; xp_amount: number }
        Returns: undefined
      }
      change_username: { Args: { new_username: string }; Returns: string }
      check_achievements: { Args: never; Returns: string }
      claim_daily_reward:
        | { Args: never; Returns: Json }
        | { Args: { p_user_id: string }; Returns: Json }
      complete_mission: { Args: { mission_uuid: string }; Returns: string }
      convert_xp_to_bix: { Args: { user_id: string }; Returns: undefined }
      expire_boosts: { Args: never; Returns: string }
      get_active_season: { Args: never; Returns: string }
      get_admin_stats: {
        Args: never
        Returns: {
          active_stakes: number
          pending_claims: number
          rewards_distributed: number
          total_users: number
          tvl_locked: number
        }[]
      }
      get_leaderboard: {
        Args: never
        Returns: {
          level: number
          level_name: string
          rank: number
          user_id: string
          username: string
          xp: number
        }[]
      }
      has_admin_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      progression_ensure_user_row: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      reject_withdrawal: { Args: { wid: string }; Returns: string }
      request_withdrawal: {
        Args: { net: string; wallet: string; withdraw_amount: number }
        Returns: string
      }
      reset_season: { Args: never; Returns: string }
      reset_weekly: { Args: never; Returns: string }
      sanitize_platform_username: {
        Args: { p_input: string; p_user_id: string }
        Returns: string
      }
      update_badge: { Args: never; Returns: undefined }
      update_profile: {
        Args: { new_bio: string; new_display: string }
        Returns: string
      }
      update_streak: { Args: never; Returns: string }
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
