import { Input, Label } from "@northstar/web";

export const Default = () => (
  <div className="grid w-[320px] gap-2">
    <Label htmlFor="email">Email</Label>
    <Input id="email" type="email" placeholder="you@example.com" />
  </div>
);

export const States = () => (
  <div className="grid w-[320px] gap-3">
    <Input placeholder="Default" />
    <Input defaultValue="Filled in" />
    <Input placeholder="Disabled" disabled />
    <Input type="password" defaultValue="supersecret" />
  </div>
);

export const WithButton = () => (
  <div className="flex w-[360px] items-end gap-2">
    <div className="grid flex-1 gap-2">
      <Label htmlFor="q">Search</Label>
      <Input id="q" placeholder="Search transactions..." />
    </div>
  </div>
);
