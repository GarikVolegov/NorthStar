import { Separator } from "@northstar/web";

export const Horizontal = () => (
  <div className="w-[300px]">
    <div className="space-y-1">
      <h4 className="text-sm font-medium leading-none">Radix Primitives</h4>
      <p className="text-sm text-muted-foreground">An open-source UI component library.</p>
    </div>
    <Separator className="my-4" />
    <div className="flex h-5 items-center gap-3 text-sm">
      <span>Blog</span>
      <Separator orientation="vertical" />
      <span>Docs</span>
      <Separator orientation="vertical" />
      <span>Source</span>
    </div>
  </div>
);
