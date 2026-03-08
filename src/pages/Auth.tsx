import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BixLogo } from "@/components/BixLogo";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { getOrCreateDeviceId, normalizeReferralCode } from "@/lib/referrals";
import { Separator } from "@/components/ui/separator";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = "/dashboard";
      } else {
        setSessionChecked(true);
      }
    });
  }, []);

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

  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

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

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">OR</span>
          <Separator className="flex-1" />
        </div>

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              const { error } = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (error) toast.error(error.message || "Google sign-in failed");
              setLoading(false);
            }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              const { error } = await lovable.auth.signInWithOAuth("apple", {
                redirect_uri: window.location.origin,
              });
              if (error) toast.error(error.message || "Apple sign-in failed");
              setLoading(false);
            }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
            Continue with Apple
          </Button>
        </div>

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
