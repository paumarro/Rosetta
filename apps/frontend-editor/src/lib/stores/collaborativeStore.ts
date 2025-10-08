import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DiagramNode, DiagramEdge } from '@/types/reactflow';
import { Connection, NodeChange, EdgeChange } from '@xyflow/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { nanoid } from 'nanoid';

// TODO: Move types to the types folder later

interface User {
  userId: string;
  userName: string;
  cursor?: { x: number; y: number };
  selection?: string[];
  color?: string;
}

interface CollaborativeState {
  // react Flow State
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  title: string;

  //Connection State
  isConnected: boolean;

  //Collaboration State
  connectedUsers: User[];
  currentUser: User | null;
  diagramName: string;
  learningPathId: string;
  ydoc: Y.Doc | null;
  yProvider: WebsocketProvider | null;

  //Loading States
  isInitializing: boolean;

  //Actions - Setup
  initializeCollaboration: (
    learningPathId: string,
    user: User,
  ) => Promise<void>;
  cleanup: () => void;

  //Actions - React Flow Diagram Manipulation
  setNodes: (
    nodes: DiagramNode[] | ((nodes: DiagramNode[]) => DiagramNode[]),
  ) => void;
  onNodeChange: (changes: NodeChange[]) => void;
  onEdgeChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: string, position?: { x: number; y: number }) => void;
  deleteNode: (nodeId: string) => void;
  setNodeBeingEdited: (nodeId: string, isBeingEdited: boolean) => void;
  // Actions - Collaboration
  updateCursor: (position: { x: number; y: number }) => void;
  updateSelection: (nodeIds: string[]) => void;
}

