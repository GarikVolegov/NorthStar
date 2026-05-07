import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";

if ("serviceWorker" in navigator) {
  if (import.meta.env.DEV) {
    // In development, unregister any stale service workers so they don't
    // intercept Vite HMR requests or serve cached blank pages on mobile.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    }).catch(() => {});
  } else {
    const swPath = `${import.meta.env.BASE_URL}sw.js`.replace(/\/+/g, "/").replace(/^([^/])/, "/$1");
    navigator.serviceWorker.register(swPath).catch((err) => {
      console.warn("[sw] Registration failed:", err);
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
