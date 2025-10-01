import { create } from 'zustand';

import { Diagram, DiagramStore } from '@/types';

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
      const response = await fetch('http://localhost:3001/api/diagrams');
      if (!response.ok) {
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
      const response = await fetch(
        `http://localhost:3001/api/diagrams/${name}`,
        {
          method: 'DELETE',
        },
      );

      if (response.ok || response.status === 204) {
        // Remove from local state
        set((state) => ({
          diagrams: state.diagrams.filter((d) => d.name !== name),
          error: null,
        }));
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
