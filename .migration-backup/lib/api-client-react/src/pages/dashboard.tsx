/**
 * dashboard.tsx — shim di compatibilità
 *
 * App.tsx importa '@/pages/dashboard'.
 * Il router intelligente vive in '@/pages/dashboard/index.tsx'.
 * Questo file re-exporta il default così il lazy import di App.tsx
 * continua a funzionare senza modifiche.
 */
export { default } from './dashboard/index';
