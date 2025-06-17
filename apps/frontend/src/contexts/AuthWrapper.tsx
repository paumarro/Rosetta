import { BrowserRouter } from 'react-router-dom';
import App from '@/App.tsx';
import Login from '@/pages/Login.tsx';
import { useState, useEffect } from 'react';

export function AuthWrapper() {
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
