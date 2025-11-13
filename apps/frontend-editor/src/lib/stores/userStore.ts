import { create } from 'zustand';

export interface User {
  ID: number;
  CreatedAt: string;
  UpdatedAt: string;
  DeletedAt: string | null;
  Name: string;
  Email: string;
  EntraID: string;
  PhotoURL: string;
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
      const response = await fetch('/api/user/me', {
        credentials: 'include',
      });

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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, isLoading: false });
      console.error('Error fetching user:', error);
    }
  },

  updateUserProfile: async (data: UpdateUserData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/user/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update user profile');
      }

      const updatedUser = (await response.json()) as User;
      set({ user: updatedUser, isLoading: false, error: null });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, isLoading: false });
      console.error('Error updating user profile:', error);
      throw error; // Re-throw so UI can handle it
    }
  },

  clearUser: () => {
    set({ user: null, error: null, isLoading: false });
  },
}));
