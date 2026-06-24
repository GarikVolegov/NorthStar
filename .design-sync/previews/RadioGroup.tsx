import { RadioGroup, RadioGroupItem, Label } from "@northstar/web";

export const Default = () => (
  <RadioGroup defaultValue="monthly" className="grid gap-3">
    <div className="flex items-center gap-2"><RadioGroupItem value="monthly" id="r1" /><Label htmlFor="r1">Monthly</Label></div>
    <div className="flex items-center gap-2"><RadioGroupItem value="annual" id="r2" /><Label htmlFor="r2">Annual (save 20%)</Label></div>
    <div className="flex items-center gap-2"><RadioGroupItem value="lifetime" id="r3" /><Label htmlFor="r3">Lifetime</Label></div>
  </RadioGroup>
);
