
-- Spin tracking table
CREATE TABLE public.spin_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  spun_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reward_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.spin_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own spins" ON public.spin_records FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users view own spins" ON public.spin_records FOR SELECT USING (user_id = auth.uid());

CREATE INDEX idx_spin_records_user_time ON public.spin_records (user_id, spun_at DESC);

-- Seed sample tasks
INSERT INTO public.tasks (name, description, task_type, reward_points, is_active) VALUES
  ('Follow us on Twitter', 'Follow @bixgain on Twitter/X and earn BIX tokens', 'social', 50, true),
  ('Join Telegram Group', 'Join the official Bixgain Telegram community', 'social', 30, true),
  ('Share on Social Media', 'Share a post about Bixgain on any social platform', 'social', 25, true),
  ('Like & Retweet Campaign', 'Like and retweet our latest campaign post', 'social', 15, true),
  ('Daily Login Bonus', 'Log in to the platform daily to earn BIX', 'login', 10, true),
  ('Complete Profile', 'Fill in your display name and avatar', 'custom', 20, true),
  ('First Referral', 'Refer your first friend to Bixgain', 'referral', 100, true),
  ('Stake BIX Tokens', 'Stake your BIX tokens to earn passive rewards', 'staking', 200, true);
