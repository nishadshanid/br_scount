import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerServiceWorker } from './pwa';
import { DataProvider } from './state';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <DataProvider>
          <App />
        </DataProvider>
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
);

registerServiceWorker();
