import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';

// StrictMode disabled to prevent duplicate WebSocket connections during load testing
// StrictMode in development double-mounts components, causing race conditions
// with WebSocket provider cleanup

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById('root')!).render(
  <BrowserRouter basename="/studio">
    <App />
  </BrowserRouter>,
);
