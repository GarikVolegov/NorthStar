import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent, Button } from "@northstar/web";

export const Default = () => (
  <Empty className="w-[380px] rounded-lg border">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
      </EmptyMedia>
      <EmptyTitle>No reports yet</EmptyTitle>
      <EmptyDescription>Create your first report to start tracking performance.</EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <Button size="sm">Create report</Button>
    </EmptyContent>
  </Empty>
);
