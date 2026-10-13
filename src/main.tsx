import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ensureSeed } from './lib/db';
import './styles.css';

// Après une mise à jour du site, une page chargée à la demande peut ne plus exister : on recharge une fois
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  try {
    if (sessionStorage.getItem('foxbox-reloaded') === '1') return;
    sessionStorage.setItem('foxbox-reloaded', '1');
  } catch {
    /* navigation privée */
  }
  location.reload();
});
window.addEventListener('load', () => setTimeout(() => {
  try {
    sessionStorage.removeItem('foxbox-reloaded');
  } catch {
    /* navigation privée */
  }
}, 10000));

ensureSeed().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
