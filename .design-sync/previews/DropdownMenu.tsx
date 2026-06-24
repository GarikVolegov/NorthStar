import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, Button } from "@northstar/web";

export const Default = () => (
  <DropdownMenu defaultOpen modal={false}>
    <DropdownMenuTrigger asChild><Button variant="outline">Open menu</Button></DropdownMenuTrigger>
    <DropdownMenuContent className="w-56">
      <DropdownMenuLabel>My account</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem>Profile<DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut></DropdownMenuItem>
      <DropdownMenuItem>Billing<DropdownMenuShortcut>⌘B</DropdownMenuShortcut></DropdownMenuItem>
      <DropdownMenuItem>Settings<DropdownMenuShortcut>⌘S</DropdownMenuShortcut></DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem>Log out</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
