import { Collapsible, CollapsibleTrigger, CollapsibleContent, Button } from "@northstar/web";

export const Default = () => (
  <Collapsible defaultOpen className="w-[360px] space-y-2">
    <div className="flex items-center justify-between">
      <h4 className="text-sm font-semibold">Recent transactions</h4>
      <CollapsibleTrigger asChild><Button variant="ghost" size="sm">Toggle</Button></CollapsibleTrigger>
    </div>
    <div className="rounded-md border px-4 py-2 text-sm">Coffee — €4.50</div>
    <CollapsibleContent className="space-y-2">
      <div className="rounded-md border px-4 py-2 text-sm">Groceries — €38.20</div>
      <div className="rounded-md border px-4 py-2 text-sm">Transit — €2.10</div>
    </CollapsibleContent>
  </Collapsible>
);
