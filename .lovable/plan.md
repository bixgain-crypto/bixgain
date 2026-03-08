

# Deep Analysis & Feature Additions

## Backend-Frontend Alignment Analysis

After reviewing all pages against the database schema and API layer:

**All pages are properly connected to the backend.** Each page correctly uses `useAppData()` / `useAuth()` hooks which fetch from the database. Specifically:
- **Dashboard**: Reads `users`, `activities`, `leaderboard`, `user_reward_notifications` -- all correct
- **Profile**: Reads/updates `users` via `changeUsername` RPC -- correct
- **Missions (Tasks)**: Reads `tasks`, `activities`, `referrals`; writes to `activities` and calls `award_xp` RPC -- correct
- **Wallet**: Reads `wallets`, `reward_transactions`, `stakes`, `staking_plans` -- correct
- **Leaderboard**: Reads leaderboard edge function -- correct
- **Referrals**: Reads `referrals`, `activities`, referral code from users -- correct
- **Store**: Calls `spend_bix` RPC -- correct
- **Spin to Earn**: Calls `claim_daily_reward` RPC -- correct
- **Staking**: Calls `staking` edge function -- correct

**Issues found:**
1. `/boosts` route redirects to `/wallet` -- the `Boosts.tsx` page exists but is unreachable
2. `Claims.tsx` page exists but has no route in `App.tsx`
3. No built-in engagement missions (daily login, profile completion, first stake, etc.)

## Plan

### 1. Add in-app engagement missions to the Tasks/Missions page
Create a set of hardcoded "platform missions" that track real user actions and display alongside admin-created tasks. These are client-side computed missions based on existing data (no new tables needed):

- **Daily Login** -- checks if user visited today (uses streak data from `users`)
- **Complete Your Profile** -- checks if `display_name` and `bio` are set
- **First Stake** -- checks if user has any stake in `stakes`
- **Reach Level 2** -- checks `current_level >= 2`
- **Spin the Wheel** -- checks if daily boost was claimed today (from `activities`)
- **Invite a Friend** -- checks referral count

These will appear as a "Platform Missions" section at the top of the Missions page with progress indicators and visual completion states. They award XP via the existing `awardXp` flow when claimed.

### 2. Add Boosts page with mini-games "Coming Soon"
Restore the `/boosts` route to render a dedicated Boosts page with:
- The existing `StakingTab` component
- A new "Mini Games" section showing 4 coming-soon game cards:
  - **Tap Rush** -- tap as fast as you can for BIX
  - **Memory Match** -- card matching game
  - **Quiz Challenge** -- trivia for XP rewards
  - **Lucky Dice** -- roll dice for random rewards
- Each card has an animated icon, description, and "Coming Soon" badge

### Files to modify
- **`src/App.tsx`** -- Add `/boosts` route pointing to updated `Boosts.tsx` (remove redirect)
- **`src/pages/Boosts.tsx`** -- Add mini-games coming-soon section below StakingTab
- **`src/pages/Tasks.tsx`** -- Add platform missions section at the top of the missions page
- **`src/components/AppSidebar.tsx`** -- Add Boosts nav item between Daily Boost and Leaderboard
- **`src/components/BottomNav.tsx`** -- No change needed (keep current 5 items for mobile)

### No database changes needed
All platform missions use existing data from `users`, `activities`, `stakes`, and `referrals` tables already loaded by `AppDataContext`.

