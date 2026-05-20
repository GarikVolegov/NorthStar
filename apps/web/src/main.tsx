import { ClerkProvider } from "@clerk/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./i18n";
import "./index.css";
import "./lib/sentry";

/**
 * Registra il Service Worker in idle time, non al caricamento iniziale.
 * Questo evita che la registrazione SW competa con il parsing del bundle
 * principale e il primo render di React sul thread principale.
 *
 * requestIdleCallback è supportato da tutti i browser moderni;
 * il fallback setTimeout(2000) garantisce la registrazione anche su Safari.
 */
function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) reg.unregister();
    }).catch(() => {});
    return;
  }

  const doRegister = () => {
    const swPath = `${import.meta.env.BASE_URL}sw.js`
      .replace(/\/+/g, "/")
      .replace(/^([^/])/, "/$1");
    navigator.serviceWorker.register(swPath).catch((err) => {
      console.warn("[sw] Registration failed:", err);
    });
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(doRegister, { timeout: 5000 });
  } else {
    setTimeout(doRegister, 2000);
  }
}

registerSW();

/**
 * Clerk appearance personalizzato — tema "Deep Navy Premium" di NorthStar.
 */
const clerkAppearance = {
  variables: {
    colorPrimary: "#c19e4a",
    colorBackground: "#131621",
    colorInputBackground: "#171b28",
    colorText: "#e6e8ed",
    colorTextSecondary: "#7a7f96",
    colorTextOnPrimaryBackground: "#0b0d12",
    colorInputText: "#e6e8ed",
    colorDanger: "#d94f45",
    colorSuccess: "#7db89a",
    colorNeutral: "#1e2233",
    borderRadius: "0.75rem",
    fontFamily: "'Inter', system-ui, sans-serif",
    fontFamilyButtons: "'Inter', system-ui, sans-serif",
    fontSize: "14px",
    spacingUnit: "8px",
  },
  layout: {
    logoPlacement: "inside",
    socialButtonsPlacement: "top",
    showOptionalFields: false,
    privacyPageUrl: "/privacy-policy",
    termsPageUrl: "/termini-di-servizio",
  },
};

createRoot(document.getElementById("root")!).render(
  <ClerkProvider
    publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
    afterSignOutUrl="/"
    appearance={clerkAppearance}
  >
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </ClerkProvider>
);
