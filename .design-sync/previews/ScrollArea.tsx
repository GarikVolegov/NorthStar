import { ScrollArea } from "@northstar/web";

export const Default = () => (
  <ScrollArea className="h-[200px] w-[300px] rounded-md border p-4">
    <h4 className="mb-3 text-sm font-medium">Activity log</h4>
    <div className="space-y-3 text-sm text-muted-foreground">
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="border-b pb-2">Event #{i + 1} — portfolio rebalanced</div>
      ))}
    </div>
  </ScrollArea>
);
