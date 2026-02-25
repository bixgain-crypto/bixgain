import { supabase } from "@/integrations/supabase/client";

export type SpendBixResponse = {
  success: boolean;
  user?: {
    bix_balance: number;
    total_bix: number;
    total_xp: number;
    current_level: number;
    level_name: string;
  };
  error?: string;
};

export async function spendBix(amount: number): Promise<SpendBixResponse> {
  const { data, error } = await supabase.functions.invoke("spend_bix", {
    body: { amount },
  });

  if (error) {
    const fallbackMessage = (error as { message?: string }).message || "Unable to spend Bix";
    throw new Error(fallbackMessage);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as SpendBixResponse;
}
