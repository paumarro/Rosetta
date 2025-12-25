import {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
} from 'react';
import type { UseBoundStore, StoreApi } from 'zustand';

interface UserStoreState {
  fetchCurrentUser: () => Promise<any>;
  clearUser: () => void;
}

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  userStore: UseBoundStore<StoreApi<UserStoreState>>;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, userStore }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      let authenticated = false;

      try {
        const { fetchCurrentUser } = userStore.getState();

        // Check auth by fetching user data - nginx routes /api/* to backend
        // 401 means not authenticated, 200 means authenticated
        // This replaces the old /auth/validate call (which was redundant)
        const user = await fetchCurrentUser();
        authenticated = !!user;
      } catch (err) {
        console.error('[AuthProvider] Error checking authentication:', err);
        authenticated = false;
        userStore.getState().clearUser();
      }

      // Set both states together to ensure they update in the same render
      setIsAuthenticated(authenticated);
      setLoading(false);
    };

    void checkAuth();
  }, [userStore]);

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
