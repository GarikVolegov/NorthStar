import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button, Badge, Input, Label,
} from "@northstar/web";

export const Default = () => (
  <Card className="w-[360px]">
    <CardHeader>
      <CardTitle>Monthly performance</CardTitle>
      <CardDescription>Your portfolio over the last 30 days.</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight">+12.4%</span>
        <Badge variant="secondary">Outperforming</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Up 3.1 points versus the benchmark since your last review.
      </p>
    </CardContent>
    <CardFooter className="justify-between">
      <span className="text-xs text-muted-foreground">Updated just now</span>
      <Button size="sm">View report</Button>
    </CardFooter>
  </Card>
);

export const FormCard = () => (
  <Card className="w-[360px]">
    <CardHeader>
      <CardTitle>Create workspace</CardTitle>
      <CardDescription>Set up a space for your team.</CardDescription>
    </CardHeader>
    <CardContent className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="ws-name">Workspace name</Label>
        <Input id="ws-name" placeholder="Acme Inc." defaultValue="North Star" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ws-slug">URL slug</Label>
        <Input id="ws-slug" placeholder="acme" defaultValue="north-star" />
      </div>
    </CardContent>
    <CardFooter className="justify-end gap-2">
      <Button variant="ghost">Cancel</Button>
      <Button>Create</Button>
    </CardFooter>
  </Card>
);

export const Stat = () => (
  <Card className="w-[240px]">
    <CardHeader className="pb-2">
      <CardDescription>Active members</CardDescription>
      <CardTitle className="text-3xl">2,318</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-xs text-muted-foreground">+180 this week</p>
    </CardContent>
  </Card>
);
