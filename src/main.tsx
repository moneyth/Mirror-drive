import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Aggressive cache clearing and service worker unregistration to force immediate updates
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then((success) => {
        if (success) console.log('Service Worker unregistered successfully to bypass cache.');
      });
    }
  });
}

if ('caches' in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      caches.delete(key).then(() => {
        console.log('Cache cleared programmatically:', key);
      });
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
