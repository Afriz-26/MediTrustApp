import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Keep the PWA service worker out of Vite development so it cannot serve stale modules.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const workerUrl = new URL('/sw.js', window.location.origin).href;
    Promise.all([
      navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations
          .filter((registration) =>
            [registration.active, registration.waiting, registration.installing]
              .some((worker) => worker?.scriptURL === workerUrl))
          .map((registration) => registration.unregister()))
      ),
      caches.delete('meditrust-v1'),
    ]).catch((error) => console.error('Failed to clear stale development service-worker assets.', error));
  });
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.error('Failed to register service worker.', error));
  });
}