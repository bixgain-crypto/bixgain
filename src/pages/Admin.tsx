import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { awardXp, spendBix, spendXp } from "@/lib/progressionApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, Shield, ShieldAlert, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type LogRow = Record<string, unknown> & {
  id?: string;
  action?: string;
  created_at?: string;
};

function readable(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return "-";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function Admin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [xpAmount, setXpAmount] = useState("");
  const [xpSpendAmount, setXpSpendAmount] = useState("");
  const [bixSpendAmount, setBixSpendAmount] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const { data: adminLogs } = useQuery({
    queryKey: ["admin-logs"],
    enabled: !!user?.is_admin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_logs" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["admin-audit-log"],
    enabled: !!user?.is_admin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_log" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  if (!user?.is_admin) {
    return (
      <AppLayout>
        <div className="glass rounded-2xl p-8 text-center">
          <ShieldAlert className="h-8 w-8 text-warning mx-auto mb-3" />
          <p className="font-semibold">Admin access required</p>
          <p className="text-sm text-muted-foreground mt-1">This page is visible only when `is_admin = true`.</p>
        </div>
      </AppLayout>
    );
  }

  const runAction = async (name: string, action: () => Promise<unknown>, successMessage: string) => {
    setBusyAction(name);
    try {
      await action();
      toast.success(successMessage);
      queryClient.invalidateQueries({ queryKey: ["user-core"] });
      queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-log"] });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Admin action failed";
      toast.error(message);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Admin Console
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Role: {user.admin_role || "admin"}
          </p>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-lg font-semibold mb-4">RPC Actions</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-secondary/35 p-4 space-y-2">
              <Label>Award XP</Label>
              <Input value={xpAmount} onChange={(event) => setXpAmount(event.target.value)} placeholder="XP amount" />
              <Button
                disabled={busyAction === "award"}
                onClick={() =>
                  runAction(
                    "award",
                    () => awardXp(Number(xpAmount || 0), user.id),
                    "XP awarded",
                  )
                }
                className="w-full bg-gradient-gold text-primary-foreground"
              >
                {busyAction === "award" ? "Running..." : "Run award_xp"}
              </Button>
            </div>

            <div className="rounded-xl border border-border/60 bg-secondary/35 p-4 space-y-2">
              <Label>Spend XP</Label>
              <Input value={xpSpendAmount} onChange={(event) => setXpSpendAmount(event.target.value)} placeholder="XP amount" />
              <Button
                disabled={busyAction === "spend-xp"}
                onClick={() =>
                  runAction(
                    "spend-xp",
                    () => spendXp(Number(xpSpendAmount || 0)),
                    "XP spent",
                  )
                }
                className="w-full"
                variant="outline"
              >
                {busyAction === "spend-xp" ? "Running..." : "Run spend_xp"}
              </Button>
            </div>

            <div className="rounded-xl border border-border/60 bg-secondary/35 p-4 space-y-2">
              <Label>Spend Bix</Label>
              <Input value={bixSpendAmount} onChange={(event) => setBixSpendAmount(event.target.value)} placeholder="Bix amount" />
              <Button
                disabled={busyAction === "spend-bix"}
                onClick={() =>
                  runAction(
                    "spend-bix",
                    () => spendBix(Number(bixSpendAmount || 0)),
                    "Bix spent",
                  )
                }
                className="w-full"
                variant="outline"
              >
                {busyAction === "spend-bix" ? "Running..." : "Run spend_bix"}
              </Button>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            Admin Logs
          </h2>
          <div className="space-y-2 max-h-[360px] overflow-auto">
            {(adminLogs ?? []).length > 0 ? (
              (adminLogs ?? []).map((row, index) => (
                <div key={String(row.id || `admin-log-${index}`)} className="rounded-xl border border-border/60 bg-secondary/35 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{readable(row, "action")}</p>
                    <p className="text-xs text-muted-foreground">{readable(row, "created_at")}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{readable(row, "details")}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No admin logs found.</p>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Wallet className="h-5 w-5 text-primary" />
            Audit Logs
          </h2>
          <div className="space-y-2 max-h-[360px] overflow-auto">
            {(auditLogs ?? []).length > 0 ? (
              (auditLogs ?? []).map((row, index) => (
                <div key={String(row.id || `audit-log-${index}`)} className="rounded-xl border border-border/60 bg-secondary/35 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{readable(row, "action")}</p>
                    <p className="text-xs text-muted-foreground">{readable(row, "created_at")}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{readable(row, "target_table")}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No audit logs found.</p>
            )}
          </div>
        </motion.section>
      </div>
    </AppLayout>
  );
}
