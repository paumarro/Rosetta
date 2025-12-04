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
  fetchCurrentUser: () => Promise<void>;
  updateUserProfile: (data: UpdateUserData) => Promise<void>;
  setCommunity: (community: string) => Promise<void>;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  setError: (error: string | null) => {
    set({ error });
  },

  fetchCurrentUser: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch('/api/user/me');

      if (!response.ok) {
        const errorMessage =
          response.status === 404
            ? 'User not found'
            : 'Failed to fetch user data';
        set({ error: errorMessage, isLoading: false });
      } else {
        const data = (await response.json()) as User;
        set({ user: data, isLoading: false, error: null });
      }
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false });
      console.error('Error fetching user:', error);
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

  setCommunity: async (community: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch('/api/user/me/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ community }),
      });

      if (!response.ok) {
        throw new Error('Failed to set community');
      }

      const updatedUser = (await response.json()) as User;
      set({ user: updatedUser, isLoading: false, error: null });
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false });
      console.error('Error setting community:', error);
      throw error;
    }
  },

  clearUser: () => {
    set({ user: null, error: null, isLoading: false });
  },
}));
