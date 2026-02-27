import { AppLayout } from "@/components/AppLayout";
import { XpProgressBar } from "@/components/XpProgressBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppData } from "@/context/AppDataContext";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Copy,
  Gift,
  Link2,
  Send,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type ReferralRow = {
  id: string;
  referrer_id: string;
  referred_id: string;
  qualified: boolean;
  qualified_at: string | null;
  reward_granted: boolean;
  created_at: string;
};

type ReferralMilestone = {
  id: string;
  name: string;
  target: number;
  xpReward: number;
};

const MILESTONES: ReferralMilestone[] = [
  { id: "invite-1", name: "Invite 1 Friend", target: 1, xpReward: 120 },
  { id: "invite-3", name: "Invite 3 Friends", target: 3, xpReward: 220 },
  { id: "invite-5", name: "Invite 5 Friends", target: 5, xpReward: 360 },
];

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function getReferralStatus(row: ReferralRow): { label: string; className: string } {
  if (row.reward_granted) {
    return {
      label: "Rewarded",
      className: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10",
    };
  }
  if (row.qualified) {
    return {
      label: "Qualified",
      className: "text-sky-300 border-sky-400/30 bg-sky-500/10",
    };
  }
  return {
    label: "Pending",
    className: "text-amber-300 border-amber-400/30 bg-amber-500/10",
  };
}

