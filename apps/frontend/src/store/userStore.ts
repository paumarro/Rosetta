import { create } from 'zustand';
import { apiFetch, getErrorMessage } from '@/services/api';

export interface User {
  ID: number;
  CreatedAt: string;
  UpdatedAt: string;
  DeletedAt: string | null;
  Name: string;
  Email: string;
  EntraID: string;
  PhotoURL: string;
  Community: string;
  IsAdmin?: boolean;
}

export interface UpdateUserData {
  name?: string;
  photoURL?: string;
}

export interface UserStore {
  user: User | null;
  isLoading: boolean;
  error: string | null;

  setError: (error: string | null) => void;
  fetchCurrentUser: () => Promise<User | null>;
  updateUserProfile: (data: UpdateUserData) => Promise<void>;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  setError: (error: string | null) => {
    set({ error });
  },

  fetchCurrentUser: async (): Promise<User | null> => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch('/api/user/me');

      if (!response.ok) {
        // 401 means not authenticated - not an error, just not logged in
        if (response.status === 401) {
          set({ user: null, isLoading: false, error: null });
          return null;
        }
        const errorMessage =
          response.status === 404
            ? 'User not found'
            : 'Failed to fetch user data';
        set({ error: errorMessage, isLoading: false });
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
      const response = await apiFetch('/api/user/me', {
        method: 'PATCH',
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
}));
