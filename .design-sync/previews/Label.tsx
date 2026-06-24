import { Label, Input, Checkbox } from "@northstar/web";

export const Default = () => <Label>Email address</Label>;

export const WithControl = () => (
  <div className="grid w-[300px] gap-2">
    <Label htmlFor="name">Full name</Label>
    <Input id="name" placeholder="Jane Doe" />
  </div>
);

export const WithCheckbox = () => (
  <div className="flex items-center gap-2">
    <Checkbox id="terms" defaultChecked />
    <Label htmlFor="terms">Accept terms and conditions</Label>
  </div>
);
