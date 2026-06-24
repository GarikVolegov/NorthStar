import { Alert, AlertTitle, AlertDescription } from "@northstar/web";

export const Default = () => (
  <Alert className="w-[440px]">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
    </svg>
    <AlertTitle>Heads up</AlertTitle>
    <AlertDescription>
      Your next portfolio review is scheduled for Monday. We&apos;ll email you a summary beforehand.
    </AlertDescription>
  </Alert>
);

export const Destructive = () => (
  <Alert variant="destructive" className="w-[440px]">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4M12 17h.01" />
    </svg>
    <AlertTitle>Payment failed</AlertTitle>
    <AlertDescription>
      We couldn&apos;t process your card ending in 4242. Update your billing details to keep your subscription active.
    </AlertDescription>
  </Alert>
);
