import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@northstar/web";

export const Default = () => (
  <ResizablePanelGroup direction="horizontal" className="h-[200px] w-[420px] rounded-lg border">
    <ResizablePanel defaultSize={35}>
      <div className="flex h-full items-center justify-center p-4 text-sm font-medium">Sidebar</div>
    </ResizablePanel>
    <ResizableHandle withHandle />
    <ResizablePanel defaultSize={65}>
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">Main content</div>
    </ResizablePanel>
  </ResizablePanelGroup>
);
