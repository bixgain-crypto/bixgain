
-- Add reward_granted and referred_device_id to referrals
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS reward_granted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referred_device_id text;

-- Unique constraint to prevent duplicate referral records
ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_referrer_referred_unique UNIQUE (referrer_id, referred_id);

-- Insert daily referral limit setting (10 per day per referrer)
INSERT INTO public.platform_settings (key, value, description)
VALUES ('referral_daily_limit', '10', 'Maximum referrals a user can make per day')
ON CONFLICT DO NOTHING;
