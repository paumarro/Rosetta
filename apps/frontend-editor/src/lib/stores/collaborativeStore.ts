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

  // Actions - Collaboration
  updateCursor: (position: { x: number; y: number }) => void;
  updateSelection: (nodeIds: string[]) => void;

  // Actions - Broadcasting (placeholder for awareness later)
}

//Collaboration Actions
//   updateCursor: (position: { x: number, y: number }) => {
//     const { socket, isConnected, currentUser } = get()
// if (socket && isConnected && currentUser) {
//   socket.emit('cursor-update', { userId: currentUser.userId, position })
// }
//   }

export const useCollaborativeStore = create<CollaborativeState>()(
  subscribeWithSelector((set, get) => ({
    //Initial State
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

    // Setup Actions

    // eslint-disable-next-line @typescript-eslint/require-await
    initializeCollaboration: async (learningPathId: string, user: User) => {
      const state = get();
      // Prevent multiple initializations
      if (
        state.isInitializing ||
        (state.yProvider && state.learningPathId === learningPathId)
      ) {
        console.log('[Store] Already initialized, skipping...');
        return;
      }
      // Cleanup existing connections
      if (state.yProvider) {
        console.log('[Store] Cleaning up existing connection...');
        get().cleanup(); // Disconnects AND cleanup state
      }

      set({
        isInitializing: true,
        diagramName: learningPathId,
        learningPathId,
        currentUser: user,
      });
      try {
        // Initialize Yjs
        const doc = new Y.Doc();
        const provider = new WebsocketProvider(
          'ws://localhost:3001',
          learningPathId,
          doc,
        );

        // Maps: nodes and edges keyed by id
        const yNodes = doc.getMap<Y.Map<unknown>>('nodes');
        const yEdges = doc.getMap<Y.Map<unknown>>('edges');

        // Observe and derive React state
        const applyFromY = () => {
          const nodes = Array.from(yNodes.entries()).map(([id, yNode]) => {
            const type = (yNode.get('type') as string | undefined) ?? 'custom';
            const position = (yNode.get('position') as
              | { x: number; y: number }
              | undefined) ?? { x: 0, y: 0 };
            const data =
              (yNode.get('data') as Record<string, unknown> | undefined) ?? {};
            return { id, type, position, data } as DiagramNode;
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

        applyFromY();
        const nodesObserver = () => {
          applyFromY();
        };
        const edgesObserver = () => {
          applyFromY();
        };
        yNodes.observeDeep(nodesObserver);
        yEdges.observeDeep(edgesObserver);

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

    // React Flow Actions
    setNodes: (
      nodes: DiagramNode[] | ((nodes: DiagramNode[]) => DiagramNode[]),
    ) => {
      set((state) => ({
        nodes: typeof nodes === 'function' ? nodes(state.nodes) : nodes,
      }));
    },
    setEdges: (
      edges: DiagramEdge[] | ((edges: DiagramEdge[]) => DiagramEdge[]),
    ) => {
      set((state) => ({
        edges: typeof edges === 'function' ? edges(state.edges) : edges,
      }));
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
          // delete node and incident edges
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
      const { ydoc } = get();
      if (!ydoc) return;
      const yEdges = ydoc.getMap<Y.Map<unknown>>('edges');
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

      // Auto-calculate zigzag position if not provided
      const isEven = nodeCount % 2 === 0;
      const levelY = nodeCount * 100 + 200;
      const autoPosition = {
        x: isEven ? (nodes.length === 0 ? 0 : -200) : 200,
        y: levelY,
      };
      const id = `${type}-${nanoid(8)}`;
      const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
      const yNode = new Y.Map<unknown>();
      yNode.set('type', type === 'Start' ? 'start' : 'custom');
      yNode.set('position', position || autoPosition);
      yNode.set('data', {
        label:
          type === 'Start'
            ? 'Start here'
            : type.charAt(0).toUpperCase() + type.slice(1),
        type: type.toLowerCase(),
      });
      yNodes.set(id, yNode);
      console.log('[CollaborativeStore] Added new node:', id);
    },
    // Collaboration Actions
    updateCursor: () => {},
    updateSelection: () => {},

    // Broadcasting Actions (placeholder)
  })),
);
