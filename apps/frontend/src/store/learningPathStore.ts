import { create } from 'zustand';

const BE_API_URL = import.meta.env.VITE_BE_API_URL as string;

interface LearningPath {
  ID: string;
  Title: string;
  Description: string;
  IsPublic: boolean;
  Thumbnail: string;
  DiagramID: string;
  CreatedAt: string;
  UpdatedAt: string;
  Skills?: Array<{ ID: string; Name: string }>;
}

interface LearningPathStore {
  learningPaths: LearningPath[];
  isLoading: boolean;
  error: string | null;

  fetchLearningPaths: () => Promise<void>;
  deleteLearningPath: (id: string) => Promise<void>;
  setError: (error: string | null) => void;
}

export const useLearningPathStore = create<LearningPathStore>((set) => ({
  learningPaths: [],
  isLoading: false,
  error: null,

  setError: (error: string | null) => {
    set({ error });
  },

  fetchLearningPaths: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BE_API_URL}/api/learning-paths`);
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
}));