export default function Referrals() {
  const { session } = useAuth();
  const { referralCode, referrals, activities, loading } = useAppData();

  if (!session?.user?.id) {
    return (
      <AppLayout>
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
          Sign in to access your referral engine.
        </div>
      </AppLayout>
    );
  }

  const referralRows = (referrals ?? []) as unknown as ReferralRow[];
  const totalInvites = referralRows.length;
  const qualifiedInvites = referralRows.filter((row) => row.qualified).length;
  const pendingInvites = totalInvites - qualifiedInvites;
  const conversionRate = totalInvites > 0 ? Math.round((qualifiedInvites / totalInvites) * 100) : 0;
  const referralRewardsBix = (activities ?? []).reduce((sum, row) => {
    if (row.activity_type !== "referral") return sum;
    return sum + Number(row.points_earned || 0);
  }, 0);

  const baseUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
  const referralLink = referralCode
    ? `${String(baseUrl).replace(/\/$/, "")}/auth?ref=${encodeURIComponent(referralCode)}`
    : "";

  const shareMessage = "Join me on Bixgain. Compete, rank up, and grow your XP.";
  const encodedLink = encodeURIComponent(referralLink);
  const encodedMessage = encodeURIComponent(shareMessage);

  const shareTargets = [
    {
      label: "Telegram",
      url: `https://t.me/share/url?url=${encodedLink}&text=${encodedMessage}`,
    },
    {
      label: "X",
      url: `https://x.com/intent/tweet?text=${encodeURIComponent(`${shareMessage} ${referralLink}`)}`,
    },
    {
      label: "WhatsApp",
      url: `https://wa.me/?text=${encodeURIComponent(`${shareMessage} ${referralLink}`)}`,
    },
  ];

  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Clipboard not available");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.section
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 sm:p-8 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.10),transparent_45%)]" />
          <div className="relative space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                  <Users className="h-7 w-7 text-primary" />
                  Referral Engine
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Grow your network, unlock referral milestones, and accelerate platform growth.
                </p>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-right">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Referral Code</p>
                <p className="font-mono text-lg font-bold text-primary">
                  {loading.referralCode ? "Loading..." : (referralCode || "-")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Invites</p>
                <p className="mt-1 text-2xl font-bold">{totalInvites}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Qualified</p>
                <p className="mt-1 text-2xl font-bold text-primary">{qualifiedInvites}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Conversion</p>
                <p className="mt-1 text-2xl font-bold">{conversionRate}%</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Bix Earned</p>
                <p className="mt-1 text-2xl font-bold text-gradient-gold">{referralRewardsBix.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </motion.section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="glass rounded-2xl p-5 space-y-4"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Share Your Link
            </h2>
            <div className="flex gap-2">
              <Input value={referralLink} readOnly className="bg-secondary border-border font-mono text-xs sm:text-sm" />
              <Button
                type="button"
                variant="outline"
                className="border-primary/30 text-primary shrink-0"
                onClick={() => copyToClipboard(referralLink, "Referral link copied")}
                disabled={!referralLink}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {shareTargets.map((target) => (
                <Button
                  key={target.label}
                  type="button"
                  variant="secondary"
                  className="rounded-full bg-secondary/60 hover:bg-secondary"
                  onClick={() => window.open(target.url, "_blank", "noopener,noreferrer")}
                  disabled={!referralLink}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {target.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Invite flow: Friend signs up with your code, completes first approved mission, referral becomes qualified.
            </p>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="glass rounded-2xl p-5 space-y-4"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Growth Checklist
            </h2>
            <div className="space-y-2">
              <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3 flex items-center justify-between">
                <p className="text-sm">Referral code activated</p>
                <CheckCircle2 className={`h-4 w-4 ${referralCode ? "text-emerald-300" : "text-muted-foreground"}`} />
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3 flex items-center justify-between">
                <p className="text-sm">First invite linked</p>
                <CheckCircle2 className={`h-4 w-4 ${totalInvites >= 1 ? "text-emerald-300" : "text-muted-foreground"}`} />
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3 flex items-center justify-between">
                <p className="text-sm">First referral qualified</p>
                <CheckCircle2 className={`h-4 w-4 ${qualifiedInvites >= 1 ? "text-emerald-300" : "text-muted-foreground"}`} />
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3 flex items-center justify-between">
                <p className="text-sm">Three qualified referrals</p>
                <CheckCircle2 className={`h-4 w-4 ${qualifiedInvites >= 3 ? "text-emerald-300" : "text-muted-foreground"}`} />
              </div>
            </div>
          </motion.section>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="glass rounded-2xl p-5"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-primary" />
            Referral Missions
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {MILESTONES.map((milestone) => {
              const current = Math.min(qualifiedInvites, milestone.target);
              const progress = Math.max(0, Math.min(100, (current / milestone.target) * 100));
              const completed = qualifiedInvites >= milestone.target;
              return (
                <div key={milestone.id} className="rounded-xl border border-border/60 bg-secondary/35 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{milestone.name}</p>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        completed
                          ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/10"
                          : "text-muted-foreground border-border/70"
                      }`}
                    >
                      {completed ? "Complete" : "Active"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{`Reward: +${milestone.xpReward} XP`}</p>
                  <p className="text-sm font-mono">{`${current} / ${milestone.target}`}</p>
                  <XpProgressBar value={progress} />
                </div>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="glass rounded-2xl p-5"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Gift className="h-5 w-5 text-primary" />
            Referral Activity
          </h2>
          {loading.referrals ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-secondary/20 p-6 text-center">
              <p className="text-sm text-muted-foreground">Loading referrals...</p>
            </div>
          ) : referralRows.length > 0 ? (
            <div className="space-y-2">
              {referralRows.map((row) => {
                const status = getReferralStatus(row);
                const shortId = row.referred_id.slice(0, 8);
                return (
                  <div
                    key={row.id}
                    className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium">{`Invite ${shortId}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {`Joined ${formatDate(row.created_at)} | Qualified ${formatDate(row.qualified_at)}`}
                      </p>
                    </div>
                    <span className={`text-xs rounded-full border px-2 py-0.5 ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 bg-secondary/20 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No referrals yet. Start sharing your code to activate growth.
              </p>
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-3"
        >
          <div>
            <p className="text-sm font-semibold">Current Funnel</p>
            <p className="text-xs text-muted-foreground">{`${totalInvites} invited | ${pendingInvites} pending | ${qualifiedInvites} qualified`}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Conversion</p>
            <p className="text-xl font-bold">{conversionRate}%</p>
          </div>
        </motion.section>
      </div>
    </AppLayout>
  );
}
