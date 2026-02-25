# GitHub Deploy for Supabase Edge Functions

This repository includes a GitHub Action workflow:

- `.github/workflows/supabase-edge-deploy.yml`

It lets you deploy Supabase Edge Functions from GitHub without running the CLI locally.

## 1) Add GitHub repository secrets

Open your repository:

- `Settings -> Secrets and variables -> Actions -> New repository secret`

Add:

- `SUPABASE_ACCESS_TOKEN` (required)
  - Create in Supabase dashboard: `Account -> Access Tokens`
- `SUPABASE_PROJECT_REF` (optional)
  - If omitted, workflow uses default: `ibcckhhwysqhgbkyodwl`

## 2) Manual deploy from GitHub UI

Open:

- `Actions -> Deploy Supabase Edge Functions -> Run workflow`

Select `target`:

- `task-operations` for referral backend updates
- `leaderboard` for leaderboard function
- `claim_daily_reward` for daily boost function
- `all` to deploy all functions in `supabase/functions` (except `_shared`)

## 3) Auto deploy

When code is pushed to `main` and changes include:

- `supabase/functions/**`
- `supabase/config.toml`

the workflow deploys `all` functions automatically.

## 4) Verify success

In GitHub:

- Open workflow run logs and confirm each deploy step finishes successfully.

In your app:

- Re-test the relevant feature (referral link flow, leaderboard, or daily reward).
