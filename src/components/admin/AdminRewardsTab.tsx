import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AdminFormSection } from "./AdminFormSection";
import type { AdminUser } from "@/lib/adminApi";
import type { UseMutationResult } from "@tanstack/react-query";

type Props = {
  users: AdminUser[];
  rewardUserId: string;
  setRewardUserId: (v: string) => void;
  rewardXp: string;
  setRewardXp: (v: string) => void;
  rewardBix: string;
  setRewardBix: (v: string) => void;
  rewardReason: string;
  setRewardReason: (v: string) => void;
  handleGrantRewards: () => Promise<void>;
  grantRewardsMutation: UseMutationResult<any, unknown, any, unknown>;
  selectedUserIds: string[];
  claimAudience: "selected" | "all";
  setClaimAudience: (v: "selected" | "all") => void;
  claimRewardXp: string;
  setClaimRewardXp: (v: string) => void;
  claimRewardBix: string;
  setClaimRewardBix: (v: string) => void;
  claimReason: string;
  setClaimReason: (v: string) => void;
  claimTimeoutMinutes: string;
  setClaimTimeoutMinutes: (v: string) => void;
  handleCreateClaimableRewards: () => Promise<void>;
  createClaimableRewardsMutation: UseMutationResult<any, unknown, any, unknown>;
};

export function AdminRewardsTab({
  users, rewardUserId, setRewardUserId, rewardXp, setRewardXp, rewardBix, setRewardBix,
  rewardReason, setRewardReason, handleGrantRewards, grantRewardsMutation,
  selectedUserIds, claimAudience, setClaimAudience, claimRewardXp, setClaimRewardXp,
  claimRewardBix, setClaimRewardBix, claimReason, setClaimReason,
  claimTimeoutMinutes, setClaimTimeoutMinutes, handleCreateClaimableRewards, createClaimableRewardsMutation,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <AdminFormSection title="Instant Grant">
          <Select value={rewardUserId} onValueChange={setRewardUserId}>
            <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
            <SelectContent>{users.map((item) => <SelectItem key={item.id} value={item.id}>{item.username || item.id}</SelectItem>)}</SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" min="0" value={rewardXp} onChange={(e) => setRewardXp(e.target.value)} placeholder="XP" />
            <Input type="number" min="0" value={rewardBix} onChange={(e) => setRewardBix(e.target.value)} placeholder="BIX" />
          </div>
          <Textarea value={rewardReason} onChange={(e) => setRewardReason(e.target.value)} placeholder="Reason" />
          <Button onClick={handleGrantRewards} disabled={grantRewardsMutation.isPending}>{grantRewardsMutation.isPending ? "Granting..." : "Grant Reward"}</Button>
        </AdminFormSection>

        <AdminFormSection title="Timed Claim Notification">
          <Select value={claimAudience} onValueChange={(v) => setClaimAudience(v as "selected" | "all")}>
            <SelectTrigger><SelectValue placeholder="Audience" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="selected">Selected Users</SelectItem>
              <SelectItem value="all">All Users</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Selected users: {selectedUserIds.length.toLocaleString()} | Timeout is required before reward expires.</p>
          <div className="grid grid-cols-3 gap-2">
            <Input type="number" min="0" value={claimRewardXp} onChange={(e) => setClaimRewardXp(e.target.value)} placeholder="XP" />
            <Input type="number" min="0" value={claimRewardBix} onChange={(e) => setClaimRewardBix(e.target.value)} placeholder="BIX" />
            <Input type="number" min="1" value={claimTimeoutMinutes} onChange={(e) => setClaimTimeoutMinutes(e.target.value)} placeholder="Timeout (min)" />
          </div>
          <Textarea value={claimReason} onChange={(e) => setClaimReason(e.target.value)} placeholder="Notification reason" />
          <Button onClick={handleCreateClaimableRewards} disabled={createClaimableRewardsMutation.isPending}>
            {createClaimableRewardsMutation.isPending ? "Sending..." : "Send Claim Notification"}
          </Button>
        </AdminFormSection>
      </div>
    </div>
  );
}
