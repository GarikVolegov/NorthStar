import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Tailwind 4: import diretto del CSS invece di tailwind.config.js
import './index.css';

// App principale (router + layout)
// Importata da lib/api-client-react tramite re-export in App.tsx
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('[NorthStar] #root element not found in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
