import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, Input, Label } from "@northstar/web";

export const Default = () => (
  <Dialog defaultOpen modal={false}>
    <DialogContent className="sm:max-w-[440px]">
      <DialogHeader>
        <DialogTitle>Edit profile</DialogTitle>
        <DialogDescription>Make changes to your profile. Click save when you're done.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2"><Label htmlFor="dn">Name</Label><Input id="dn" defaultValue="Jane Doe" /></div>
        <div className="grid gap-2"><Label htmlFor="du">Username</Label><Input id="du" defaultValue="@jane" /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost">Cancel</Button>
        <Button>Save changes</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
