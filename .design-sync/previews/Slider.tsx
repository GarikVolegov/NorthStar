import { Slider, Label } from "@northstar/web";

export const Default = () => (
  <div className="w-[320px]"><Slider defaultValue={[60]} max={100} step={1} /></div>
);

export const Range = () => (
  <div className="grid w-[320px] gap-2">
    <Label>Price range</Label>
    <Slider defaultValue={[25, 75]} max={100} step={1} />
  </div>
);
