import { create } from 'zustand';

import { Diagram, DiagramStore, CreateDiagramRequest } from '@/types';

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
  addDiagram: async (name: string) => {
    if (!name.trim()) {
      set({ error: 'Diagram name cannot be empty' });
      return;
    }
    try {
      const requestBody: CreateDiagramRequest = {
        name: name.trim(),
        nodes: [],
        edges: [],
      };
      const response = await fetch('http://localhost:3001/api/diagrams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const newDiagram = (await response.json()) as Diagram;
        set((state) => ({
          diagrams: [...state.diagrams, newDiagram],
          error: null,
        }));
      } else {
        throw new Error('Failed to create diagram');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage });
      console.error('Error creating diagram:', error);
    }
  },
}));
