import { Progress } from "@northstar/web";

export const Levels = () => (
  <div className="grid w-[320px] gap-4">
    <Progress value={20} />
    <Progress value={60} />
    <Progress value={100} />
  </div>
);

export const WithLabel = () => (
  <div className="grid w-[320px] gap-2">
    <div className="flex justify-between text-sm"><span>Uploading…</span><span className="text-muted-foreground">72%</span></div>
    <Progress value={72} />
  </div>
);
