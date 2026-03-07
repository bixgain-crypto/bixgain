import { AppLayout } from "@/components/AppLayout";
import { useAppData } from "@/context/AppDataContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Wallet as WalletIcon,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Send,
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import StakingTab from "@/components/StakingTab";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Link } from "react-router-dom";

export default function WalletPage() {
  const { session, wallet } = useAuth();
  const {
    rewardTransactions: transactions,
    claims,
    loading,
    refreshClaims,
    refreshAdminStats,
    refreshRewardTransactions,
  } = useAppData();
  const [claimAmount, setClaimAmount] = useState("");

  if (!session?.user?.id) {
    return (
      <AppLayout>
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
          Sign in to access your wallet.
        </div>
      </AppLayout>
    );
  }

  const copyAddress = () => {
    if (wallet?.address) {
      navigator.clipboard.writeText(wallet.address);
      toast.success("Address copied!");
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id || !wallet?.id) return;
    const amount = parseFloat(claimAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (amount > Number(wallet.balance)) { toast.error("Insufficient balance"); return; }
    const { data, error } = await supabase.rpc("create_claim", {
      p_amount: amount,
      p_wallet_id: wallet.id,
    });
    if (error) { toast.error(error.message); }
    else {
      toast.success("Claim submitted for approval!");
      setClaimAmount("");
      await Promise.all([refreshClaims(), refreshRewardTransactions(), refreshAdminStats()]);
    }
  };

  const statusConfig = {
    pending: { icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    approved: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    rejected: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
    cancelled: { icon: XCircle, color: "text-muted-foreground", bg: "bg-muted" },
    processing: { icon: Clock, color: "text-primary", bg: "bg-primary/10" },
  };

  const ComingSoonCard = ({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-8 text-center space-y-4"
    >
      <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}>
        <Icon className="h-12 w-12 text-primary mx-auto" />
      </motion.div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground">{desc}</p>
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3 text-primary animate-pulse-gold" />
        Coming Soon
        <Sparkles className="h-3 w-3 text-primary animate-pulse-gold" />
      </div>
    </motion.div>
  );

  return (
    <AppLayout>
      <div className="space-y-6 lg:space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3">
              <WalletIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              BIX Wallet
            </h1>
            <Link to="/store">
              <Button variant="outline" className="border-primary/30 text-primary">
                <ShoppingBag className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Store</span>
                <span className="sm:hidden">Shop</span>
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Balance card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-6 sm:p-8 glow-gold"
        >
          <p className="text-sm text-muted-foreground mb-2">Total Balance</p>
          <p className="text-3xl sm:text-5xl font-bold font-mono text-gradient-gold">
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
              + {Number(wallet?.pending_balance).toLocaleString()} BIX pending
            </p>
          )}
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="history" className="w-full">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className="bg-secondary/50 border border-border w-max lg:w-full justify-start">
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="send">Send</TabsTrigger>
              <TabsTrigger value="receive">Receive</TabsTrigger>
              <TabsTrigger value="store">Store</TabsTrigger>
              <TabsTrigger value="staking">Staking</TabsTrigger>
            </TabsList>
          </div>

          {/* Transaction History */}
          <TabsContent value="history">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Transaction History</h2>
              {loading.rewardTransactions ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading transactions...</p>
              ) : transactions && transactions.length > 0 ? (
                <div className="space-y-2">
                  {transactions.map((tx) => {
                    const isEarning = ["earn", "bonus", "referral"].includes(tx.transaction_type);
                    return (
                      <div key={tx.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-secondary/50 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`rounded-full p-2 ${isEarning ? "bg-success/10" : "bg-destructive/10"}`}>
                            {isEarning ? <ArrowDownLeft className="h-4 w-4 text-success" /> : <ArrowUpRight className="h-4 w-4 text-destructive" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium capitalize truncate">{tx.transaction_type.replace("_", " ")}</p>
                            <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                          </div>
                        </div>
                        <div className="text-right ml-auto">
                          <p className={`font-mono text-sm font-semibold ${isEarning ? "text-success" : "text-destructive"}`}>
                            {isEarning ? "+" : "-"}{Number(tx.net_amount).toLocaleString()} BIX
                          </p>
                          <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No transactions yet.</p>
              )}
            </motion.div>
          </TabsContent>


