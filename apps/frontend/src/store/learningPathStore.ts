import { create } from 'zustand';
import type { LearningPath } from '@shared/types';
import type { LearningPathStore } from '@/types/learningPath';
import { apiFetch, getErrorMessage } from '@/services/api';

// Re-export types for convenience
export type { LearningPath };

const RECENTLY_VIEWED_KEY = 'rosetta_recently_viewed';

export const useLearningPathStore = create<LearningPathStore>((set, get) => ({
  learningPaths: [],
  favorites: [],
  recentlyViewed: [],
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

  fetchLearningPathsByCommunity: async (communityName: string) => {
    try {
      const response = await apiFetch(
        `/api/communities/${encodeURIComponent(communityName)}/learning-paths`,
      );
      if (!response.ok) {
        const errorMessage =
          response.status === 404
            ? 'Learning paths not found for this community'
            : 'Failed to fetch community learning paths';
        throw new Error(errorMessage);
      }
      const data = (await response.json()) as LearningPath[];
      return data;
    } catch (error) {
      console.error('Error fetching community learning paths:', error);
      throw error;
    }
  },

  fetchRecentlyViewed: () => {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!stored) {
      set({ recentlyViewed: [] });
      return;
    }

    const recentIds: string[] = JSON.parse(stored) as string[];
    const { learningPaths } = get();

    const recentPaths = recentIds
      .map((id) => learningPaths.find((lp) => lp.ID === id))
      .filter(Boolean) as LearningPath[];

    set({ recentlyViewed: recentPaths });
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

  updateLearningPath: async (id: string, title: string, description: string) => {
    try {
      const response = await apiFetch(`/api/learning-paths/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Learning path not found');
        }
        throw new Error('Failed to update learning path');
      }

      const updatedPath = (await response.json()) as LearningPath;

      set((state) => ({
        learningPaths: state.learningPaths.map((lp) =>
          lp.ID === id ? updatedPath : lp,
        ),
        error: null,
      }));

      return updatedPath;
    } catch (error) {
      set({ error: getErrorMessage(error) });
      console.error('Error updating learning path:', error);
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
