import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, Button } from "@northstar/web";

export const Default = () => (
  <Drawer open>
    <DrawerContent>
      <div className="mx-auto w-full max-w-sm">
        <DrawerHeader>
          <DrawerTitle>Confirm payment</DrawerTitle>
          <DrawerDescription>You're about to pay €49.00 for your annual plan.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button>Pay now</Button>
          <Button variant="outline">Cancel</Button>
        </DrawerFooter>
      </div>
    </DrawerContent>
  </Drawer>
);
