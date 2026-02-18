

# Fix Referral System Backend Logic

## Problems Identified

1. **Referral linking runs client-side** in `Auth.tsx` -- easily bypassed, races with profile creation trigger, and can't capture IP/device info
2. **No `reward_granted` column** on referrals table to prevent duplicate rewards
3. **No `referred_device_id` column** for device fraud checks
4. **No daily referral limit** enforcement
5. **Edge function `checkReferralQualification`** doesn't check device_id fraud
6. **`awardReward` has a broken no-op wallet update** line and race condition on balance increment
7. **Build errors** in edge function due to untyped Supabase client (all `never` type errors)

## Plan

### 1. Database Migration

Add columns to `referrals` table:
- `reward_granted boolean DEFAULT false` -- prevents duplicate reward payouts
- `referred_device_id text` -- for device fraud check

Add a unique constraint on `(referrer_id, referred_id)` to prevent duplicate referral records.

Add a `referral_daily_limits` platform setting (or use existing `reward_limits` table) with a default of 10 referrals per day per referrer.

### 2. Rewrite Edge Function (`task-operations/index.ts`)

**Fix all TypeScript errors** by using `any` typed client (the untyped `createClient` from esm.sh doesn't know the DB schema):

```text
const supabaseAdmin: any = createClient(supabaseUrl, serviceKey);
```

**Add new action: `link_referral`** -- called from Auth.tsx after signup instead of doing client-side DB writes:
- Accepts `referral_code`, `referred_user_id`
- Captures IP from request headers
- Looks up referrer by `referral_code` in `profiles`
- Blocks self-referrals (referrer.user_id === referred_user_id)
- Blocks same-IP (compare with referrer's last known IP from previous referrals)
- Blocks same device_id
- Enforces daily referral limit (max 10 new referrals per referrer per day)
- Creates referral record with `referrer_ip`, `referred_ip`, `referred_device_id`
- Updates profile `referred_by`
- Does NOT award any reward

**Fix `checkReferralQualification`**:
- Add `reward_granted` check to prevent duplicates
- Add device_id fraud check
- Set `reward_granted = true` when awarding

**Fix `awardReward`**:
- Remove broken no-op wallet update line
- Keep the read-then-write balance update (already works)

**Fix error handler**: `(err as Error).message`

### 3. Update Auth.tsx (minimal change)

Replace the client-side referral DB writes with a single call to the edge function:

```typescript
if (referralCode && signUpData.user) {
  await supabase.functions.invoke("task-operations", {
    body: { action: "link_referral", referral_code: referralCode }
  });
}
```

Remove all direct Supabase table queries for referral linking from the frontend.

### 4. Referrals.tsx (no UI changes, fix data query)

Update the referrals list query to use the `referrals` table directly instead of querying `profiles.referred_by`, so it shows qualification status accurately. The display stays identical.

## Technical Details

### New/Modified Files

| File | Change |
|------|--------|
| `supabase/migrations/...` | Add `reward_granted`, `referred_device_id` columns; unique constraint |
| `supabase/functions/task-operations/index.ts` | Fix types, add `link_referral` action, fix `checkReferralQualification`, fix `awardReward` |
| `src/pages/Auth.tsx` | Replace client-side referral logic with edge function call |
| `src/pages/Referrals.tsx` | Query `referrals` table for list + show qualified status |

### Fraud Checks (all server-side)

- Self-referral: `referrer.user_id === referred_user_id` blocked
- Same IP: compare `referrer_ip` from most recent referral by this referrer
- Same device_id: compare `referred_device_id`
- Daily limit: count referrals by referrer in last 24h, cap at 10
- All violations create a `fraud_flags` entry

### Reward Flow

```text
Signup with ?ref= --> link_referral (edge fn) --> referral record created (qualified=false, reward_granted=false)
                                                  No reward yet

Task approved --> checkReferralQualification --> if first approved task AND no fraud flags:
                                                  set qualified=true, qualified_at=now()
                                                  insert reward_ledger entry (50 BIX)
                                                  set reward_granted=true
                                                  update wallet balance
```