export const useCollaborativeStore = create<CollaborativeState>()(
  subscribeWithSelector((set, get) => ({
    nodes: [],
    edges: [],
    isConnected: false,
    connectedUsers: [],
    currentUser: null,
    diagramName: '',
    learningPathId: 'default',
    ydoc: null,
    yProvider: null,
    isInitializing: false,
    title: '',

    // eslint-disable-next-line @typescript-eslint/require-await
    initializeCollaboration: async (learningPathId: string, user: User) => {
      const state = get();
      if (
        state.isInitializing ||
        (state.yProvider && state.learningPathId === learningPathId)
      ) {
        return;
      }
      if (state.yProvider) {
        get().cleanup();
      }

      set({
        isInitializing: true,
        diagramName: learningPathId,
        learningPathId,
        currentUser: user,
      });
      try {
        const doc = new Y.Doc();
        const provider = new WebsocketProvider(
          'ws://localhost:3001',
          learningPathId,
          doc,
        );

        const yNodes = doc.getMap<Y.Map<unknown>>('nodes');
        const yEdges = doc.getMap<Y.Map<unknown>>('edges');

        const applyFromY = () => {
          // console.log('🔄 applyFromY called');
          const nodes = Array.from(yNodes.entries()).map(([id, yNode]) => {
            const type = (yNode.get('type') as string | undefined) ?? 'topic';
            const position = (yNode.get('position') as
              | { x: number; y: number }
              | undefined) ?? { x: 0, y: 0 };
            const data =
              (yNode.get('data') as Record<string, unknown> | undefined) ?? {};
            const isBeingEdited =
              (yNode.get('isBeingEdited') as boolean | undefined) ?? false;
            const editedBy = (yNode.get('editedBy') as string | null) ?? null;
            return {
              id,
              type,
              position,
              data,
              isBeingEdited,
              editedBy,
            } as DiagramNode;
          });
          const edges = Array.from(yEdges.entries()).map(([id, yEdge]) => {
            const source = (yEdge.get('source') as string | undefined) || '';
            const target = (yEdge.get('target') as string | undefined) || '';
            const sourceHandle =
              (yEdge.get('sourceHandle') as string | null) ?? null;
            const targetHandle =
              (yEdge.get('targetHandle') as string | null) ?? null;
            return {
              id,
              source,
              target,
              sourceHandle,
              targetHandle,
            } as DiagramEdge;
          });
          set({ nodes, edges, title: learningPathId });
        };

        provider.once('sync', async (isSynced: boolean) => {
          if (!isSynced) return;
          applyFromY();

          if (yNodes.size === 0) {
            try {
              const response = await fetch(
                `http://localhost:3001/api/diagrams/${learningPathId}`,
              );
              if (response.ok) {
                const diagram = (await response.json()) as {
                  nodes: DiagramNode[];
                  edges: DiagramEdge[];
                };

                diagram.nodes.forEach((node) => {
                  const yNode = new Y.Map<unknown>();
                  yNode.set('type', node.type);
                  yNode.set('position', node.position);
                  yNode.set('data', node.data);
                  yNode.set('isBeingEdited', node.isBeingEdited || false);
                  yNode.set('editedBy', node.editedBy || null);
                  yNodes.set(node.id, yNode);
                });
                diagram.edges.forEach((edge) => {
                  const yEdge = new Y.Map<unknown>();
                  yEdge.set('source', edge.source);
                  yEdge.set('target', edge.target);
                  yEdge.set('sourceHandle', edge.sourceHandle ?? null);
                  yEdge.set('targetHandle', edge.targetHandle ?? null);
                  yEdges.set(edge.id, yEdge);
                });
              }
            } catch (error) {
              console.error('Failed to fetch initial diagram:', error);
            }
          }
        });

        yNodes.observeDeep(() => {
          applyFromY();
        });
        yEdges.observeDeep(() => {
          applyFromY();
        });

        provider.on('status', (event: { status: string }) => {
          set({ isConnected: event.status === 'connected' });
        });

        set({ ydoc: doc, yProvider: provider });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to load diagram:', errorMessage);
      } finally {
        set({ isInitializing: false });
      }
    },
    cleanup: () => {
      const { yProvider, ydoc } = get();
      if (yProvider) yProvider.destroy();
      if (ydoc) ydoc.destroy();
      set({
        yProvider: null,
        ydoc: null,
        isConnected: false,
        connectedUsers: [],
        currentUser: null,
        diagramName: '',
        learningPathId: 'default',
      });
    },

    setNodes: (
      nodes: DiagramNode[] | ((nodes: DiagramNode[]) => DiagramNode[]),
    ) => {
      set((state) => ({
        nodes: typeof nodes === 'function' ? nodes(state.nodes) : nodes,
      }));
    },

    setNodeBeingEdited: (id: string, isBeingEdited: boolean) => {
      const { ydoc, currentUser } = get();
      if (!ydoc) return;
      const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
      const yNode = yNodes.get(id);
      if (yNode) {
        yNode.set('isBeingEdited', isBeingEdited);
        yNode.set(
          'editedBy',
          isBeingEdited ? currentUser?.userName || null : null,
        );
        if (isBeingEdited) {
          console.log(
            '✅ Node marked as being edited by:',
            currentUser?.userName,
          );
        }
      } else {
        console.log('❌ yNode not found for id:', id);
      }
    },

    onNodeChange: (changes) => {
      const { ydoc } = get();
      if (!ydoc) return;
      const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          const yNode = yNodes.get(change.id);
          if (yNode) {
            yNode.set('position', {
              x: change.position.x,
              y: change.position.y,
            });
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
      const { ydoc, edges } = get();
      if (!ydoc) return;
      const yEdges = ydoc.getMap<Y.Map<unknown>>('edges');

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

      changes.forEach((change) => {
        if (change.type === 'remove') {
          yEdges.delete(change.id);
        }
      });
    },

    onConnect: (params) => {
      const { source, target, sourceHandle, targetHandle } = params;
      if (!source || !target) return;
      const { ydoc } = get();
      if (!ydoc) return;
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
      const { nodes, ydoc } = get();
      if (!ydoc) return;
      const nodeCount = nodes.length;

      const isEven = nodeCount % 2 === 0;
      const levelY = nodeCount * 100 + 200;
      const autoPosition = {
        x: isEven ? (nodes.length === 0 ? 0 : -200) : 200,
        y: levelY,
      };
      const id = `${type}-${nanoid(8)}`;
      const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
      const yNode = new Y.Map<unknown>();
      yNode.set('type', type.toLocaleLowerCase());
      yNode.set('position', position || autoPosition);
      yNode.set('data', {
        label: type.charAt(0).toUpperCase() + type.slice(1),
      });
      yNode.set('isBeingEdited', false);
      yNode.set('editedBy', get().currentUser?.userName || null);
      yNodes.set(id, yNode);
    },

    deleteNode: (nodeId) => {
      const { ydoc } = get();
      if (!ydoc) return;
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

    updateCursor: () => {},
    updateSelection: () => {},
  })),
);
