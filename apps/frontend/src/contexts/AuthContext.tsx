import {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
} from 'react';
import { useUserStore } from '@/store/userStore';

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const { fetchCurrentUser, clearUser } = useUserStore();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Relative path - nginx routes /auth/* to auth-service
        // This is same-origin, so cookies flow automatically
        const response = await fetch('/auth/validate', {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch authentication status');
        }

        const data = (await response.json()) as { valid: boolean };
        setIsAuthenticated(data.valid);

        // Fetch user data if authenticated
        if (data.valid) {
          await fetchCurrentUser();
        } else {
          clearUser();
        }
      } catch (err) {
        console.error('Error checking authentication:', err);
        setIsAuthenticated(false);
        clearUser();
      } finally {
        setLoading(false);
      }
    };

    void checkAuth();
  }, [fetchCurrentUser, clearUser]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
