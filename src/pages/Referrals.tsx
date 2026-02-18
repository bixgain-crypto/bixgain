import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Users, Copy, Gift, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export default function Referrals() {
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    if (profile?.referral_code) {
      setReferralCode(profile.referral_code);
    } else if (session?.user?.id && !profile?.referral_code) {
      // Generate referral code if not exists
      const code = `BIX${session.user.id.substring(0, 8).toUpperCase()}`;
      supabase
        .from("profiles")
        .update({ referral_code: code })
        .eq("user_id", session.user.id)
        .then(() => {
          setReferralCode(code);
          queryClient.invalidateQueries({ queryKey: ["profile"] });
        });
    }
  }, [profile, session, queryClient]);

  const { data: referrals } = useQuery({
    queryKey: ["referrals", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("referrals")
        .select("id, referred_id, qualified, qualified_at, reward_granted, created_at")
        .eq("referrer_id", session!.user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: referralEarnings } = useQuery({
    queryKey: ["referral-earnings", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("points_earned")
        .eq("user_id", session!.user.id)
        .eq("activity_type", "referral");
      return data?.reduce((sum, a) => sum + Number(a.points_earned), 0) || 0;
    },
  });

  const referralLink = `${window.location.origin}/auth?ref=${referralCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied!");
  };

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast.success("Referral code copied!");
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Referral Program
          </h1>
          <p className="mt-1 text-muted-foreground">
            Invite friends and earn 50 BIX for each signup!
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-lg p-6 text-center">
            <Users className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-3xl font-bold font-mono">{referrals?.length || 0}</p>
            <p className="text-sm text-muted-foreground">Friends Referred</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-lg p-6 text-center">
            <Gift className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-3xl font-bold font-mono text-gradient-gold">{referralEarnings?.toLocaleString() || 0}</p>
            <p className="text-sm text-muted-foreground">BIX Earned</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-lg p-6 text-center">
            <Share2 className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-3xl font-bold font-mono">50</p>
            <p className="text-sm text-muted-foreground">BIX Per Referral</p>
          </motion.div>
        </div>

        {/* Referral Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass rounded-lg p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold">Your Referral Link</h2>
          <div className="flex gap-2">
            <Input
              value={referralLink}
              readOnly
              className="bg-secondary border-border font-mono text-sm"
            />
            <Button onClick={copyLink} variant="outline" className="border-primary/30 text-primary shrink-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">Your Code:</p>
            <button
              onClick={copyCode}
              className="flex items-center gap-2 font-mono text-primary font-bold bg-primary/10 px-3 py-1 rounded-md hover:bg-primary/20 transition-colors"
            >
              {referralCode}
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </motion.div>

        {/* Referred users */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-lg p-6"
        >
          <h2 className="text-lg font-semibold mb-4">Your Referrals</h2>
          {referrals && referrals.length > 0 ? (
            <div className="space-y-2">
              {referrals.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Referred User</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`font-mono text-sm ${r.qualified ? "text-primary" : "text-muted-foreground"}`}>
                    {r.qualified ? "+50 BIX" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No referrals yet. Share your link to start earning!
            </p>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
