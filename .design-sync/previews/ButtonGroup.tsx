import { ButtonGroup, Button } from "@northstar/web";

export const Default = () => (
  <ButtonGroup>
    <Button variant="outline">Day</Button>
    <Button variant="outline">Week</Button>
    <Button variant="outline">Month</Button>
  </ButtonGroup>
);

export const Actions = () => (
  <ButtonGroup>
    <Button variant="outline">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
      Refresh
    </Button>
    <Button variant="outline">Export</Button>
  </ButtonGroup>
);
