import { Cta } from "@northstar/web";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Cta>Get started</Cta>
    <Cta variant="secondary">Learn more</Cta>
    <Cta variant="ghost">Skip</Cta>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Cta size="sm">Small</Cta>
    <Cta size="default">Default</Cta>
    <Cta size="lg">Large</Cta>
  </div>
);

export const WithIcon = () => (
  <Cta size="lg" icon={
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  }>Start your journey</Cta>
);
