import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, Button, Input, Label } from "@northstar/web";

export const Default = () => (
  <Sheet defaultOpen modal={false}>
    <SheetContent side="right" style={{ transform: "none", opacity: 1, width: 360 }}>
      <SheetHeader>
        <SheetTitle>Notifications</SheetTitle>
        <SheetDescription>Choose what you want to be notified about.</SheetDescription>
      </SheetHeader>
      <div className="grid gap-3 px-4 py-4">
        <div className="grid gap-2"><Label htmlFor="se">Email digest</Label><Input id="se" defaultValue="Daily" /></div>
        <div className="grid gap-2"><Label htmlFor="sp">Push alerts</Label><Input id="sp" defaultValue="Important only" /></div>
      </div>
      <SheetFooter><Button>Save preferences</Button></SheetFooter>
    </SheetContent>
  </Sheet>
);
