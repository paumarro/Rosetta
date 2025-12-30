import type { StateCreator } from 'zustand';
import type { CollaborativeState, DiagramSlice } from '@/types/collaboration';
import { calculateNodeSide, calculateAutoPosition } from '@/utils/nodePosition';
import { createYjsNode } from '../helpers';
import { nanoid } from 'nanoid';
import * as Y from 'yjs';

export const createDiagramSlice: StateCreator<
  CollaborativeState,
  [],
  [],
  DiagramSlice
> = (set, get) => ({
  // Initial state
  nodes: [],
  edges: [],
  title: '',

  // Actions
  setNodes: (nodes) => {
    set((state) => ({
      nodes: typeof nodes === 'function' ? nodes(state.nodes) : nodes,
    }));
  },

  setNodeBeingEdited: (id, isBeingEdited) => {
    const { ydoc, currentUser, isViewMode } = get();
    if (!ydoc || isViewMode) return;

    const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
    const yNode = yNodes.get(id);
    if (yNode) {
      yNode.set('isBeingEdited', isBeingEdited);
      yNode.set(
        'editedBy',
        isBeingEdited ? currentUser?.userName || null : null,
      );
    }
  },

  onNodeChange: (changes) => {
    const { ydoc, nodes, isViewMode } = get();
    if (!ydoc) return;

    const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');

    // Handle selection changes (local state only)
    const hasSelectChange = changes.some((c) => c.type === 'select');
    if (hasSelectChange) {
      const updatedNodes = nodes.map((node) => {
        const selectChange = changes.find(
          (c) => c.type === 'select' && c.id === node.id,
        );
        if (selectChange && selectChange.type === 'select') {
          return { ...node, selected: selectChange.selected };
        }
        return node;
      });
      set({ nodes: updatedNodes });
    }

    // Block write operations in view mode
    if (isViewMode) return;

    changes.forEach((change) => {
      if (change.type === 'position' && change.position) {
        const yNode = yNodes.get(change.id);
        if (yNode) {
          const newSide = calculateNodeSide(change.position.x);
          const currentData = yNode.get('data') as Record<string, unknown>;

          yNode.set('position', {
            x: change.position.x,
            y: change.position.y,
          });

          if (currentData.side !== newSide) {
            yNode.set('data', { ...currentData, side: newSide });
          }
        }
      }
      if (change.type === 'remove') {
        yNodes.delete(change.id);
        const yEdges = ydoc.getMap<Y.Map<unknown>>('edges');
        Array.from(yEdges.entries()).forEach(([edgeId, yEdge]) => {
          const source = yEdge.get('source') as string | undefined;
          const target = yEdge.get('target') as string | undefined;
          if (source === change.id || target === change.id) {
            yEdges.delete(edgeId);
          }
        });
      }
    });
  },

  onEdgeChange: (changes) => {
    const { ydoc, edges, isViewMode } = get();
    if (!ydoc) return;

    const yEdges = ydoc.getMap<Y.Map<unknown>>('edges');

    // Handle selection changes (local state only)
    const hasSelectChange = changes.some((c) => c.type === 'select');
    if (hasSelectChange) {
      const updatedEdges = edges.map((edge) => {
        const selectChange = changes.find(
          (c) => c.type === 'select' && c.id === edge.id,
        );
        if (selectChange && selectChange.type === 'select') {
          return { ...edge, selected: selectChange.selected };
        }
        return edge;
      });
      set({ edges: updatedEdges });
    }

    // Block write operations in view mode
    if (isViewMode) return;

    changes.forEach((change) => {
      if (change.type === 'remove') {
        yEdges.delete(change.id);
      }
    });
  },

  onConnect: (params) => {
    const { source, target, sourceHandle, targetHandle } = params;
    if (!source || !target) return;

    const { ydoc, isViewMode } = get();
    if (!ydoc || isViewMode) return;

    const yEdges = ydoc.getMap<Y.Map<unknown>>('edges');
    const edgeId = `e${source}${sourceHandle ?? ''}-${target}${targetHandle ?? ''}`;
    const yEdge = new Y.Map<unknown>();
    yEdge.set('source', source);
    yEdge.set('target', target);
    yEdge.set('sourceHandle', sourceHandle ?? null);
    yEdge.set('targetHandle', targetHandle ?? null);
    yEdges.set(edgeId, yEdge);
  },

  addNode: (type, position) => {
    const { nodes, ydoc, currentUser, isViewMode } = get();

    if (!ydoc || isViewMode) {
      console.error(
        'Cannot add node: Yjs document not initialized or in view mode',
      );
      return;
    }

    const normalizedType = type.toLowerCase();
    const nodePosition =
      position || calculateAutoPosition(normalizedType, nodes);
    const nodeId = `${normalizedType}-${nanoid(8)}`;

    createYjsNode(ydoc, nodeId, normalizedType, nodePosition, currentUser);
  },

  deleteNode: (nodeId) => {
    const { ydoc, isViewMode } = get();
    if (!ydoc || isViewMode) return;

    const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
    const yEdges = ydoc.getMap<Y.Map<unknown>>('edges');

    yNodes.delete(nodeId);

    Array.from(yEdges.entries()).forEach(([edgeId, yEdge]) => {
      const source = yEdge.get('source') as string | undefined;
      const target = yEdge.get('target') as string | undefined;
      if (source === nodeId || target === nodeId) {
        yEdges.delete(edgeId);
      }
    });
  },

  deleteAllNodes: () => {
    const { ydoc, isViewMode } = get();
    if (!ydoc || isViewMode) return;

    const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
    yNodes.clear();
  },

  updateNodeData: (nodeId, data) => {
    const { ydoc, isViewMode } = get();
    if (!ydoc || isViewMode) return;

    const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
    const yNode = yNodes.get(nodeId);
    if (yNode) {
      yNode.set('data', data);
    }
  },
});
