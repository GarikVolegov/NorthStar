import { Spinner } from "@northstar/web";

export const Sizes = () => (
  <div className="flex items-center gap-4 text-primary">
    <Spinner className="size-4" />
    <Spinner className="size-6" />
    <Spinner className="size-8" />
  </div>
);

export const WithLabel = () => (
  <div className="flex items-center gap-2 text-muted-foreground">
    <Spinner className="size-4" />
    <span className="text-sm">Loading your portfolio…</span>
  </div>
);
