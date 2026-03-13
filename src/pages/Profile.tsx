import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppData } from '@/context/AppDataContext';
import { changeUsername } from '@/lib/progressionApi';
import { getLevelProgress } from '@/lib/progression';
import {
  User, Shield, Coins, Trophy, Zap, Calendar, Edit2, Check, X,
  Copy, TrendingUp, ArrowDownLeft, ArrowUpRight, Users, Star,
  Target, Flame, Award, LogOut, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { refreshUserProfile } = useAppData();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.username || '');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [referralCount, setReferralCount] = useState(0);

  const totalXp = Number(user?.total_xp || 0);
  const progress = getLevelProgress(totalXp);
  const level = progress.current.level;
  const xpInLevel = progress.xpIntoLevel;
  const xpToNext = progress.xpToNextLevel;
  const xpPercent = progress.progressPercent;

  useEffect(() => {
    setDisplayName(user?.username || '');
  }, [user?.username]);

  useEffect(() => {
    const fetchActivity = async () => {
      if (!user) return;
      try {
        const [txHistory, referrals] = await Promise.all([
          supabase.from('reward_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
          supabase.from('referrals').select('*').eq('referrer_id', user.id).limit(100),
        ]);
        setTransactions(txHistory.data || []);
        setReferralCount(referrals.data?.length || 0);
      } catch {
        // Data may not be available yet
      }
    };
    fetchActivity();
  }, [user]);

  const handleSave = async () => {
    if (!user || !displayName.trim()) return;
    try {
      await changeUsername(displayName.trim());
      toast.success('Profile updated!');
      setEditing(false);
      refreshUserProfile();
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const stats = [
    { label: 'Total Earned', value: `${(user?.total_bix || 0).toLocaleString()}`, suffix: 'BIX', icon: Coins, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Daily Streak', value: `${user?.daily_streak || 0}`, suffix: 'Days', icon: Flame, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    { label: 'Miner Level', value: `${level}`, suffix: 'Level', icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    { label: 'Referrals', value: `${referralCount}`, suffix: 'Miners', icon: Users, color: 'text-sky-400', bg: 'bg-sky-400/10' },
  ];

  const achievements = [
    { title: 'First Steps', desc: 'Create your account', icon: Star, unlocked: true },
    { title: 'Streak Starter', desc: 'Reach a 3-day streak', icon: Flame, unlocked: (user?.daily_streak || 0) >= 3 },
    { title: 'er', desc: 'Earn 1,000 BIX total', icon: Coins, unlocked: (user?.total_bix || 0) >= 1000 },
    { title: 'Recruiter', desc: 'Refer 1 friend', icon: Users, unlocked: referralCount >= 1 },
    { title: 'Leveled Up', desc: 'Reach Level 2', icon: TrendingUp, unlocked: level >= 2 },
    { title: 'Dedicated', desc: 'Reach a 7-day streak', icon: Target, unlocked: (user?.daily_streak || 0) >= 7 },
    { title: 'Whale', desc: 'Earn 10,000 BIX total', icon: Award, unlocked: (user?.total_bix || 0) >= 10000 },
    { title: 'Influencer', desc: 'Refer 5 friends', icon: Star, unlocked: referralCount >= 5 },
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Hero Section */}
        <Card className="glass-card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[120px] -mr-48 -mt-48" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-sky-500/5 rounded-full blur-[80px] -ml-32 -mb-32" />
          <CardContent className="p-8 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              {/* Avatar & Identity */}
              <div className="flex flex-col items-center lg:items-start gap-4">
                <div className="relative">
                  <Avatar className="h-32 w-32 border-4 border-primary gold-glow">
                    <AvatarFallback className="text-5xl font-bold bg-primary/20 text-primary">
                      {(user?.username || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-background font-bold text-sm border-2 border-background">
                    {level}
                  </div>
                </div>
              </div>

              {/* Name & Info */}
              <div className="flex-1 text-center lg:text-left">
                <div className="flex items-center gap-3 justify-center lg:justify-start mb-2">
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                        className="h-10 w-56 bg-muted/50 border-primary/30"
                        placeholder="Enter display name"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" onClick={handleSave} className="text-green-400 hover:bg-green-400/10">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(false)} className="text-red-400 hover:bg-red-400/10">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-3xl font-display font-bold">{user?.username || 'User'}</h1>
                      <Button size="icon" variant="ghost" onClick={() => { setDisplayName(user?.username || ''); setEditing(true); }} className="text-muted-foreground hover:text-primary">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">{user?.email}</p>
                <div className="flex items-center gap-2 flex-wrap justify-center lg:justify-start">
                  <Badge className="gold-gradient border-none">Level {level} Miner</Badge>
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    <Shield className="h-3 w-3 mr-1" /> Verified
                  </Badge>
                  <Badge variant="outline" className="border-sky-400/30 text-sky-400">
                    <Award className="h-3 w-3 mr-1" /> {unlockedCount}/{achievements.length} Badges
                  </Badge>
                </div>

                {/* XP Progress inline */}
                <div className="mt-5 max-w-md">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground font-semibold uppercase tracking-wider">XP to Level {level + 1}</span>
                    <span className="text-muted-foreground">{xpInLevel.toLocaleString()} / {xpToNext.toLocaleString()}</span>
                  </div>
                  <Progress value={xpPercent} className="h-2.5" />
                </div>
              </div>

              {/* Balance Card */}
              <div className="text-center p-6 rounded-2xl bg-primary/10 border border-primary/20 gold-glow min-w-[160px]">
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Balance</p>
                <p className="text-3xl font-display font-bold text-primary">{(user?.bix_balance || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">BIX Tokens</p>
                <Button
                  variant="link"
                  className="text-primary text-xs mt-2 h-auto p-0"
                  onClick={() => window.location.href = '/wallet'}
                >
                  View Wallet <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="glass-card hover:border-primary/20 transition-all">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{stat.label}</p>
                </div>
                <p className="text-2xl font-bold font-display">{stat.value} <span className="text-sm text-muted-foreground font-normal">{stat.suffix}</span></p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Achievements */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Achievements
                </CardTitle>
                <CardDescription>{unlockedCount} of {achievements.length} badges unlocked</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {achievements.map((ach) => (
                    <div
                      key={ach.title}
                      className={`p-4 rounded-xl border text-center transition-all ${
                        ach.unlocked
                          ? 'bg-primary/5 border-primary/20 hover:border-primary/40'
                          : 'bg-muted/10 border-white/5 opacity-40'
                      }`}
                    >
                      <ach.icon className={`h-6 w-6 mx-auto mb-2 ${ach.unlocked ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className="text-xs font-bold mb-0.5">{ach.title}</p>
                      <p className="text-[10px] text-muted-foreground">{ach.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>Your latest transactions</CardDescription>
                </div>
                <Button
                  variant="link"
                  className="text-primary text-xs"
                  onClick={() => window.location.href = '/wallet'}
                >
                  View All
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {transactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Coins className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">No activity yet. Start earning BIX!</p>
                      <Button
                        variant="link"
                        className="text-primary mt-2"
                        onClick={() => window.location.href = '/tasks'}
                      >
                        Browse Quests
                      </Button>
                    </div>
                  ) : transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tx.amount > 0 ? 'bg-green-400/10' : 'bg-red-400/10'}`}>
                          {tx.amount > 0 ? (
                            <ArrowDownLeft className="h-4 w-4 text-green-400" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-red-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{tx.description || 'Transaction'}</p>
                          <p className="text-xs text-muted-foreground capitalize">{tx.type || 'transfer'} &middot; {new Date(tx.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <p className={`font-bold text-sm ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount} BIX
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Account Details */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Account Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">User ID</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                      onClick={() => copyToClipboard(user?.id || '', 'User ID')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs font-mono truncate">{user?.id}</p>
                </div>

                <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Referral Code</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                      onClick={() => copyToClipboard(user?.referral_code || '', 'Referral code')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs font-mono text-primary font-bold">{user?.referral_code || 'N/A'}</p>
                </div>

                <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Email</p>
                  <p className="text-xs truncate">{user?.email}</p>
                </div>

                <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Last Login</p>
                  <p className="text-xs">{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Current session'}</p>
                </div>

                <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Member Since</p>
                  <p className="text-xs">{user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}</p>
                </div>

                <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Account Role</p>
                  <Badge variant="outline" className="text-xs border-green-400/30 text-green-400">
                    <Shield className="h-3 w-3 mr-1" />
                    Verified User
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full justify-start gap-3 gold-gradient font-bold"
                  onClick={() => window.location.href = '/tasks'}
                >
                  <Zap className="h-4 w-4" /> Earn BIX
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => {
                    const baseUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
                    const link = user?.referral_code
                      ? `${String(baseUrl).replace(/\/$/, "")}/auth?ref=${encodeURIComponent(user.referral_code)}`
                      : "";
                    copyToClipboard(link, 'Referral link');
                  }}
                >
                  <Users className="h-4 w-4" /> Copy Referral Link
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 border-white/10 hover:bg-muted"
                  onClick={() => window.location.href = '/wallet'}
                >
                  <Coins className="h-4 w-4" /> View Wallet
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4" /> Log Out
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );


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

        {/* Mini game stats */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="glass rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div>
            <h2 className="text-base sm:text-lg font-semibold">Mini Game Stats</h2>
            <p className="text-xs text-muted-foreground mt-1">XP and BIX performance from arcade sessions.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Total Games</p>
              <p className="mt-1.5 text-lg sm:text-xl font-semibold">
                {loadingGameStats ? "--" : Number(gameStats?.total_games_played || 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">XP from Games</p>
              <p className="mt-1.5 text-lg sm:text-xl font-semibold text-gradient-gold">
                {loadingGameStats ? "--" : formatXp(gameStats?.total_xp_from_games || 0)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">BIX from Games</p>
              <p className="mt-1.5 text-lg sm:text-xl font-semibold">
                {loadingGameStats ? "--" : Number(gameStats?.total_bix_earned_from_games || 0).toFixed(4)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Best Score Per Game</p>
            {loadingGameStats ? (
              <p className="text-sm text-muted-foreground mt-2">Loading mini game stats...</p>
            ) : gameStats && Object.keys(gameStats.best_score_per_game).length > 0 ? (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(gameStats.best_score_per_game)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([gameName, score]) => (
                    <div key={gameName} className="rounded-lg border border-border/50 bg-background/20 px-3 py-2 flex items-center justify-between">
                      <span className="text-sm font-medium">{gameName}</span>
                      <span className="text-sm font-mono text-primary">{Number(score).toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">No mini game scores recorded yet.</p>
            )}
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
