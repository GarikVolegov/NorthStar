import { Tabs, TabsList, TabsTrigger, TabsContent } from "@northstar/web";

export const Default = () => (
  <Tabs defaultValue="overview" className="w-[420px]">
    <TabsList>
      <TabsTrigger value="overview">Overview</TabsTrigger>
      <TabsTrigger value="analytics">Analytics</TabsTrigger>
      <TabsTrigger value="reports">Reports</TabsTrigger>
    </TabsList>
    <TabsContent value="overview" className="pt-3 text-sm text-muted-foreground">
      A snapshot of your portfolio performance and recent activity.
    </TabsContent>
    <TabsContent value="analytics" className="pt-3 text-sm text-muted-foreground">
      Deep-dive charts and trends.
    </TabsContent>
  </Tabs>
);
