import type { AdminAuditItem } from "@/lib/adminApi";

type Props = {
  adminAuditLogs: AdminAuditItem[];
};

export function AdminAuditTab({ adminAuditLogs }: Props) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
      {adminAuditLogs.map((row) => (
        <div key={row.id} className="glass rounded-lg p-3">
          <p className="font-semibold text-sm">{row.action}</p>
          <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Admin: {row.admin_username || row.admin_user_id}</p>
        </div>
      ))}
    </div>
  );
}
