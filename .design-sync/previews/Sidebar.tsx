import {
  SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter,
} from "@northstar/web";

export const Default = () => (
  <div className="h-[360px] w-[260px] overflow-hidden rounded-lg border">
    <SidebarProvider className="min-h-0">
      <Sidebar collapsible="none" className="h-[360px]">
        <SidebarHeader className="px-3 py-3 text-sm font-semibold">North Star</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem><SidebarMenuButton isActive>Dashboard</SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton>Portfolio</SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton>Reports</SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton>Settings</SidebarMenuButton></SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="px-3 py-3 text-xs text-muted-foreground">v1.0</SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  </div>
);
