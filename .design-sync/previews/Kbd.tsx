import { Kbd, KbdGroup } from "@northstar/web";

export const Default = () => (
  <div className="flex flex-col items-start gap-3 text-sm">
    <KbdGroup><Kbd>{"⌘"}</Kbd><Kbd>K</Kbd></KbdGroup>
    <div className="flex items-center gap-2 text-muted-foreground">
      <span>Press</span>
      <KbdGroup><Kbd>Ctrl</Kbd><Kbd>{"⇧"}</Kbd><Kbd>P</Kbd></KbdGroup>
      <span>to open the command palette</span>
    </div>
  </div>
);
