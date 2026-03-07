import { AppLayout } from "@/components/AppLayout";
import { LevelBadge } from "@/components/LevelBadge";
import { XpProgressBar } from "@/components/XpProgressBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppData } from "@/context/AppDataContext";
import { useAuth } from "@/hooks/useAuth";
import { changeUsername } from "@/lib/progressionApi";
import { formatXp, getLevelProgress } from "@/lib/progression";
import { motion } from "framer-motion";
import { CalendarDays, LogOut, User, UserRoundPen } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Profile() {
  const { user, signOut } = useAuth();
  const { refreshUserProfile } = useAppData();
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
      await refreshUserProfile();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update username";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5 sm:space-y-6">
        {/* Profile header */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5 sm:p-8"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 truncate">
                <User className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
                <span className="truncate">{user?.username || "Unnamed User"}</span>
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

        {/* Stats grid */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4"
        >
          <div className="glass rounded-xl p-4 sm:p-5">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Username</p>
            <p className="mt-1.5 sm:mt-2 text-base sm:text-lg font-semibold truncate">{user?.username || "-"}</p>
          </div>
          <div className="glass rounded-xl p-4 sm:p-5">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Level Name</p>
            <p className="mt-1.5 sm:mt-2 text-base sm:text-lg font-semibold truncate">{String(user?.level_name || "Explorer")}</p>
          </div>
          <div className="glass rounded-xl p-4 sm:p-5">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Level</p>
            <p className="mt-1.5 sm:mt-2 text-base sm:text-lg font-semibold">{Number(user?.current_level || 1)}</p>
          </div>
          <div className="glass rounded-xl p-4 sm:p-5">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Total XP</p>
            <p className="mt-1.5 sm:mt-2 text-base sm:text-lg font-semibold text-gradient-gold">{formatXp(totalXp)}</p>
          </div>
          <div className="glass rounded-xl p-4 sm:p-5">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Bix Balance</p>
            <p className="mt-1.5 sm:mt-2 text-base sm:text-lg font-semibold">{Number(user?.bix_balance || 0).toLocaleString()}</p>
          </div>
          <div className="glass rounded-xl p-4 sm:p-5">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Total Bix</p>
            <p className="mt-1.5 sm:mt-2 text-base sm:text-lg font-semibold">{Number(user?.total_bix || 0).toLocaleString()}</p>
          </div>
        </motion.section>

        {/* Join date */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-5 sm:p-6"
        >
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Join Date: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
          </p>
        </motion.section>

        {/* Change username */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="glass rounded-2xl p-5 sm:p-6"
        >
          <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <UserRoundPen className="h-5 w-5 text-primary" />
            Change Username
          </h2>
          <div className="mt-3 space-y-2 max-w-xl">
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

        {/* Sign Out — prominent on all screens */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="glass rounded-2xl p-5 sm:p-6"
        >
          <h2 className="text-base sm:text-lg font-semibold mb-3">Account</h2>
          <Button
            onClick={() => void signOut()}
            variant="destructive"
            size="lg"
            className="w-full sm:w-auto font-semibold"
          >
            <LogOut className="h-5 w-5 mr-2" />
            Sign Out
          </Button>
        </motion.section>
      </div>
    </AppLayout>
  );
}
