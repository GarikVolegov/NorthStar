import { ToastProvider, Toast, ToastTitle, ToastDescription, ToastAction, ToastClose, ToastViewport } from "@northstar/web";

export const Default = () => (
  <ToastProvider duration={1000000}>
    <Toast open style={{ position: "static", transform: "none", opacity: 1, width: 380 }} className="animate-none">
      <div className="grid gap-1">
        <ToastTitle>Changes saved</ToastTitle>
        <ToastDescription>Your portfolio settings were updated.</ToastDescription>
      </div>
      <ToastAction altText="Undo">Undo</ToastAction>
      <ToastClose />
    </Toast>
    <ToastViewport style={{ position: "static", margin: 0, padding: 0, width: "auto" }} />
  </ToastProvider>
);
