/**
 * reportWebVitals.ts
 *
 * Phase 0 — Baseline mobile performance logging.
 *
 * Collects Core Web Vitals and logs them to the console in a
 * structured, color-coded format. Active only in non-production
 * environments (called conditionally in main.tsx).
 *
 * Metrics captured:
 *   - LCP  Largest Contentful Paint    → target: < 2500ms  (good)
 *   - FID  First Input Delay           → target: < 100ms   (good)
 *   - INP  Interaction to Next Paint   → target: < 200ms   (good)
 *   - CLS  Cumulative Layout Shift     → target: < 0.1     (good)
 *   - FCP  First Contentful Paint      → target: < 1800ms  (good)
 *   - TTFB Time to First Byte          → target: < 800ms   (good)
 *
 * Usage: results appear in browser DevTools console.
 * Filter by "[WebVitals]" to isolate them.
 *
 * Phase 2 upgrade: replace console.log with a POST to /api/vitals
 * or pipe into an analytics provider (Vercel Analytics, etc.).
 */

import type { Metric } from 'web-vitals';

const THRESHOLDS: Record<string, { good: number; needsImprovement: number }> = {
  LCP:  { good: 2500,  needsImprovement: 4000  },
  FID:  { good: 100,   needsImprovement: 300   },
  INP:  { good: 200,   needsImprovement: 500   },
  CLS:  { good: 0.1,   needsImprovement: 0.25  },
  FCP:  { good: 1800,  needsImprovement: 3000  },
  TTFB: { good: 800,   needsImprovement: 1800  },
};

function getStatus(name: string, value: number): '🟢 GOOD' | '🟡 NEEDS IMPROVEMENT' | '🔴 POOR' {
  const t = THRESHOLDS[name];
  if (!t) return '🟢 GOOD';
  if (value <= t.good) return '🟢 GOOD';
  if (value <= t.needsImprovement) return '🟡 NEEDS IMPROVEMENT';
  return '🔴 POOR';
}

function onMetric(metric: Metric): void {
  const status = getStatus(metric.name, metric.value);
  const unit = metric.name === 'CLS' ? '' : 'ms';
  const display = metric.name === 'CLS'
    ? metric.value.toFixed(4)
    : Math.round(metric.value).toString();

  // Structured log — filter in DevTools by "[WebVitals]"
  console.log(
    `%c[WebVitals] %c${metric.name}%c ${display}${unit} ${status}`,
    'color: #6366f1; font-weight: bold;',
    'color: #e2e8f0; font-weight: bold;',
    'color: #94a3b8;',
  );

  // Optional: also log to performance buffer for manual inspection
  if (typeof window.__northstar_vitals === 'undefined') {
    window.__northstar_vitals = [];
  }
  window.__northstar_vitals.push({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigationType: metric.navigationType,
    timestamp: Date.now(),
    route: window.location.pathname,
  });
}

export async function reportWebVitals(): Promise<void> {
  try {
    const { onLCP, onFID, onINP, onCLS, onFCP, onTTFB } = await import('web-vitals');
    onLCP(onMetric);
    onFID(onMetric);
    onINP(onMetric);
    onCLS(onMetric);
    onFCP(onMetric);
    onTTFB(onMetric);

    console.log(
      '%c[WebVitals] Monitoring attivo. Risultati in console filtrati per [WebVitals]. Per vedere tutti i dati raccolti: window.__northstar_vitals',
      'color: #6366f1; font-style: italic;'
    );
  } catch {
    // web-vitals not installed — silent fail in dev
    console.warn('[WebVitals] Pacchetto web-vitals non trovato. Installa con: pnpm --filter @northstar/web add web-vitals');
  }
}

// Augment Window type to avoid TS errors
declare global {
  interface Window {
    __northstar_vitals: Array<{
      name: string;
      value: number;
      rating: string;
      navigationType: string;
      timestamp: number;
      route: string;
    }>;
  }
}
