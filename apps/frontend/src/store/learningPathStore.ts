import { create } from 'zustand';
import type { LearningPath, LearningPathStore } from '@/types/learningPath';
import { apiFetch, getErrorMessage } from '@/lib/api';

// Re-export types for convenience
export type { LearningPath };

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
      const response = await apiFetch('/api/learning-paths');
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
      set({ error: getErrorMessage(error), isLoading: false });
      console.error('Error fetching learning paths:', error);
    }
  },

  deleteLearningPath: async (id: string) => {
    try {
      const response = await apiFetch(`/api/learning-paths/${id}`, {
        method: 'DELETE',
      });

      if (response.ok || response.status === 204) {
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
      set({ error: getErrorMessage(error) });
      console.error('Error deleting learning path:', error);
      throw error;
    }
  },

  fetchUserFavorites: async () => {
    try {
      const response = await apiFetch('/api/learning-paths/favorites');

      if (!response.ok) {
        throw new Error('Failed to fetch favorites');
      }

      const data = (await response.json()) as LearningPath[];
      set({ favorites: data, error: null });
    } catch (error) {
      set({ error: getErrorMessage(error) });
      console.error('Error fetching favorites:', error);
    }
  },

  addToFavorites: async (id: string) => {
    try {
      const response = await apiFetch(`/api/learning-paths/${id}/favorite`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to add to favorites');
      }

      const state = get();
      await (state.fetchUserFavorites as () => Promise<void>)();
    } catch (error) {
      set({ error: getErrorMessage(error) });
      console.error('Error adding to favorites:', error);
      throw error;
    }
  },

  removeFromFavorites: async (id: string) => {
    try {
      const response = await apiFetch(`/api/learning-paths/${id}/favorite`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove from favorites');
      }

      set((state) => ({
        favorites: state.favorites.filter((fav) => fav.ID !== id),
        error: null,
      }));
    } catch (error) {
      set({ error: getErrorMessage(error) });
      console.error('Error removing from favorites:', error);
      throw error;
    }
  },
}));
