import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { APP_DISPLAY_NAME, getFormattedAppVersion } from './core/appVersion';

// Keep browser window tab title always updated with dynamic app version
if (typeof document !== 'undefined') {
  document.title = `${APP_DISPLAY_NAME} ${getFormattedAppVersion()} | Intcomex`;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

