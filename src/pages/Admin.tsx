import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Shield, Users, FileText, AlertTriangle, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Admin() {
  const { session } = useAuth();

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_users")
        .select("id, role_id")
        .eq("user_id", session!.user.id)
        .eq("is_active", true)
        .maybeSingle();
      return !!data;
    },
  });

  const { data: pendingClaims } = useQuery({
    queryKey: ["admin-pending-claims"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("claims")
        .select("*, profiles!claims_user_id_fkey(display_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["admin-audit-logs"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const { data: fraudFlags } = useQuery({
    queryKey: ["admin-fraud-flags"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("fraud_flags")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="glass rounded-lg p-12 text-center">
            <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Admin Access Required</h2>
            <p className="text-muted-foreground">You don't have admin privileges.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Admin Panel
          </h1>
          <p className="mt-1 text-muted-foreground">Platform management & oversight</p>
        </motion.div>

        <Tabs defaultValue="claims" className="space-y-6">
          <TabsList className="bg-secondary">
            <TabsTrigger value="claims" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <FileText className="h-4 w-4 mr-2" />
              Claims ({pendingClaims?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="fraud" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Fraud ({fraudFlags?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Settings className="h-4 w-4 mr-2" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="claims">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Pending Claims</h2>
              {pendingClaims && pendingClaims.length > 0 ? (
                <div className="space-y-3">
                  {pendingClaims.map((claim) => (
                    <div key={claim.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">
                          {(claim as any).profiles?.display_name || "Unknown User"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(claim.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-semibold">
                          {Number(claim.amount).toLocaleString()} BIX
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Net: {Number(claim.net_amount).toLocaleString()} · Tax: {Number(claim.tax_amount).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No pending claims.</p>
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="fraud">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Open Fraud Flags</h2>
              {fraudFlags && fraudFlags.length > 0 ? (
                <div className="space-y-3">
                  {fraudFlags.map((flag) => (
                    <div key={flag.id} className="flex items-center justify-between rounded-md bg-destructive/5 border border-destructive/20 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{flag.flag_type}</p>
                        <p className="text-xs text-muted-foreground">{flag.reason}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        flag.severity === "high" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"
                      }`}>
                        {flag.severity}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No open fraud flags.</p>
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="audit">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Audit Log</h2>
              {auditLogs && auditLogs.length > 0 ? (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{log.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.target_table} · {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No audit logs yet.</p>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
