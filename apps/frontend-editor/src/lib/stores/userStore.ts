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
  isLoading: true,
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
        // User is not authenticated - redirect to login
        console.error('User not authenticated, redirecting to login');
        set({ error: 'Not authenticated', isLoading: false, user: null });

        // Redirect to the main auth service login
        window.location.href = 'http://localhost:8080/auth/login';
        return;
      }

      const data = (await response.json()) as User;
      set({ user: data, isLoading: false, error: null });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching user:', error);
      set({ error: errorMessage, isLoading: false, user: null });

      // Network error or CORS issue - likely not authenticated
      window.location.href = 'http://localhost:8080/auth/login';
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
