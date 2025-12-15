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
        // Check auth by fetching user data - nginx routes /api/* to backend
        // 401 means not authenticated, 200 means authenticated
        // This replaces the old /auth/validate call (which was redundant)
        const user = await fetchCurrentUser();
        setIsAuthenticated(!!user);
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
