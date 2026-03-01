

# Database and Admin Review: Root Causes and Fixes

## Critical Issues Found

### 1. `prevent_admin_edit` Trigger Blocks Admin Operations
The `users` table has an active trigger (`admin_edit_block`) that runs the `prevent_admin_edit()` function. This function raises an exception whenever `is_admin` is changed -- even when using the service_role key. This means:
- "Make Admin" and "Revoke Admin" buttons in the Admin panel always fail
- The `updateUser` action in the `admin-operations` edge function is blocked

**Fix:** Drop the trigger entirely. Admin role changes are already protected by the edge function (which verifies the caller is an admin) and RLS policies.

### 2. `prevent_balance_edit` Trigger Blocks Reward Grants and Staking
The `users` table has an active trigger (`balance_block`) that runs `prevent_balance_edit()`. It raises an exception whenever `bix_balance` or `total_bix` is changed -- even via service_role. This blocks:
- "Grant Rewards" (BIX) in the Admin panel
- Staking unstake/claim operations that update user balances
- Any edge function that adjusts BIX balances

**Fix:** Drop this trigger. Balance changes are protected by RLS (users can't directly update their own balance via the client) and all legitimate balance changes go through edge functions with service_role.

### 3. No SELECT Policy for Regular Users on `users` Table
The `users` table only has one SELECT policy: `Admins can select all users` (requires `is_admin(auth.uid())`). There is **no** policy allowing regular users to read their own row. This means:
- Non-admin users cannot load their profile, XP, balance, or level
- The `refreshUserProfile()` call returns null for regular users
- The Dashboard, Profile, and Wallet pages are essentially broken for non-admin users

**Fix:** Add a SELECT policy: `Users can view own row` with `USING (id = auth.uid())`.

### 4. `admin-operations` Missing from `config.toml`
The `admin-operations` edge function is not listed in `supabase/config.toml`, so it defaults to `verify_jwt = true` (the deprecated approach). The function already validates the JWT manually in code, so this should be set to `verify_jwt = false`.

**Fix:** Add `[functions.admin-operations]` with `verify_jwt = false` to config.toml.

### 5. Build Errors in `admin-operations/index.ts` (TypeScript)
The edge function has ~25+ TypeScript errors because `createClient(url, key)` without a generic type parameter produces a strictly-typed client where table types resolve to `never`. All `.from()`, `.insert()`, `.update()`, `.upsert()` calls fail type checking.

**Fix:** Cast the client as `any` or use a type assertion: `const admin = createClient(supabaseUrl, serviceKey) as any;`. This is standard practice for untyped edge functions.

---

## Implementation Plan

### Step 1: Database Migration
A single migration to:
- Drop `admin_edit_block` trigger
- Drop `balance_block` trigger
- Drop `prevent_admin_edit()` function
- Drop `prevent_balance_edit()` function
- Add SELECT policy on `users` for `id = auth.uid()`

```text
DROP TRIGGER IF EXISTS admin_edit_block ON public.users;
DROP TRIGGER IF EXISTS balance_block ON public.users;
DROP FUNCTION IF EXISTS public.prevent_admin_edit();
DROP FUNCTION IF EXISTS public.prevent_balance_edit();

CREATE POLICY "Users can view own row"
  ON public.users FOR SELECT
  USING (id = auth.uid());
```

### Step 2: Fix `admin-operations/index.ts`
- Change `const admin = createClient(supabaseUrl, serviceKey);` to `const admin: any = createClient(supabaseUrl, serviceKey);`
- This resolves all 25+ TypeScript errors in one line

### Step 3: Update `config.toml`
- Add `[functions.admin-operations]` with `verify_jwt = false`
- Also add it to the GitHub Actions deploy workflow options

### Step 4: Update GitHub Actions Workflow
- Add `admin-operations` to the deployment target options in `.github/workflows/supabase-edge-deploy.yml`

