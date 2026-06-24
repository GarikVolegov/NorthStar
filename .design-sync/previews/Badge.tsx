import { Badge } from "@northstar/web";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge>Default</Badge>
    <Badge variant="secondary">Secondary</Badge>
    <Badge variant="destructive">Destructive</Badge>
    <Badge variant="outline">Outline</Badge>
  </div>
);

export const Status = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge className="bg-emerald-600 text-white">Active</Badge>
    <Badge variant="secondary">Pending</Badge>
    <Badge variant="destructive">Overdue</Badge>
    <Badge variant="outline">Archived</Badge>
  </div>
);
