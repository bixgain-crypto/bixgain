-- Seed additional growth missions across all mission categories.
INSERT INTO public.tasks (
  name,
  description,
  reward_points,
  task_type,
  requirements,
  is_active,
  max_completions_per_user,
  target_url,
  required_seconds,
  start_date
)
VALUES
  (
    'Daily Check-in Streak',
    'Log in and keep your consistency streak alive for daily growth rewards.',
    55,
    'login',
    '{"category":"daily","difficulty":"Easy","target":1,"cooldown":"24h","level_required":1}'::jsonb,
    true,
    1,
    null,
    0,
    now()
  ),
  (
    'Read Market Pulse',
    'Open the market insight post and stay updated with current trends.',
    70,
    'task_completion',
    '{"category":"daily","difficulty":"Easy","target":1,"cooldown":"24h","level_required":1}'::jsonb,
    true,
    1,
    'https://bixgain.com/blog',
    45,
    now()
  ),
  (
    'Weekly XP Builder',
    'Complete five missions this week to accelerate profile progression.',
    220,
    'custom',
    '{"category":"weekly","difficulty":"Medium","target":5,"cooldown":"7d","level_required":2}'::jsonb,
    true,
    5,
    null,
    0,
    now()
  ),
  (
    'Community Amplifier',
    'Share one platform update and drive awareness in your network.',
    180,
    'social',
    '{"category":"weekly","difficulty":"Medium","target":1,"cooldown":"7d","level_required":2}'::jsonb,
    true,
    1,
    'https://x.com/bixgain',
    60,
    now()
  ),
  (
    'Invite 3 Active Friends',
    'Bring in three qualified friends to unlock referral growth bonuses.',
    400,
    'referral',
    '{"category":"referral","difficulty":"Hard","target":3,"cooldown":"Always","level_required":2}'::jsonb,
    true,
    1,
    null,
    0,
    now()
  ),
  (
    'Invite 10 Active Friends',
    'Scale your network with ten qualified referrals for a major reward.',
    1200,
    'referral',
    '{"category":"referral","difficulty":"Hard","target":10,"cooldown":"Always","level_required":4}'::jsonb,
    true,
    1,
    null,
    0,
    now()
  ),
  (
    'Security Champion',
    'Enable 2FA and strengthen your account security posture.',
    260,
    'task_completion',
    '{"category":"challenges","difficulty":"Medium","target":1,"cooldown":"48h","level_required":3}'::jsonb,
    true,
    1,
    'https://bixgain.com/settings/security',
    45,
    now()
  ),
  (
    'On-chain Explorer',
    'Complete one on-chain interaction and validate your wallet setup.',
    350,
    'staking',
    '{"category":"challenges","difficulty":"Hard","target":1,"cooldown":"72h","level_required":4}'::jsonb,
    true,
    1,
    null,
    0,
    now()
  ),
  (
    'Season Sprint I',
    'Finish ten missions during the current season event window.',
    900,
    'custom',
    '{"category":"season","difficulty":"Hard","target":10,"cooldown":"Season","level_required":3}'::jsonb,
    true,
    10,
    null,
    0,
    now()
  ),
  (
    'Season Sprint II',
    'Reach twenty completed missions this season to claim elite rewards.',
    1800,
    'custom',
    '{"category":"season","difficulty":"Hard","target":20,"cooldown":"Season","level_required":5}'::jsonb,
    true,
    20,
    null,
    0,
    now()
  );
