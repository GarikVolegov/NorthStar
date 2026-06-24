import { Textarea, Label } from "@northstar/web";

export const Default = () => (
  <div className="grid w-[360px] gap-2">
    <Label htmlFor="msg">Your message</Label>
    <Textarea id="msg" placeholder="Tell us what you think..." rows={4} />
  </div>
);

export const Filled = () => (
  <Textarea className="w-[360px]" rows={4} defaultValue={"Loved the new dashboard \u2014 the performance summary is exactly what I needed."} />
);
