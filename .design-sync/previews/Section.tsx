import { Section, Card, CardHeader, CardTitle, CardContent } from "@northstar/web";

export const Default = () => (
  <div className="w-[560px]">
    <Section title="Recent activity" description="What happened across your workspace this week.">
      <div className="grid grid-cols-2 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">128</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Transactions</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">12</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">New members</CardContent></Card>
      </div>
    </Section>
  </div>
);
