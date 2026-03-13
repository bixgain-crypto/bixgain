import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { AdminUser } from "@/lib/adminApi";
import type { UseMutationResult } from "@tanstack/react-query";

type Props = {
  users: AdminUser[];
  filteredUsers: AdminUser[];
  userSearch: string;
  setUserSearch: (v: string) => void;
  selectedUserIds: string[];
  toggleUserSelection: (userId: string, checked: boolean) => void;
  toggleSelectAllFiltered: (checked: boolean) => void;
  toggleSelectAllUsers: (checked: boolean) => void;
  setSelectedUserIds: (ids: string[]) => void;
  allFilteredSelected: boolean;
  allUsersSelected: boolean;
  loading: boolean;
  refreshAdminViews: () => Promise<void>;
  updateUserMutation: UseMutationResult<any, unknown, any, unknown>;
};

export function AdminUsersTab({
  users, filteredUsers, userSearch, setUserSearch, selectedUserIds,
  toggleUserSelection, toggleSelectAllFiltered, toggleSelectAllUsers,
  setSelectedUserIds, allFilteredSelected, allUsersSelected, loading,
  refreshAdminViews, updateUserMutation,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search users" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
        <Button variant="outline" onClick={() => void refreshAdminViews()} disabled={loading}>Refresh</Button>
        <Button variant="outline" onClick={() => toggleSelectAllFiltered(!allFilteredSelected)} disabled={filteredUsers.length === 0}>
          {allFilteredSelected ? "Unselect Filtered" : "Select Filtered"}
        </Button>
        <Button variant="outline" onClick={() => toggleSelectAllUsers(!allUsersSelected)} disabled={users.length === 0}>
          {allUsersSelected ? "Unselect All Users" : "Select All Users"}
        </Button>
        <Button variant="outline" onClick={() => setSelectedUserIds([])} disabled={selectedUserIds.length === 0}>
          Clear Selection ({selectedUserIds.length})
        </Button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading users...</p> : null}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
        {filteredUsers.map((item) => (
          <div key={item.id} className="glass rounded-lg p-3 space-y-2">
            <div className="flex justify-between gap-2 items-center">
              <div className="flex items-start gap-2">
                <Checkbox checked={selectedUserIds.includes(item.id)} onCheckedChange={(checked) => toggleUserSelection(item.id, checked === true)} aria-label={`Select ${item.username || item.id}`} />
                <div>
                  <p className="font-semibold">{item.username || "Unnamed user"}</p>
                  <p className="text-xs text-muted-foreground">{item.id}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Badge variant={item.is_admin ? "default" : "secondary"}>{item.is_admin ? "Admin" : "User"}</Badge>
                <Badge variant={item.is_active ? "default" : "destructive"}>{item.is_active ? "Active" : "Inactive"}</Badge>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">XP {Number(item.total_xp || 0).toLocaleString()} | BIX {Number(item.bix_balance || 0).toLocaleString()}</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={updateUserMutation.isPending} onClick={() => updateUserMutation.mutate({ target_user_id: item.id, is_active: !item.is_active })}>{item.is_active ? "Deactivate" : "Activate"}</Button>
              <Button size="sm" variant="outline" disabled={updateUserMutation.isPending} onClick={() => updateUserMutation.mutate({ target_user_id: item.id, is_frozen: !item.is_frozen })}>{item.is_frozen ? "Unfreeze" : "Freeze"}</Button>
              <Button size="sm" disabled={updateUserMutation.isPending} onClick={() => updateUserMutation.mutate({ target_user_id: item.id, is_admin: !item.is_admin, admin_role: !item.is_admin ? "admin" : "user" })}>{item.is_admin ? "Revoke Admin" : "Make Admin"}</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
