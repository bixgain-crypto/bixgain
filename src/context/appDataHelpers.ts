import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { generateReferralCode } from "@/lib/referrals";
import type { CoreUser, UserRow } from "./appDataTypes";

export function normalizeUser(raw: UserRow | null, session: Session | null): CoreUser | null {
  if (!raw) return null;
  const username =
    raw.username && raw.username.trim().length > 0
      ? raw.username.trim()
      : session?.user?.email?.split("@")[0] || `user-${raw.id.slice(0, 6)}`;

  return {
    ...raw,
    username,
    admin_role: raw.admin_role || "user",
    is_active: (raw as Record<string, unknown>).is_active !== false,
    is_frozen: (raw as Record<string, unknown>).is_frozen === true,
  };
}

export async function ensureReferralCode(userId: string, username: string | null | undefined): Promise<string> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) throw profileError;

  const existing = profile?.referral_code?.trim();
  if (existing) return existing.toUpperCase();

  const baseCode = generateReferralCode(userId, username);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate =
      attempt === 0
        ? baseCode
        : `${baseCode.slice(0, 8)}${Math.floor(1000 + Math.random() * 9000)}`;

    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, referral_code: candidate }, { onConflict: "user_id" });

    if (!error) return candidate;
    if (error.code !== "23505") throw error;
  }

  throw new Error("Unable to generate unique referral code");
}

export function sameSession(a: Session | null, b: Session | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.user?.id === b.user?.id && a.access_token === b.access_token && a.expires_at === b.expires_at;
}
