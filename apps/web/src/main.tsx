import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import "./index.css";
import "./i18n";

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

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
  </>
);
