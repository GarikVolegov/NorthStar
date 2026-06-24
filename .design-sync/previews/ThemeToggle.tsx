import { ThemeToggle } from "@northstar/web";

export const Default = () => (
  <div className="flex items-center gap-3">
    <ThemeToggle />
    <span className="text-sm text-muted-foreground">Switch light / dark</span>
  </div>
);
