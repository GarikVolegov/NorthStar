import { Popover, PopoverTrigger, PopoverContent, Button, Label, Input } from "@northstar/web";

export const Default = () => (
  <Popover defaultOpen modal={false}>
    <PopoverTrigger asChild><Button variant="outline">Open settings</Button></PopoverTrigger>
    <PopoverContent className="w-80">
      <div className="grid gap-4">
        <div className="space-y-1">
          <h4 className="font-medium leading-none">Dimensions</h4>
          <p className="text-sm text-muted-foreground">Set the layout dimensions.</p>
        </div>
        <div className="grid gap-2">
          <div className="grid grid-cols-3 items-center gap-2"><Label htmlFor="w">Width</Label><Input id="w" defaultValue="100%" className="col-span-2 h-8" /></div>
          <div className="grid grid-cols-3 items-center gap-2"><Label htmlFor="h">Height</Label><Input id="h" defaultValue="24px" className="col-span-2 h-8" /></div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
);
