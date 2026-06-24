import { Checkbox, Label } from "@northstar/web";

export const States = () => (
  <div className="grid gap-3">
    <div className="flex items-center gap-2"><Checkbox id="c1" /><Label htmlFor="c1">Unchecked</Label></div>
    <div className="flex items-center gap-2"><Checkbox id="c2" defaultChecked /><Label htmlFor="c2">Checked</Label></div>
    <div className="flex items-center gap-2"><Checkbox id="c3" disabled /><Label htmlFor="c3">Disabled</Label></div>
    <div className="flex items-center gap-2"><Checkbox id="c4" defaultChecked disabled /><Label htmlFor="c4">Checked + disabled</Label></div>
  </div>
);

export const List = () => (
  <div className="grid gap-3">
    <p className="text-sm font-medium">Notifications</p>
    <div className="flex items-center gap-2"><Checkbox id="n1" defaultChecked /><Label htmlFor="n1">Email</Label></div>
    <div className="flex items-center gap-2"><Checkbox id="n2" defaultChecked /><Label htmlFor="n2">Push</Label></div>
    <div className="flex items-center gap-2"><Checkbox id="n3" /><Label htmlFor="n3">SMS</Label></div>
  </div>
);
