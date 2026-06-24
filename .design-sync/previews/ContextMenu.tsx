import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut } from "@northstar/web";

export const Default = () => (
  <ContextMenu>
    <ContextMenuTrigger className="flex h-[140px] w-[320px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      Right-click here
    </ContextMenuTrigger>
    <ContextMenuContent className="w-52">
      <ContextMenuItem>Back<ContextMenuShortcut>⌘[</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuItem>Forward<ContextMenuShortcut>⌘]</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem>Reload<ContextMenuShortcut>⌘R</ContextMenuShortcut></ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
);
