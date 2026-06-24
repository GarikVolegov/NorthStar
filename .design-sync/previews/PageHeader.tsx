import { PageHeader, Button } from "@northstar/web";

export const Default = () => (
  <div className="w-[560px]">
    <PageHeader
      title="Portfolio"
      description="Track performance, allocations, and upcoming reviews."
      actions={<Button>New report</Button>}
    />
  </div>
);
