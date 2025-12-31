import { describe, it, expect, beforeEach, vi } from 'vitest';
import { create } from 'zustand';
import * as Y from 'yjs';
import type { NodeChange, EdgeChange } from '@xyflow/react';
import type { CollaborativeState, DiagramSlice } from '@/types/collaboration';
import { createDiagramSlice } from '@/store/collaborationStore/slices/diagramSlice';

/**
 * Creates a test store with DiagramSlice and necessary state.
 * Uses real Yjs document for accurate behavior testing.
 */
function createTestStore(options: {
  isViewMode?: boolean;
  initialNodes?: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
  initialEdges?: Array<{
    id: string;
    source: string;
    target: string;
  }>;
  currentUser?: { userId: string; userName: string } | null;
}) {
  const ydoc = new Y.Doc();
  const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
  const yEdges = ydoc.getMap<Y.Map<unknown>>('edges');

  // Seed initial nodes into Yjs
  options.initialNodes?.forEach((node) => {
    const yNode = new Y.Map<unknown>();
    yNode.set('type', node.type);
    yNode.set('position', node.position);
    yNode.set('data', node.data);
    yNode.set('isBeingEdited', false);
    yNode.set('editedBy', null);
    yNodes.set(node.id, yNode);
  });

  // Seed initial edges into Yjs
  options.initialEdges?.forEach((edge) => {
    const yEdge = new Y.Map<unknown>();
    yEdge.set('source', edge.source);
    yEdge.set('target', edge.target);
    yEdges.set(edge.id, yEdge);
  });

  type TestState = DiagramSlice & {
    ydoc: Y.Doc | null;
    isViewMode: boolean;
    currentUser: { userId: string; userName: string } | null;
  };

  const store = create<TestState>()((set, get, api) => ({
    ...createDiagramSlice(
      set as Parameters<typeof createDiagramSlice>[0],
      get as unknown as () => CollaborativeState,
      api as Parameters<typeof createDiagramSlice>[2],
    ),
    ydoc,
    isViewMode: options.isViewMode ?? false,
    currentUser: options.currentUser ?? null,
    nodes: options.initialNodes ?? [],
    edges: options.initialEdges ?? [],
  }));

  return { store, ydoc, yNodes, yEdges };
}

