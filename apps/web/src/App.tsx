/**
 * App.tsx — apps/web
 *
 * Re-export dell'App da lib/api-client-react.
 * Tutta la logica router/layout vive nel pacchetto lib;
 * questo file è il punto di mount per il build Vite.
 *
 * Per aggiungere route specifiche di apps/web (es. /wendy, /affiliate)
 * estendi qui invece di modificare la lib condivisa.
 */
export { default } from '../../../lib/api-client-react/src/App';
