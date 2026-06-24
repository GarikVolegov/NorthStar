import { Toggle } from "@northstar/web";

export const States = () => (
  <div className="flex items-center gap-3">
    <Toggle aria-label="Bold">B</Toggle>
    <Toggle aria-label="Italic" defaultPressed><span className="italic">I</span></Toggle>
    <Toggle aria-label="Disabled" disabled>U</Toggle>
  </div>
);

export const WithIcon = () => (
  <Toggle aria-label="Toggle star" defaultPressed>
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
    </svg>
  </Toggle>
);
