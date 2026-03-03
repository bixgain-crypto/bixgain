import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BixLogo } from "@/components/BixLogo";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { getOrCreateDeviceId, normalizeReferralCode } from "@/lib/referrals";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(normalizeReferralCode(ref));
      setIsLogin(false);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const isSignupDbError = error.message?.toLowerCase().includes("database error saving new user");
        if (isSignupDbError) {
          toast.error("Signup is blocked by backend trigger/schema mismatch. Existing users can still sign in.");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success("Welcome back!");
        window.location.href = "/dashboard";
      }
    } else {
      const normalizedReferralCode = normalizeReferralCode(referralCode);
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim() || email.split("@")[0] || undefined,
            referral_code: normalizedReferralCode || undefined,
          },
        },
      });
      if (error) {
        toast.error(error.message);
      } else {
        // Link referral server-side (no client-side DB writes)
        if (normalizedReferralCode && signUpData.user) {
          const { data: referralData, error: referralError } = await supabase.functions.invoke("task-operations", {
            body: {
              action: "link_referral",
              referral_code: normalizedReferralCode,
              new_user_id: signUpData.user.id,
              device_id: getOrCreateDeviceId(),
            },
          });
          if (referralError || (referralData && typeof referralData === "object" && "error" in referralData)) {
            const fallbackMessage =
              (referralData as { error?: string } | null)?.error ||
              referralError?.message ||
              "Referral code could not be linked";
            toast.warning(fallbackMessage);
          }
        }
        toast.success("Check your email to verify your account!");
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-dark p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xl space-y-8 glass rounded-xl p-6 sm:p-8"
      >
        <div className="flex flex-col items-center gap-4">
          <BixLogo size="lg" />
          <p className="text-muted-foreground text-sm">
            {isLogin ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-secondary border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-secondary border-border"
            />
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="yourname"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-secondary border-border"
              />
            </div>
          )}

          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="referral">Referral Code (optional)</Label>
              <Input
                id="referral"
                type="text"
                placeholder="e.g. BIX1A2B3C4D"
                value={referralCode}
                onChange={(e) => setReferralCode(normalizeReferralCode(e.target.value))}
                className="bg-secondary border-border font-mono"
              />
            </div>
          )}

          <Button type="submit" className="w-full bg-gradient-gold font-semibold" disabled={loading}>
            {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
