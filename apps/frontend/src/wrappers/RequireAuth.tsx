import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ReactNode } from 'react';

interface RequireAuthProps {
  children: ReactNode;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <p>Loading...</p>;

  console.log('isAuthenticated:', isAuthenticated);

  return isAuthenticated ? children : <Navigate to="/login" />;
};

export default RequireAuth;
