

# Fix: Referral Rewards Not Being Granted

## Root Cause Analysis

After analyzing the database and code, here are the issues preventing referral rewards:

### Issue 1: No referral records exist
The `referrals` table is completely empty. No user has signed up through a `?ref=` link yet in the current system, so there are no referrals to reward.

### Issue 2: Task attempts never reach "approved" status
All 5 `task_attempts` records are stuck in "started" status. The `Tasks.tsx` frontend completes tasks by directly inserting into the `activities` table (bypassing the edge function), so `task_attempts.status` is never updated to "approved". Since `checkReferralQualification` requires at least one approved attempt, referrals can never qualify.

### Issue 3: Double/triple reward crediting
The `awardReward` edge function both:
- Inserts into `activities` (which fires the `credit_wallet_on_activity` trigger, auto-crediting the wallet)
- Manually updates wallet balance

This means every edge-function reward would be credited TWICE to the wallet. Meanwhile, `Tasks.tsx` also inserts into `activities` directly (a third path), creating further confusion.

### Issue 4: Tasks.tsx never triggers referral qualification
The frontend task flow never calls `checkReferralQualification`. Only the edge function paths do.

## Fix Plan

### Step 1: Fix `awardReward` -- Remove manual wallet update (double-credit bug)

Since the `credit_wallet_on_activity` trigger already handles wallet balance updates when an `activities` row is inserted, the manual wallet update in `awardReward` must be removed. Otherwise every reward is counted twice.

### Step 2: Fix `Tasks.tsx` -- Route task completions through edge function

Update the task completion flow in `Tasks.tsx` so that when a task is verified (link visit, video watch, or social follow proof), it:
- Calls the edge function to update `task_attempts.status` to "approved"
- The edge function then calls `checkReferralQualification` automatically
- Remove direct `activities` inserts from the frontend

### Step 3: Fix task completion paths in edge function

For `verifyLinkVisit` and `verifyVideoWatch`: these already work correctly (mark attempt approved, award, check referral). No changes needed.

For social follow tasks: after admin approval via `approveAttempt`, it already calls `checkReferralQualification`. No changes needed.

### Step 4: Clean up stale "started" task_attempts

The 5 existing "started" attempts should remain as-is (they represent incomplete tasks).

## Technical Details

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/task-operations/index.ts` | Remove manual wallet update from `awardReward` (lines 640-655) to prevent double-crediting |
| `src/pages/Tasks.tsx` | Replace direct `activities` inserts with edge function calls for `verify_link_visit`, `verify_video_watch`, and `submit_proof`; remove client-side reward logic |

### What will work after the fix

1. User A shares referral link
2. User B signs up with `?ref=` code -- `link_referral` edge function creates a referral record (qualified=false, reward_granted=false)
3. User B completes a task -- edge function marks `task_attempts.status = approved`
4. Edge function calls `checkReferralQualification` -- finds User B's referral, sees they have an approved attempt, passes fraud checks, marks qualified=true, reward_granted=true, and awards 50 BIX to User A via `reward_ledger` and `activities` (which triggers the wallet update automatically)

### Reward crediting path (single source of truth)

```text
awardReward() 
  --> inserts into activities table
  --> credit_wallet_on_activity trigger fires automatically
  --> wallet balance updated

No manual wallet update needed.
```
