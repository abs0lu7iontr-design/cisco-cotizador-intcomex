import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { APP_DISPLAY_NAME, getFormattedAppVersion } from './core/appVersion';
import { registerServiceWorker } from './core/serviceWorkerManager';

// Register enterprise PWA Service Worker in background when thread is idle (0ms startup latency)
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => registerServiceWorker());
  } else {
    setTimeout(() => registerServiceWorker(), 2000);
  }
}

// Keep browser window tab title always updated with dynamic app version
if (typeof document !== 'undefined') {
  document.title = `${APP_DISPLAY_NAME} ${getFormattedAppVersion()} | Intcomex`;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

