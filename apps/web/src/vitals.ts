/**
 * vitals.ts — Web Vitals monitoring
 *
 * In development: stampa in console ogni metrica con nome, valore e rating.
 * In production:  TODO → fare fetch verso /api/analytics/vitals
 *
 * Uso: importa e chiama reportWebVitals() in main.tsx dopo ReactDOM.createRoot.
 */
import { onFID, onLCP, onCLS, onTTFB, onINP } from "web-vitals";

type Metric = { name: string; value: number; rating: string };

function sendToAnalytics(metric: Metric): void {
  if (import.meta.env.DEV) {
    const color =
      metric.rating === "good"
        ? "color: #16a34a"
        : metric.rating === "needs-improvement"
        ? "color: #d97706"
        : "color: #dc2626";
    console.log(
      `%c[Web Vitals] ${metric.name}: ${Math.round(metric.value)}ms — ${metric.rating}`,
      color
    );
    return;
  }

  // Production: invia al backend (decommentare quando l'endpoint è pronto)
  // void fetch("/api/analytics/vitals", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(metric),
  // });
}

export function reportWebVitals(): void {
  onFID(sendToAnalytics);
  onLCP(sendToAnalytics);
  onCLS(sendToAnalytics);
  onTTFB(sendToAnalytics);
  onINP(sendToAnalytics);
}
