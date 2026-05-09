import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { reportWebVitals } from "./vitals"; // ✅ fix: import locale, no cross-package path

createRoot(document.getElementById("root")!).render(<App />);

// Avvia il monitoraggio Web Vitals (LCP, CLS, TTFB, INP)
// In dev: log colorato in console. In prod: TODO → /api/analytics/vitals
reportWebVitals();
