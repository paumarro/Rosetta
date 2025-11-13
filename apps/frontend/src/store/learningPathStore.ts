import { create } from 'zustand';
import type { LearningPath, LearningPathStore } from '@/types/learningPath';

// Re-export types for convenience
export type { LearningPath };

const BE_API_URL = import.meta.env.VITE_BE_API_URL as string;

export const useLearningPathStore = create<LearningPathStore>((set, get) => ({
  learningPaths: [],
  favorites: [],
  isLoading: false,
  error: null,

  setError: (error: string | null) => {
    set({ error });
  },

  isFavorited: (id: string): boolean => {
    const state = get();
    return state.favorites.some((fav) => fav.ID === id);
  },

  fetchLearningPaths: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BE_API_URL}/api/learning-paths`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const errorMessage =
          response.status === 404
            ? 'Learning paths not found'
            : 'Failed to fetch learning paths';
        set({ error: errorMessage, isLoading: false });
      } else {
        const data = (await response.json()) as LearningPath[];
        set({ learningPaths: data, isLoading: false, error: null });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, isLoading: false });
      console.error('Error fetching learning paths:', error);
    }
  },

  deleteLearningPath: async (id: string) => {
    try {
      const response = await fetch(`${BE_API_URL}/api/learning-paths/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok || response.status === 204) {
        // Remove from local state
        set((state) => ({
          learningPaths: state.learningPaths.filter((lp) => lp.ID !== id),
          error: null,
        }));
      } else if (response.status === 404) {
        throw new Error('Learning path not found');
      } else {
        throw new Error('Failed to delete learning path');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage });
      console.error('Error deleting learning path:', error);
      throw error; // Re-throw so UI can handle it
    }
  },

  fetchUserFavorites: async () => {
    try {
      const response = await fetch(
        `${BE_API_URL}/api/learning-paths/favorites`,
        {
          credentials: 'include',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch favorites');
      }

      const data = (await response.json()) as LearningPath[];
      set({ favorites: data, error: null });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage });
      console.error('Error fetching favorites:', error);
    }
  },

  addToFavorites: async (id: string) => {
    try {
      const response = await fetch(
        `${BE_API_URL}/api/learning-paths/${id}/favorite`,
        {
          method: 'POST',
          credentials: 'include',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to add to favorites');
      }

      // Fetch updated favorites list
      const state = get();
      await (state.fetchUserFavorites as () => Promise<void>)();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage });
      console.error('Error adding to favorites:', error);
      throw error;
    }
  },

  removeFromFavorites: async (id: string) => {
    try {
      const response = await fetch(
        `${BE_API_URL}/api/learning-paths/${id}/favorite`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to remove from favorites');
      }

      // Remove from local favorites state
      set((state) => ({
        favorites: state.favorites.filter((fav) => fav.ID !== id),
        error: null,
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage });
      console.error('Error removing from favorites:', error);
      throw error;
    }
  },
}));
