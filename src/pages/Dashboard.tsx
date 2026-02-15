import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Activity, Clock, CheckCircle2, XCircle } from "lucide-react";

export default function Dashboard() {
  const { profile, wallet, session } = useAuth();

  const { data: activities } = useQuery({
    queryKey: ["recent-activities", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const { data: claims } = useQuery({
    queryKey: ["recent-claims", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("claims")
        .select("*")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const statusIcon = {
    pending: <Clock className="h-4 w-4 text-warning" />,
    approved: <CheckCircle2 className="h-4 w-4 text-success" />,
    rejected: <XCircle className="h-4 w-4 text-destructive" />,
    cancelled: <XCircle className="h-4 w-4 text-muted-foreground" />,
    processing: <Clock className="h-4 w-4 text-primary" />,
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold">
            Welcome, <span className="text-gradient-gold">{profile?.display_name || "User"}</span>
          </h1>
          <p className="mt-1 text-muted-foreground">Your BIX rewards overview</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="BIX Balance"
            value={Number(wallet?.balance || 0).toLocaleString()}
            subtitle="Available tokens"
            icon="coins"
            delay={0}
          />
          <StatCard
            title="Pending"
            value={Number(wallet?.pending_balance || 0).toLocaleString()}
            subtitle="Awaiting approval"
            icon="wallet"
            delay={0.1}
          />
          <StatCard
            title="Activities"
            value={(activities?.length || 0).toString()}
            subtitle="Recent completions"
            icon="trending"
            delay={0.2}
          />
          <StatCard
            title="Claims"
            value={(claims?.length || 0).toString()}
            subtitle="Reward claims"
            icon="gift"
            delay={0.3}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Activities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass rounded-lg p-6"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent Activities
            </h2>
            {activities && activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{a.description || a.activity_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="font-mono text-sm text-primary">
                      +{Number(a.points_earned).toLocaleString()} BIX
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No activities yet. Complete tasks to earn BIX!</p>
            )}
          </motion.div>

          {/* Recent Claims */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass rounded-lg p-6"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Recent Claims
            </h2>
            {claims && claims.length > 0 ? (
              <div className="space-y-3">
                {claims.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      {statusIcon[c.status as keyof typeof statusIcon]}
                      <div>
                        <p className="text-sm font-medium capitalize">{c.status}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm">{Number(c.net_amount).toLocaleString()} BIX</p>
                      {Number(c.tax_amount) > 0 && (
                        <p className="text-xs text-muted-foreground">Tax: {Number(c.tax_amount).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No claims yet.</p>
            )}
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
