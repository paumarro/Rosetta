import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import Login from '@/pages/Login.tsx';
import { useState, useEffect } from 'react';

function AuthWrapper() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/auth/check', { credentials: 'include' })
      .then((res) => {
        setIsAuthenticated(res.ok);
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
  }, []);

  // Still checking? Show loading
  if (isAuthenticated === null) {
    return <div>Loading...</div>;
  }

  // No token? Show login
  if (!isAuthenticated) {
    return (
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
  }
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthWrapper />
  </StrictMode>,
);
