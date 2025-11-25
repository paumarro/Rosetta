import { create } from 'zustand';

import { Diagram, DiagramStore } from '@/types';

// With nginx reverse proxy, we use relative paths for same-origin requests:
// - /editor/* routes to be-editor API
// - /auth/*   routes to auth-service (for redirects)
// This eliminates cross-origin cookie issues completely.

export const useDiagramStore = create<DiagramStore>((set) => ({
  diagrams: [],
  isLoading: false,
  error: null,

  //Actions
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
  setError: (error: string | null) => {
    set({ error });
  },
  fetchDiagrams: async () => {
    set({ isLoading: true, error: null });
    try {
      // /editor/diagrams → nginx → be-editor /api/diagrams
      const response = await fetch('/editor/diagrams', {
        credentials: 'include',
      });
      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          console.error('User not authenticated, redirecting to login');
          window.location.href = '/login';
          return;
        }

        const errorMessage =
          response.status === 404
            ? 'Diagrams not found'
            : 'Failed to fetch diagrams';
        set({ error: errorMessage, isLoading: false });
      } else {
        const data = (await response.json()) as Diagram[];
        set({ diagrams: data, isLoading: false, error: null });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, isLoading: false });
      console.error('Error fetching diagrams:', error);
    }
  },
  deleteDiagram: async (name: string) => {
    try {
      // /editor/diagrams/:name → nginx → be-editor /api/diagrams/:name
      const response = await fetch(`/editor/diagrams/${name}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok || response.status === 204) {
        // Remove from local state
        set((state) => ({
          diagrams: state.diagrams.filter((d) => d.name !== name),
          error: null,
        }));
      } else if (response.status === 401) {
        // Handle authentication errors
        console.error('User not authenticated, redirecting to login');
        window.location.href = '/login';
        return;
      } else if (response.status === 409) {
        // Diagram has an associated learning path
        const errorData = (await response.json()) as {
          error: string;
          message: string;
        };
        const errorMessage =
          errorData.message ||
          'Cannot delete diagram with associated learning path';
        set({ error: errorMessage });
        throw new Error(errorMessage);
      } else {
        throw new Error('Failed to delete diagram');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('learning path')) {
        set({ error: errorMessage });
      }
      console.error('Error deleting diagram:', error);
      throw error; // Re-throw so UI can handle it
    }
  },
}));
