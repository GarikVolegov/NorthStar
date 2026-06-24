import { Switch, Label } from "@northstar/web";

export const States = () => (
  <div className="grid gap-3">
    <div className="flex items-center gap-3"><Switch id="s1" /><Label htmlFor="s1">Off</Label></div>
    <div className="flex items-center gap-3"><Switch id="s2" defaultChecked /><Label htmlFor="s2">On</Label></div>
    <div className="flex items-center gap-3"><Switch id="s3" disabled /><Label htmlFor="s3">Disabled</Label></div>
  </div>
);

export const SettingsRow = () => (
  <div className="flex w-[340px] items-center justify-between rounded-lg border p-4">
    <div className="grid gap-0.5">
      <Label htmlFor="airplane">Airplane mode</Label>
      <span className="text-xs text-muted-foreground">Disable all wireless connections</span>
    </div>
    <Switch id="airplane" defaultChecked />
  </div>
);
