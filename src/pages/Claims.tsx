import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ArrowUpRight, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

export default function Claims() {
  const { session, wallet } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");

  const { data: claims } = useQuery({
    queryKey: ["all-claims", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("claims")
        .select("*")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id || !wallet?.id) return;

    const claimAmount = parseFloat(amount);
    if (isNaN(claimAmount) || claimAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (claimAmount > Number(wallet.balance)) {
      toast.error("Insufficient balance");
      return;
    }

    // Simple 5% tax calculation
    const taxAmount = claimAmount * 0.05;
    const netAmount = claimAmount - taxAmount;

    const { error } = await supabase.from("claims").insert({
      user_id: session.user.id,
      amount: claimAmount,
      tax_amount: taxAmount,
      net_amount: netAmount,
      wallet_id: wallet.id,
      status: "pending",
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Claim submitted for approval!");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["all-claims"] });
    }
  };

  const statusConfig = {
    pending: { icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    approved: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    rejected: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
    cancelled: { icon: XCircle, color: "text-muted-foreground", bg: "bg-muted" },
    processing: { icon: Clock, color: "text-primary", bg: "bg-primary/10" },
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ArrowUpRight className="h-8 w-8 text-primary" />
            Reward Claims
          </h1>
          <p className="mt-1 text-muted-foreground">Claim your earned BIX tokens</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-lg p-6 max-w-md"
        >
          <h2 className="text-lg font-semibold mb-4">New Claim</h2>
          <form onSubmit={handleClaim} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (BIX)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount to claim"
                className="bg-secondary border-border font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Available: {Number(wallet?.balance || 0).toLocaleString()} BIX · 5% tax applies
              </p>
            </div>
            <Button type="submit" className="w-full bg-gradient-gold font-semibold">
              Submit Claim
            </Button>
          </form>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-lg p-6"
        >
          <h2 className="text-lg font-semibold mb-4">Claim History</h2>
          {claims && claims.length > 0 ? (
            <div className="space-y-2">
              {claims.map((claim) => {
                const config = statusConfig[claim.status as keyof typeof statusConfig];
                const StatusIcon = config.icon;
                return (
                  <div key={claim.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full p-2 ${config.bg}`}>
                        <StatusIcon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">{claim.status}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(claim.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold">
                        {Number(claim.net_amount).toLocaleString()} BIX
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Gross: {Number(claim.amount).toLocaleString()} · Tax: {Number(claim.tax_amount).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No claims yet.</p>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
