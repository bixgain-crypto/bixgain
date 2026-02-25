import { AppLayout } from "@/components/AppLayout";
import { LevelBadge } from "@/components/LevelBadge";
import { XpProgressBar } from "@/components/XpProgressBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { changeUsername } from "@/lib/progressionApi";
import { formatXp, getLevelProgress } from "@/lib/progression";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarDays, User, UserRoundPen } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [usernameInput, setUsernameInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUsernameInput(user?.username || "");
  }, [user?.username]);

  const totalXp = Number(user?.total_xp || 0);
  const progress = getLevelProgress(totalXp);

  const submitUsername = async () => {
    const next = usernameInput.trim();
    if (!next) {
      toast.error("Username cannot be empty");
      return;
    }

    setSaving(true);
    try {
      await changeUsername(next);
      toast.success("Username updated");
      queryClient.invalidateQueries({ queryKey: ["user-core"] });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update username";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 sm:p-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <User className="h-6 w-6 text-primary" />
                {user?.username || "Unnamed User"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {`Level ${Number(user?.current_level || 1)} - ${String(user?.level_name || "Explorer")}`}
              </p>
            </div>
            <LevelBadge totalXp={totalXp} />
          </div>

          <div className="mt-5 space-y-3">
            <XpProgressBar value={progress.progressPercent} />
            <p className="text-xs text-muted-foreground">
              {`XP to Next Level: ${formatXp(progress.xpToNextLevel)} XP`}
            </p>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div className="glass rounded-xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Username</p>
            <p className="mt-2 text-lg font-semibold">{user?.username || "-"}</p>
          </div>
          <div className="glass rounded-xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Level Name</p>
            <p className="mt-2 text-lg font-semibold">{String(user?.level_name || "Explorer")}</p>
          </div>
          <div className="glass rounded-xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Level Number</p>
            <p className="mt-2 text-lg font-semibold">{Number(user?.current_level || 1)}</p>
          </div>
          <div className="glass rounded-xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total XP</p>
            <p className="mt-2 text-lg font-semibold text-gradient-gold">{formatXp(totalXp)}</p>
          </div>
          <div className="glass rounded-xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Bix Balance</p>
            <p className="mt-2 text-lg font-semibold">{Number(user?.bix_balance || 0).toLocaleString()} Bix</p>
          </div>
          <div className="glass rounded-xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Bix</p>
            <p className="mt-2 text-lg font-semibold">{Number(user?.total_bix || 0).toLocaleString()} Bix</p>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6"
        >
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Join Date: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserRoundPen className="h-5 w-5 text-primary" />
            Change Username
          </h2>
          <div className="mt-3 space-y-2 max-w-sm">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={usernameInput}
              onChange={(event) => setUsernameInput(event.target.value)}
              placeholder="Enter username"
              className="bg-secondary/60"
            />
            <Button
              onClick={submitUsername}
              disabled={saving}
              className="bg-gradient-gold text-primary-foreground font-semibold"
            >
              {saving ? "Updating..." : "Save Username"}
            </Button>
          </div>
        </motion.section>
      </div>
    </AppLayout>
  );
}
