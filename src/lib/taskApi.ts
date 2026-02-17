import { supabase } from "@/integrations/supabase/client";

export async function invokeTaskOperation(action: string, data: Record<string, unknown> = {}) {
  const { data: result, error } = await supabase.functions.invoke("task-operations", {
    body: { action, ...data },
  });
  if (error) throw error;
  if (result?.error) throw new Error(result.error);
  return result;
}
