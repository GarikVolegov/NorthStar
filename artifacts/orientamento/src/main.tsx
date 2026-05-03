import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  const swPath = `${import.meta.env.BASE_URL}sw.js`.replace(/\/+/g, "/").replace(/^([^/])/, "/$1");
  navigator.serviceWorker.register(swPath).catch((err) => {
    console.warn("[sw] Registration failed:", err);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
