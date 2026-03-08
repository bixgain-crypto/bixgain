

# Deep Code Review & Update Plan

## Issues Found

### 1. Console Warning: `forwardRef` missing on `LevelBadge` and `XpProgressBar`
Both components are passed as children to framer-motion containers that attempt to attach refs. React warns: "Function components cannot be given refs." Neither component uses `forwardRef`.

**Fix**: Wrap both components with `React.forwardRef`.

### 2. No route guards -- unauthenticated users can access all pages
Every protected page (Dashboard, Profile, Wallet, Missions, etc.) handles the "not signed in" case by rendering a "Sign in" message inside `AppLayout`. This means:
- The full sidebar/bottom nav renders for unauthenticated users
- No redirect to `/auth`

**Fix**: Create a `ProtectedRoute` wrapper component that checks session and redirects to `/auth`. Apply it to all authenticated routes in `App.tsx`.

### 3. Auth page doesn't redirect authenticated users
If a logged-in user navigates to `/auth`, they see the login form again instead of being redirected to `/dashboard`.

**Fix**: Add a redirect check at the top of `Auth.tsx`.

### 4. `Boosts` page is a duplicate of the Wallet staking tab
`/boosts` renders `<StakingTab />` directly -- identical to the Staking tab inside `/wallet`. This is redundant and confusing.

**Fix**: Redirect `/boosts` to `/wallet` (or remove the route). Update sidebar if it links to Boosts separately.

### 5. Store items are hardcoded with no actual effect
`Store.tsx` calls `spendBix()` but doesn't record what was purchased or apply any effect (no XP multiplier activation, no badge unlock). Users spend BIX for nothing.

**Fix**: This is a known limitation (store is placeholder). No code change needed now, but flag it. Could add a `purchases` table in the future.

### 6. RLS policies use `RESTRICTIVE` (not `PERMISSIVE`) pattern
All user-facing RLS policies are marked `Permissive: No` (restrictive). Multiple restrictive policies on the same command require ALL to pass. This means for `users` table SELECT: both "Users can view own row" AND "Admins can select all users" must pass for a row to be visible. A regular user fails the admin check, so they see nothing.

**Wait** -- re-reading: Restrictive means ALL must pass. But there are separate SELECT policies for users and admins. If both are restrictive, a regular user would need to satisfy BOTH. This would mean regular users can't see their own row (they fail the admin check). This is a critical bug if not already mitigated by the edge functions using service_role.

**Reality check**: The app works because `AppDataContext` fetches user data through edge functions (service_role) or RPCs (SECURITY DEFINER), bypassing RLS. But any direct client-side query to `users` table would fail. This is fine for now but fragile.

### 7. Spin wheel visual doesn't match backend rewards
The wheel shows labels like "XP Boost", "Mission Reset", "Streak Bonus" but the backend only awards random XP (25/50/75). These labels are misleading -- users see "Mission Reset" but get XP.

**Fix**: Update `WHEEL_LABELS` to only show XP values that match the backend: `["+25 XP", "+50 XP", "+75 XP", "+25 XP", "+50 XP", "+75 XP"]` (6 segments, repeating the 3 actual values).

### 8. Missing `is_active` / `is_frozen` columns on `users` table
`AppLayout` checks `user?.is_active` and `user?.is_frozen` but the `users` table schema doesn't have these columns. These exist only on the `profiles` table. The check silently fails (undefined !== false), so frozen/inactive users are never blocked.

**Fix**: Add `is_active` and `is_frozen` columns to the `users` table, or read from `profiles` table in `AppDataContext`.

### 9. `profiles` table not visible in schema but referenced in code
`ensure_profile_for_user_row()` trigger inserts into `profiles`, and `AppDataContext` likely reads from it. The profiles table exists but its schema wasn't shown. The `is_active`/`is_frozen` fields live there but `AppLayout` reads from the `users` object.

**Fix**: Sync `is_active`/`is_frozen` from profiles to users via a trigger, or query profiles directly.

---

## Recommended Implementation Order

### Phase 1: Bug Fixes (High Priority)
1. **Fix `forwardRef` warnings** on `LevelBadge` and `XpProgressBar`
2. **Fix spin wheel labels** to match actual backend rewards (remove misleading "Mission Reset", "Streak Bonus", "XP Boost")
3. **Add `is_active` and `is_frozen` to `users` table** with a sync trigger from profiles, so `AppLayout` account blocking actually works

### Phase 2: UX Improvements
4. **Add `ProtectedRoute` component** and apply to all authenticated routes -- redirect to `/auth` instead of showing empty "Sign in" messages
5. **Redirect authenticated users away from `/auth`** to `/dashboard`
6. **Remove or redirect `/boosts` route** since it duplicates wallet staking tab

### Phase 3: Future Enhancements (Flagged)
- Store purchases table to track what users bought
- Convert RLS policies from restrictive to permissive for direct client queries
- Add password reset flow to Auth page

---

## Technical Details

### forwardRef fix (LevelBadge)
```tsx
export const LevelBadge = React.forwardRef<HTMLDivElement, LevelBadgeProps>(
  ({ totalXp, className, compact = false }, ref) => { ... }
);
```

### ProtectedRoute component
```tsx
function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/auth" replace />;
  return children;
}
```

### Users table migration
```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false;

-- Sync from profiles
UPDATE public.users u
SET is_active = COALESCE(p.is_active, true),
    is_frozen = COALESCE(p.is_frozen, false)
FROM public.profiles p
WHERE p.user_id = u.id;
```

### Spin wheel label fix
Replace misleading labels with actual reward values: 6 segments showing `+25 XP`, `+50 XP`, `+75 XP` repeated twice.

