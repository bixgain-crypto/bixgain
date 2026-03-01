# Bixgain Rewards Hub

Bixgain Rewards Hub is a gamified growth platform where users complete missions, earn XP and BIX, compete on leaderboards, and level up through a transparent progression system.

This product is designed around one principle: engagement should compound. Every action in the platform is meant to push users forward in rank, utility, and long-term retention.

## Product Overview

Bixgain combines game mechanics with a rewards economy:

- Mission engine: Daily, weekly, referral, challenge, and seasonal missions.
- Progression system: XP accumulation, level advancement, and level badges.
- BIX utility: Spend BIX in the store and unlock additional benefits.
- Referral growth loop: Invite users, track qualification, and earn milestone rewards.
- Daily boost mechanic: Spin-to-earn style daily reward claim flow.
- Competitive pressure: Weekly, seasonal, and all-time leaderboard views.
- Admin operations: Manage users, missions, rewards, activity logs, and settings.

## Founder Positioning

Bixgain is built to be more than a rewards dashboard. It is an engagement operating system for communities that want measurable participation, recurring activity, and user progression that feels earned.

The long-term vision is a platform where mission design, reward design, and network effects work together as one compounding growth engine.

## Technology Stack

- Frontend: React + TypeScript + Vite
- UI: Tailwind CSS + shadcn/ui + Framer Motion
- Data/Auth: Supabase (Postgres, Auth, Realtime)
- Backend logic: Supabase Edge Functions + SQL migrations

## Core Architecture

- `src/`: React application (pages, components, hooks, data context)
- `supabase/migrations/`: Database schema and behavior migrations
- `supabase/functions/`: Edge Functions for progression, referrals, staking, leaderboard, and admin operations
- `docs/`: Deployment and auth notes

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_PUBLIC_URL=http://localhost:5173
VITE_USE_COOKIE_AUTH=false
```

### 3. Run locally

```bash
npm run dev
```

### 4. Build for production

```bash
npm run build
npm run preview
```

## Available Scripts

- `npm run dev`: Start local development server
- `npm run build`: Create production build
- `npm run preview`: Preview production build locally
- `npm run lint`: Run ESLint

## Current Product Modules

- Authentication and onboarding (`/auth`)
- User dashboard (`/dashboard`)
- Missions (`/missions`)
- Daily boost (`/spin`)
- Referrals (`/referrals`)
- Leaderboard (`/leaderboard`)
- Store (`/store`)
- Boosts and staking (`/boosts`)
- Admin console (`/admin`)

## Notes

- Leaderboard, staking, task operations, and admin workflows depend on configured Supabase Edge Functions.
- Database behavior is migration-driven; keep migrations in sync with deployed environments.
- See `docs/github-edge-deploy.md` for Edge Function deployment guidance.
