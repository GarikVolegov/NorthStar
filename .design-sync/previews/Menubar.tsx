import { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarShortcut } from "@northstar/web";

export const Default = () => (
  <Menubar>
    <MenubarMenu>
      <MenubarTrigger>File</MenubarTrigger>
      <MenubarContent>
        <MenubarItem>New Tab<MenubarShortcut>⌘T</MenubarShortcut></MenubarItem>
        <MenubarItem>New Window<MenubarShortcut>⌘N</MenubarShortcut></MenubarItem>
        <MenubarSeparator />
        <MenubarItem>Print<MenubarShortcut>⌘P</MenubarShortcut></MenubarItem>
      </MenubarContent>
    </MenubarMenu>
    <MenubarMenu><MenubarTrigger>Edit</MenubarTrigger></MenubarMenu>
    <MenubarMenu><MenubarTrigger>View</MenubarTrigger></MenubarMenu>
  </Menubar>
);
