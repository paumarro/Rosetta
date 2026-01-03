import { create, type StateCreator } from 'zustand';
import type { User, UpdateUserData } from '../types/user';
import { getErrorMessage } from '../utils/error';

export interface UserStore {
  user: User | null;
  isLoading: boolean;
  error: string | null;

  setError: (error: string | null) => void;
  fetchCurrentUser: () => Promise<User | null>;
  updateUserProfile: (data: UpdateUserData) => Promise<void>;
  clearUser: () => void;
}

interface CreateUserStoreOptions {
  apiBaseUrl?: string;
}

/** Creates a Zustand store for user authentication state */
export function createUserStore(options: CreateUserStoreOptions = {}) {
  const {
    apiBaseUrl = '',
  } = options;

  const storeCreator: StateCreator<UserStore> = (set) => ({
    user: null,
    isLoading: false,
    error: null,

    setError: (error: string | null) => {
      set({ error });
    },

    fetchCurrentUser: async (): Promise<User | null> => {
      set({ isLoading: true, error: null });
      try {
        const response = await fetch(`${apiBaseUrl}/api/user/me`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorMessage =
            response.status === 404
              ? 'User not found'
              : response.status === 401
                ? 'Not authenticated'
                : 'Failed to fetch user data';

          set({ user: null, isLoading: false, error: errorMessage });
          return null;
        }

        const data = (await response.json()) as User;
        set({ user: data, isLoading: false, error: null });
        return data;
      } catch (error) {
        set({ error: getErrorMessage(error), isLoading: false });
        console.error('Error fetching user:', error);
        return null;
      }
    },

    updateUserProfile: async (data: UpdateUserData) => {
      set({ isLoading: true, error: null });
      try {
        const response = await fetch(`${apiBaseUrl}/api/user/me`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error('Failed to update user profile');
        }

        const updatedUser = (await response.json()) as User;
        set({ user: updatedUser, isLoading: false, error: null });
      } catch (error) {
        set({ error: getErrorMessage(error), isLoading: false });
        console.error('Error updating user profile:', error);
        throw error;
      }
    },

    clearUser: () => {
      set({ user: null, error: null, isLoading: false });
    },
  });

  return create<UserStore>(storeCreator);
}
