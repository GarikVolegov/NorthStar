import { FormGroup, Input } from "@northstar/web";

export const Default = () => (
  <div className="w-[360px]">
    <FormGroup label="Display name" description="This is how others will see you." required>
      <Input placeholder="Jane Doe" defaultValue="Jane Doe" />
    </FormGroup>
  </div>
);

export const WithError = () => (
  <div className="w-[360px]">
    <FormGroup label="Email" error="Please enter a valid email address.">
      <Input defaultValue="jane@" />
    </FormGroup>
  </div>
);
