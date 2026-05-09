/**
 * vitals.ts — Web Vitals monitoring (locale al mockup-sandbox)
 *
 * Copia locale di apps/web/src/vitals.ts per evitare import cross-package
 * che rompono Vite con fs.strict: true.
 *
 * NOTA: onFID è stato rimosso in web-vitals v4 (sostituito da onINP).
 * NOTA: CLS è adimensionale (0–1), non in ms — log separato.
 */
import { onLCP, onCLS, onTTFB, onINP, type Metric } from "web-vitals";

function sendToAnalytics(metric: Metric, unit: "ms" | "score" = "ms"): void {
  if (import.meta.env.DEV) {
    const color =
      metric.rating === "good"
        ? "color: #16a34a"
        : metric.rating === "needs-improvement"
        ? "color: #d97706"
        : "color: #dc2626";

    const formatted =
      unit === "score"
        ? metric.value.toFixed(3)          // CLS: adimensionale, non ms
        : `${Math.round(metric.value)}ms`; // LCP, INP, TTFB: millisecondi

    console.log(
      `%c[Web Vitals] ${metric.name}: ${formatted} — ${metric.rating}`,
      color
    );
    return;
  }

  // Production: invia al backend (decommentare quando l'endpoint è pronto)
  // void fetch("/api/analytics/vitals", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ name: metric.name, value: metric.value, rating: metric.rating }),
  // });
}

export function reportWebVitals(): void {
  onLCP((m) => sendToAnalytics(m, "ms"));
  onCLS((m) => sendToAnalytics(m, "score")); // CLS = Cumulative Layout Shift, adimensionale
  onTTFB((m) => sendToAnalytics(m, "ms"));
  onINP((m) => sendToAnalytics(m, "ms"));   // INP sostituisce FID in web-vitals v4
}
