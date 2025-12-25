import { useAuth } from './AuthContext';
import { ReactNode, useEffect } from 'react';

const AUTH_URL = import.meta.env.VITE_AUTH_URL || '';

interface RequireAuthProps {
  children: ReactNode;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = `${AUTH_URL}/auth/login`;
    }
  }, [loading, isAuthenticated]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireAuth;
