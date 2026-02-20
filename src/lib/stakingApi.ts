import { supabase } from "@/integrations/supabase/client";

export async function invokeStaking(action: string, data: Record<string, unknown> = {}) {
  const payload = { action, ...data };
  const { data: result, error } = await supabase.functions.invoke("staking", {
    body: payload,
  });

  if (error) {
    let parsed: any = null;
    try {
      const details = (error as any).details;
      if (details && typeof details === "string") {
        try { parsed = JSON.parse(details); } catch {}
      }
      if (!parsed && result && typeof result === "object") parsed = result;
    } catch {}
    const msg = parsed?.error || (error as any).message || "Staking error";
    throw new Error(msg);
  }

  if (result && (result as any).error) throw new Error((result as any).error);
  return result;
}
