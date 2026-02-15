import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, Copy } from "lucide-react";
import { toast } from "sonner";

export default function WalletPage() {
  const { session, wallet } = useAuth();

  const { data: transactions } = useQuery({
    queryKey: ["reward-transactions", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("reward_transactions")
        .select("*")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const copyAddress = () => {
    if (wallet?.address) {
      navigator.clipboard.writeText(wallet.address);
      toast.success("Address copied!");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <WalletIcon className="h-8 w-8 text-primary" />
            BIX Wallet
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-8 glow-gold"
        >
          <p className="text-sm text-muted-foreground mb-2">Total Balance</p>
          <p className="text-5xl font-bold font-mono text-gradient-gold">
            {Number(wallet?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-lg text-muted-foreground mt-1">BIX</p>
          {wallet?.address && (
            <button
              onClick={copyAddress}
              className="mt-4 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
            >
              {wallet.address.substring(0, 8)}...{wallet.address.substring(wallet.address.length - 6)}
              <Copy className="h-3 w-3" />
            </button>
          )}
          {Number(wallet?.pending_balance || 0) > 0 && (
            <p className="mt-2 text-sm text-warning">
              + {Number(wallet.pending_balance).toLocaleString()} BIX pending
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-lg p-6"
        >
          <h2 className="text-lg font-semibold mb-4">Transaction History</h2>
          {transactions && transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const isEarning = ["earn", "bonus", "referral"].includes(tx.transaction_type);
                return (
                  <div key={tx.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full p-2 ${isEarning ? "bg-success/10" : "bg-destructive/10"}`}>
                        {isEarning ? (
                          <ArrowDownLeft className="h-4 w-4 text-success" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">{tx.transaction_type.replace("_", " ")}</p>
                        <p className="text-xs text-muted-foreground">{tx.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-sm font-semibold ${isEarning ? "text-success" : "text-destructive"}`}>
                        {isEarning ? "+" : "-"}{Number(tx.net_amount).toLocaleString()} BIX
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No transactions yet.</p>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