describe('Diagram Slice', () => {
  describe('View Mode Enforcement', () => {
    it('blocks node position updates in view mode', () => {
      const { store, yNodes } = createTestStore({
        isViewMode: true,
        initialNodes: [
          { id: 'n1', type: 'topic', position: { x: 0, y: 0 }, data: {} },
        ],
      });

      const positionChange: NodeChange = {
        type: 'position',
        id: 'n1',
        position: { x: 100, y: 100 },
      };

      store.getState().onNodeChange([positionChange]);

      // Yjs should not be updated
      const yNode = yNodes.get('n1');
      expect(yNode?.get('position')).toEqual({ x: 0, y: 0 });
    });

    it('blocks node deletion in view mode', () => {
      const { store, yNodes } = createTestStore({
        isViewMode: true,
        initialNodes: [
          { id: 'n1', type: 'topic', position: { x: 0, y: 0 }, data: {} },
        ],
      });

      store.getState().deleteNode('n1');

      // Node should still exist
      expect(yNodes.has('n1')).toBe(true);
    });

    it('blocks edge deletion in view mode', () => {
      const { store, yEdges } = createTestStore({
        isViewMode: true,
        initialNodes: [
          { id: 'n1', type: 'topic', position: { x: 0, y: 0 }, data: {} },
          { id: 'n2', type: 'topic', position: { x: 200, y: 0 }, data: {} },
        ],
        initialEdges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      });

      const removeChange: EdgeChange = {
        type: 'remove',
        id: 'e1',
      };

      store.getState().onEdgeChange([removeChange]);

      expect(yEdges.has('e1')).toBe(true);
    });

    it('blocks connection creation in view mode', () => {
      const { store, yEdges } = createTestStore({
        isViewMode: true,
        initialNodes: [
          { id: 'n1', type: 'topic', position: { x: 0, y: 0 }, data: {} },
          { id: 'n2', type: 'topic', position: { x: 200, y: 0 }, data: {} },
        ],
      });

      store.getState().onConnect({
        source: 'n1',
        target: 'n2',
        sourceHandle: 'r',
        targetHandle: 'l',
      });

      expect(yEdges.size).toBe(0);
    });

    it('blocks node data updates in view mode', () => {
      const { store, yNodes } = createTestStore({
        isViewMode: true,
        initialNodes: [
          {
            id: 'n1',
            type: 'topic',
            position: { x: 0, y: 0 },
            data: { label: 'Original' },
          },
        ],
      });

      store.getState().updateNodeData('n1', { label: 'Modified' });

      const yNode = yNodes.get('n1');
      expect(yNode?.get('data')).toEqual({ label: 'Original' });
    });

    it('allows node selection changes in view mode', () => {
      const { store } = createTestStore({
        isViewMode: true,
        initialNodes: [
          { id: 'n1', type: 'topic', position: { x: 0, y: 0 }, data: {} },
        ],
      });

      const selectChange: NodeChange = {
        type: 'select',
        id: 'n1',
        selected: true,
      };

      store.getState().onNodeChange([selectChange]);

      // Selection is local state, should be updated
      const node = store.getState().nodes.find((n) => n.id === 'n1');
      expect(node?.selected).toBe(true);
    });
  });

  describe('Node Operations', () => {
    it('updates node position in Yjs', () => {
      const { store, yNodes } = createTestStore({
        initialNodes: [
          { id: 'n1', type: 'topic', position: { x: 0, y: 0 }, data: {} },
        ],
      });

      const positionChange: NodeChange = {
        type: 'position',
        id: 'n1',
        position: { x: 150, y: 75 },
      };

      store.getState().onNodeChange([positionChange]);

      const yNode = yNodes.get('n1');
      expect(yNode?.get('position')).toEqual({ x: 150, y: 75 });
    });

    it('updates node side based on x position', () => {
      const { store, yNodes } = createTestStore({
        initialNodes: [
          {
            id: 'n1',
            type: 'topic',
            position: { x: -100, y: 0 },
            data: { label: 'Test', side: 2 }, // side 2 = left (x < 0)
          },
        ],
      });

      // Move to right side (x >= 0 means side 1)
      const positionChange: NodeChange = {
        type: 'position',
        id: 'n1',
        position: { x: 200, y: 0 },
      };

      store.getState().onNodeChange([positionChange]);

      const yNode = yNodes.get('n1');
      const data = yNode?.get('data') as Record<string, unknown>;
      expect(data.side).toBe(1); // side 1 = right (x >= 0)
    });

    it('deletes node and cascades to connected edges', () => {
      const { store, yNodes, yEdges } = createTestStore({
        initialNodes: [
          { id: 'n1', type: 'topic', position: { x: 0, y: 0 }, data: {} },
          { id: 'n2', type: 'topic', position: { x: 200, y: 0 }, data: {} },
          { id: 'n3', type: 'topic', position: { x: 400, y: 0 }, data: {} },
        ],
        initialEdges: [
          { id: 'e1-2', source: 'n1', target: 'n2' },
          { id: 'e2-3', source: 'n2', target: 'n3' },
          { id: 'e1-3', source: 'n1', target: 'n3' },
        ],
      });

      // Delete n2 - should cascade delete e1-2 and e2-3
      store.getState().deleteNode('n2');

      expect(yNodes.has('n2')).toBe(false);
      expect(yEdges.has('e1-2')).toBe(false);
      expect(yEdges.has('e2-3')).toBe(false);
      // e1-3 should remain (no relation to n2)
      expect(yEdges.has('e1-3')).toBe(true);
    });

    it('deletes all nodes', () => {
      const { store, yNodes } = createTestStore({
        initialNodes: [
          { id: 'n1', type: 'topic', position: { x: 0, y: 0 }, data: {} },
          { id: 'n2', type: 'topic', position: { x: 200, y: 0 }, data: {} },
        ],
      });

      store.getState().deleteAllNodes();

      expect(yNodes.size).toBe(0);
    });
  });

  describe('Edge Operations', () => {
    it('creates edge with proper ID format', () => {
      const { store, yEdges } = createTestStore({
        initialNodes: [
          { id: 'n1', type: 'topic', position: { x: 0, y: 0 }, data: {} },
          { id: 'n2', type: 'topic', position: { x: 200, y: 0 }, data: {} },
        ],
      });

      store.getState().onConnect({
        source: 'n1',
        target: 'n2',
        sourceHandle: 'r',
        targetHandle: 'l',
      });

      expect(yEdges.has('en1r-n2l')).toBe(true);
    });

    it('stores connection details in Yjs edge', () => {
      const { store, yEdges } = createTestStore({
        initialNodes: [
          { id: 'n1', type: 'topic', position: { x: 0, y: 0 }, data: {} },
          { id: 'n2', type: 'topic', position: { x: 200, y: 0 }, data: {} },
        ],
      });

      store.getState().onConnect({
        source: 'n1',
        target: 'n2',
        sourceHandle: 'r',
        targetHandle: 'l',
      });

      const yEdge = yEdges.get('en1r-n2l');
      expect(yEdge?.get('source')).toBe('n1');
      expect(yEdge?.get('target')).toBe('n2');
      expect(yEdge?.get('sourceHandle')).toBe('r');
      expect(yEdge?.get('targetHandle')).toBe('l');
    });

    it('ignores connection without source or target', () => {
      const { store, yEdges } = createTestStore({});

      store.getState().onConnect({
        source: null,
        target: 'n2',
        sourceHandle: null,
        targetHandle: null,
      });

      expect(yEdges.size).toBe(0);
    });

    it('deletes edge from Yjs', () => {
      const { store, yEdges } = createTestStore({
        initialNodes: [
          { id: 'n1', type: 'topic', position: { x: 0, y: 0 }, data: {} },
          { id: 'n2', type: 'topic', position: { x: 200, y: 0 }, data: {} },
        ],
        initialEdges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      });

      const removeChange: EdgeChange = {
        type: 'remove',
        id: 'e1',
      };

      store.getState().onEdgeChange([removeChange]);

      expect(yEdges.has('e1')).toBe(false);
    });
  });

  describe('Edit Lock Management', () => {
    it('sets node as being edited with user name', () => {
      const { store, yNodes } = createTestStore({
        currentUser: { userId: 'u1', userName: 'Alice' },
        initialNodes: [
          { id: 'n1', type: 'topic', position: { x: 0, y: 0 }, data: {} },
        ],
      });

      store.getState().setNodeBeingEdited('n1', true);

      const yNode = yNodes.get('n1');
      expect(yNode?.get('isBeingEdited')).toBe(true);
      expect(yNode?.get('editedBy')).toBe('Alice');
    });

    it('clears edit lock when releasing', () => {
      const { store, yNodes } = createTestStore({
        currentUser: { userId: 'u1', userName: 'Alice' },
        initialNodes: [
          { id: 'n1', type: 'topic', position: { x: 0, y: 0 }, data: {} },
        ],
      });

      // First lock, then release
      store.getState().setNodeBeingEdited('n1', true);
      store.getState().setNodeBeingEdited('n1', false);

      const yNode = yNodes.get('n1');
      expect(yNode?.get('isBeingEdited')).toBe(false);
      expect(yNode?.get('editedBy')).toBeNull();
    });

    it('does not set edit lock in view mode', () => {
      const { store, yNodes } = createTestStore({
        isViewMode: true,
        currentUser: { userId: 'u1', userName: 'Alice' },
        initialNodes: [
          { id: 'n1', type: 'topic', position: { x: 0, y: 0 }, data: {} },
        ],
      });

      store.getState().setNodeBeingEdited('n1', true);

      const yNode = yNodes.get('n1');
      expect(yNode?.get('isBeingEdited')).toBe(false);
    });

    it('handles missing node gracefully', () => {
      const { store } = createTestStore({
        currentUser: { userId: 'u1', userName: 'Alice' },
      });

      // Should not throw
      expect(() =>
        store.getState().setNodeBeingEdited('nonexistent', true),
      ).not.toThrow();
    });
  });

  describe('Node Data Updates', () => {
    it('updates node data in Yjs', () => {
      const { store, yNodes } = createTestStore({
        initialNodes: [
          {
            id: 'n1',
            type: 'topic',
            position: { x: 0, y: 0 },
            data: { label: 'Original', description: '' },
          },
        ],
      });

      store.getState().updateNodeData('n1', {
        label: 'Updated',
        description: 'New description',
        resources: ['link1'],
      });

      const yNode = yNodes.get('n1');
      const data = yNode?.get('data') as Record<string, unknown>;
      expect(data.label).toBe('Updated');
      expect(data.description).toBe('New description');
      expect(data.resources).toEqual(['link1']);
    });
  });
});
