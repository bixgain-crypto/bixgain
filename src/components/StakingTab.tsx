import { invokeStaking } from "@/lib/stakingApi";
import { useAppData } from "@/context/AppDataContext";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useState } from "react";
import {
  Rocket, Lock, Unlock, Clock, Coins, TrendingUp,
  CheckCircle2, AlertTriangle, Loader2, Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

interface StakingPlan {
  id: string;
  name: string;
  duration_days: number;
  apy_rate: number;
  min_amount: number;
  max_amount: number | null;
  early_unstake_penalty: number;
}

interface Stake {
  id: string;
  amount: number;
  accrued_reward: number;
  status: string;
  staked_at: string;
  matures_at: string;
  completed_at: string | null;
  staking_plans: StakingPlan;
}

export default function StakingTab() {
  const { wallet } = useAuth();
  const {
    stakes,
    stakingPlans,
    loading: appLoading,
    refreshStakes,
    refreshWallet,
    refreshUserProfile,
    refreshAdminStats,
  } = useAppData();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const plans = (stakingPlans || []) as StakingPlan[];
  const userStakes = (stakes || []) as Stake[];
  const activeStakes = userStakes.filter((s) => s.status === "active");
  const totalStaked = activeStakes.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalRewards = activeStakes.reduce((sum, s) => sum + Number(s.accrued_reward), 0);

  const handleStake = async () => {
    if (!selectedPlan || !stakeAmount) return;
    const amount = parseFloat(stakeAmount);
    const plan = plans.find((p) => p.id === selectedPlan);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (plan && amount < plan.min_amount) { toast.error(`Minimum stake for ${plan.name} is ${plan.min_amount} BIX`); return; }
    if (plan?.max_amount && amount > plan.max_amount) { toast.error(`Maximum stake for ${plan.name} is ${plan.max_amount} BIX`); return; }
    if (amount > Number(wallet?.balance || 0)) { toast.error("Insufficient balance"); return; }
    setLoading(true);
    try {
      await invokeStaking("create_stake", { plan_id: selectedPlan, amount });
      toast.success(`Staked ${amount} BIX successfully!`);
      setSelectedPlan(null);
      setStakeAmount("");
      await Promise.all([refreshStakes(), refreshWallet(), refreshUserProfile(), refreshAdminStats()]);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Stake failed");
    }
    setLoading(false);
  };

  const handleUnstake = async (stakeId: string) => {
    setLoading(true);
    try {
      const res = await invokeStaking("unstake", { stake_id: stakeId });
      if (res.early) {
        toast.success(`Unstaked early. Returned ${res.returned.toFixed(2)} BIX (penalty: ${res.penalty.toFixed(2)})`);
      } else {
        toast.success(`Stake completed! Returned ${res.returned.toFixed(2)} BIX`);
      }
      await Promise.all([refreshStakes(), refreshWallet(), refreshUserProfile(), refreshAdminStats()]);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unstake failed");
    }
    setLoading(false);
  };

  const handleClaimRewards = async (stakeId: string) => {
    setLoading(true);
    try {
      const res = await invokeStaking("claim_rewards", { stake_id: stakeId });
      toast.success(`Claimed ${res.claimed.toFixed(2)} BIX!`);
      await Promise.all([refreshStakes(), refreshWallet(), refreshUserProfile(), refreshAdminStats()]);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Claim failed");
    }
    setLoading(false);
  };

  const getProgress = (stake: Stake) => {
    const start = new Date(stake.staked_at).getTime();
    const end = new Date(stake.matures_at).getTime();
    const now = Date.now();
    return Math.min(100, ((now - start) / (end - start)) * 100);
  };

  const getDaysLeft = (stake: Stake) => {
    const diff = new Date(stake.matures_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-lg p-5 text-center">
          <Lock className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold font-mono">{totalStaked.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Staked</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-lg p-5 text-center">
          <TrendingUp className="h-5 w-5 text-success mx-auto mb-2" />
          <p className="text-2xl font-bold font-mono text-success">{totalRewards.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Accrued Rewards</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-lg p-5 text-center">
          <Rocket className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold font-mono">{activeStakes.length}</p>
          <p className="text-xs text-muted-foreground">Active Stakes</p>
        </motion.div>
      </div>

      {/* Staking plans */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Staking Plans</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedPlan(selectedPlan === plan.id ? null : plan.id)}
              className={`glass rounded-lg p-4 cursor-pointer transition-all ${
                selectedPlan === plan.id ? "ring-2 ring-primary glow-gold-sm" : "hover:border-primary/50"
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-semibold text-sm">{plan.name}</h4>
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-mono font-bold">
                  {plan.apy_rate}% APY
                </span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Duration</span>
                  <span className="font-mono">{plan.duration_days}d</span>
                </div>
                <div className="flex justify-between">
                  <span>Min Stake</span>
                  <span className="font-mono">{Number(plan.min_amount).toLocaleString()}</span>
                </div>
                {plan.max_amount && (
                  <div className="flex justify-between">
                    <span>Max Stake</span>
                    <span className="font-mono">{Number(plan.max_amount).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Early Penalty</span>
                  <span className="font-mono text-destructive">{(plan.early_unstake_penalty * 100).toFixed(0)}%</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Stake form */}
      <AnimatePresence>
        {selectedPlan && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-lg p-5 max-w-xl"
          >
            <h4 className="font-semibold mb-3">
              Stake BIX - {plans.find((p) => p.id === selectedPlan)?.name}
            </h4>
            <div className="space-y-3">
              <div>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="Amount to stake"
                  className="bg-secondary border-border font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Available: {Number(wallet?.balance || 0).toLocaleString()} BIX
                </p>
              </div>
              {stakeAmount && parseFloat(stakeAmount) > 0 && (
                <div className="text-xs text-muted-foreground bg-secondary/50 rounded-md p-3 space-y-1">
                  <div className="flex justify-between">
                    <span>Estimated daily reward</span>
                    <span className="font-mono text-success">
                      +{((parseFloat(stakeAmount) * (plans.find(p => p.id === selectedPlan)?.apy_rate || 0) / 100) / 365).toFixed(4)} BIX
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated total reward</span>
                    <span className="font-mono text-success">
                      +{((parseFloat(stakeAmount) * (plans.find(p => p.id === selectedPlan)?.apy_rate || 0) / 100) * (plans.find(p => p.id === selectedPlan)?.duration_days || 0) / 365).toFixed(2)} BIX
                    </span>
                  </div>
                </div>
              )}
              <Button
                onClick={handleStake}
                disabled={loading || !stakeAmount}
                className="w-full bg-gradient-gold font-semibold"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                Stake BIX
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active stakes */}
      {userStakes.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Your Stakes</h3>
          <div className="space-y-3">
            {userStakes.map((stake, i) => {
              const isActive = stake.status === "active";
              const progress = getProgress(stake);
              const daysLeft = getDaysLeft(stake);
              const isMature = daysLeft === 0 && isActive;

              return (
                <motion.div
                  key={stake.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`glass rounded-lg p-4 ${!isActive ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {isActive ? (
                        <Lock className="h-4 w-4 text-primary" />
                      ) : stake.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      )}
                      <span className="font-semibold text-sm">{stake.staking_plans?.name || "Stake"}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isActive ? "bg-primary/20 text-primary" :
                        stake.status === "completed" ? "bg-success/20 text-success" :
                        "bg-warning/20 text-warning"
                      }`}>
                        {stake.status}
                      </span>
                    </div>
                    <div className="text-right ml-auto">
                      <p className="font-mono text-sm font-bold">{Number(stake.amount).toLocaleString()} BIX</p>
                      {Number(stake.accrued_reward) > 0 && (
                        <p className="font-mono text-xs text-success">+{Number(stake.accrued_reward).toFixed(2)} earned</p>
                      )}
                    </div>
                  </div>

                  {isActive && (
                    <>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>{new Date(stake.staked_at).toLocaleDateString()}</span>
                        <span>{daysLeft > 0 ? `${daysLeft}d left` : "Matured!"}</span>
                        <span>{new Date(stake.matures_at).toLocaleDateString()}</span>
                      </div>
                      <Progress value={progress} className="h-1.5 mb-3" />
                      <div className="flex gap-2">
                        {Number(stake.accrued_reward) > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleClaimRewards(stake.id)}
                            disabled={loading}
                            className="flex-1"
                          >
                            <Gift className="h-3.5 w-3.5 mr-1" /> Claim {Number(stake.accrued_reward).toFixed(2)}
                          </Button>
                        )}
                        <Button
                          variant={isMature ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleUnstake(stake.id)}
                          disabled={loading}
                          className={`flex-1 ${isMature ? "bg-gradient-gold font-semibold" : ""}`}
                        >
                          <Unlock className="h-3.5 w-3.5 mr-1" />
                          {isMature ? "Withdraw" : "Unstake Early"}
                        </Button>
                      </div>
                    </>
                  )}

                  {!isActive && stake.completed_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {stake.status === "completed" ? "Completed" : "Unstaked"} on {new Date(stake.completed_at).toLocaleDateString()}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
      {appLoading.stakes && (
        <p className="text-sm text-muted-foreground">Refreshing staking data...</p>
      )}
    </div>
  );
}


