import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlatformSetting } from "@/lib/adminApi";
import type { UseMutationResult } from "@tanstack/react-query";

type Props = {
  adminSettings: PlatformSetting[];
  settingDrafts: Record<string, string>;
  setSettingDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateSettingMutation: UseMutationResult<any, unknown, any, unknown>;
};

export function AdminSettingsTab({ adminSettings, settingDrafts, setSettingDrafts, updateSettingMutation }: Props) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
      {adminSettings.map((setting) => (
        <div key={setting.id} className="glass rounded-lg p-3 space-y-2">
          <p className="font-medium">{setting.key}</p>
          <Input value={settingDrafts[setting.key] ?? setting.value} onChange={(e) => setSettingDrafts((prev) => ({ ...prev, [setting.key]: e.target.value }))} />
          <Button size="sm" onClick={() => updateSettingMutation.mutate({ key: setting.key, value: settingDrafts[setting.key] ?? setting.value, description: setting.description })} disabled={updateSettingMutation.isPending}>Save</Button>
        </div>
      ))}
    </div>
  );
}
