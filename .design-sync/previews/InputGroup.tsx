import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupText } from "@northstar/web";

export const WithIcon = () => (
  <InputGroup className="w-[320px]">
    <InputGroupAddon>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
    </InputGroupAddon>
    <InputGroupInput placeholder="Search..." />
  </InputGroup>
);

export const WithText = () => (
  <InputGroup className="w-[320px]">
    <InputGroupAddon><InputGroupText>https://</InputGroupText></InputGroupAddon>
    <InputGroupInput placeholder="your-site" defaultValue="north-star" />
    <InputGroupAddon align="inline-end"><InputGroupText>.app</InputGroupText></InputGroupAddon>
  </InputGroup>
);
