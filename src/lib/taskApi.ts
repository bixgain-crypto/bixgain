import { supabase } from "@/integrations/supabase/client";

export async function invokeTaskOperation(action: string, data: Record<string, unknown> = {}) {
  const payload = { action, ...data };
  const { data: result, error } = await supabase.functions.invoke("task-operations", {
    body: payload,
  });

  // When an Edge Function responds with a non-2xx status the SDK returns
  // a generic error like "Edge Function returned a non-2xx status code".
  // Try to surface the function's JSON error body for a clearer message.
  if (error) {
    try {
      // `error.details` sometimes contains the raw response body.
      const details = (error as any).details;
      let parsed: any = null;
      if (details && typeof details === "string") {
        try {
          parsed = JSON.parse(details);
        } catch {}
      }

      // If SDK returned data despite the non-2xx, prefer that as the body.
      if (!parsed && result && typeof result === "object") parsed = result;

      const msg = parsed?.error || parsed?.message || (error as any).message || "Edge Function error";
      throw new Error(msg);
    } catch (e) {
      throw error;
    }
  }

  if (result && (result as any).error) throw new Error((result as any).error);
  return result;
}
