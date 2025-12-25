import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DiagramNode, DiagramEdge } from '@/types/reactflow';
import { Connection, NodeChange, EdgeChange } from '@xyflow/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { nanoid } from 'nanoid';
import type { Awareness } from 'y-protocols/awareness';

// With nginx reverse proxy, all paths are relative (same-origin):
// - /editor/ws      → be-editor WebSocket
// - /editor/*       → be-editor API
// - /auth/login     → auth-service (OAuth flow)
// - /login          → FE login page

// Collaborative session user (different from auth User)
interface CollaborativeUser {
  userId: string;
  userName: string;
  cursor?: { x: number; y: number };
  selection?: string[];
  color?: string;
  mode?: 'edit' | 'view'; // User's current mode for future role-based features
}

// Constants for node positioning
const NODE_SPACING = {
  TOPIC_Y: 200,
  TOPIC_X: 200,
  SUBTOPIC_Y: 50,
  SUBTOPIC_X: 200,
} as const;

// Curated avatar color palette - professional UI colors that work well on gray backgrounds
const AVATAR_COLORS = [
  '#6366f1', // Indigo - primary, professional
  '#14b8a6', // Teal - fresh, distinct
  '#a855f7', // Purple - creative
  '#f43f5e', // Rose - warm, noticeable
  '#f59e0b', // Amber - energetic
  '#10b981', // Emerald - vibrant green
  '#0ea5e9', // Sky - bright blue
  '#ec4899', // Pink - playful
  '#f97316', // Orange - bold
  '#06b6d4', // Cyan - cool tone
] as const;

// Helper to calculate Node Side from Node Position
const calculateNodeSide = (x: number): 1 | 2 => {
  return x >= 0 ? 1 : 2;
};

// Helper functions for position calculation
const getLastNodeType = (
  nodes: DiagramNode[],
  type: string,
): DiagramNode | undefined => {
  const nodesOfType = nodes.filter((node) => node.type === type);
  return nodesOfType.length > 0
    ? nodesOfType[nodesOfType.length - 1]
    : undefined;
};

const calculateTopicPosition = (
  nodes: DiagramNode[],
): { x: number; y: number } => {
  const topicNodes = nodes.filter((node) => node.type === 'topic');
  const nodeCount = topicNodes.length;
  const lastNode = getLastNodeType(nodes, 'topic');
  const lastPosition = lastNode?.position ?? { x: 0, y: 0 };

  const isEven = nodeCount % 2 === 0;
  const xPosition =
    nodeCount === 0 ? 0 : isEven ? -NODE_SPACING.TOPIC_X : NODE_SPACING.TOPIC_X;

  return {
    x: xPosition,
    y: lastPosition.y + NODE_SPACING.TOPIC_Y,
  };
};

const calculateSubtopicPosition = (
  nodes: DiagramNode[],
): { x: number; y: number } => {
  const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : undefined;
  const lastPosition = lastNode?.position ?? { x: 0, y: 0 };

  const topicNodes = nodes.filter((node) => node.type === 'topic');
  const isEvenTopic = topicNodes.length % 2 === 0;
  const xOffset = isEvenTopic
    ? NODE_SPACING.SUBTOPIC_X
    : -NODE_SPACING.SUBTOPIC_X;

  if (lastNode?.type === 'topic') {
    return {
      x: lastPosition.x + xOffset,
      y: lastPosition.y - NODE_SPACING.SUBTOPIC_Y,
    };
  }

  return {
    x: lastPosition.x,
    y: lastPosition.y + NODE_SPACING.SUBTOPIC_Y,
  };
};

const calculateAutoPosition = (
  type: string,
  nodes: DiagramNode[],
): { x: number; y: number } => {
  switch (type) {
    case 'topic':
      return calculateTopicPosition(nodes);
    case 'subtopic':
      return calculateSubtopicPosition(nodes);
    default:
      return { x: 0, y: 0 };
  }
};

const createYjsNode = (
  ydoc: Y.Doc,
  id: string,
  type: string,
  position: { x: number; y: number },
  currentUser: CollaborativeUser | null,
): void => {
  const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
  const yNode = new Y.Map<unknown>();

  yNode.set('type', type);
  yNode.set('position', position);
  yNode.set('data', {
    label: type.charAt(0).toUpperCase() + type.slice(1),
    side: calculateNodeSide(position.x),
  });
  yNode.set('isBeingEdited', false);
  yNode.set('editedBy', currentUser?.userName || null);

  yNodes.set(id, yNode);
};

interface CollaborativeState {
  // react Flow State
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  title: string;

  //Connection State
  isConnected: boolean;

  //Collaboration State
  connectedUsers: CollaborativeUser[];
  currentUser: CollaborativeUser | null;
  learningPathId: string;
  ydoc: Y.Doc | null;
  yProvider: WebsocketProvider | null;
  awareness: Awareness | null;
  awarenessCleanup: (() => void) | null;
  isViewMode: boolean;
  syncTimeoutId: NodeJS.Timeout | null;

  //Loading States
  isInitializing: boolean;

  //Actions - Setup
  initializeCollaboration: (
    learningPathId: string,
    user: CollaborativeUser,
    isViewMode?: boolean,
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
  deleteAllNodes: () => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
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
    learningPathId: 'default',
    ydoc: null,
    yProvider: null,
    awareness: null,
    awarenessCleanup: null,
    syncTimeoutId: null,
    isInitializing: false,
    title: '',
    isViewMode: false,

    // eslint-disable-next-line @typescript-eslint/require-await
    initializeCollaboration: async (
      learningPathId: string,
      user: CollaborativeUser,
      isViewMode = false,
    ) => {
      const state = get();

      if (state.isInitializing) {
        return;
      }

      // If we're already connected to this diagram, just update mode + user state
      if (state.yProvider && state.learningPathId === learningPathId) {
        if (state.isViewMode !== isViewMode) {
          set({
            isViewMode,
            currentUser: state.currentUser
              ? { ...state.currentUser, mode: isViewMode ? 'view' : 'edit' }
              : null,
          });

          // Keep awareness in sync so other users see the mode change
          if (state.awareness) {
            const currentState = state.awareness.getLocalState() as Record<
              string,
              unknown
            > | null;
            state.awareness.setLocalState({
              ...currentState,
              mode: isViewMode ? 'view' : 'edit',
            });
          }
        }
        return;
      }
      if (state.yProvider) {
        get().cleanup();
      }

      set({
        isInitializing: true,
        learningPathId,
        currentUser: user,
        isViewMode,
      });
      try {
        const doc = new Y.Doc();
        // WebSocket URL uses the current host - nginx routes /editor/ws to be-editor
        const wsProtocol =
          window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/editor/ws`;
        const provider = new WebsocketProvider(wsUrl, learningPathId, doc);

        const yNodes = doc.getMap<Y.Map<unknown>>('nodes');
        const yEdges = doc.getMap<Y.Map<unknown>>('edges');

        // Use Awareness for user presence - it automatically handles disconnections
        const awareness = provider.awareness;

        // Function to update connected users from awareness
        const updateConnectedUsers = () => {
          const states = awareness.getStates();
          const users: CollaborativeUser[] = [];
          states.forEach((state) => {
            // Check if state contains required user properties
            if ('userId' in state && 'userName' in state) {
              users.push({
                userId: state.userId as string,
                userName: state.userName as string,
                color: state.color as string,
                cursor: state.cursor as { x: number; y: number },
                selection: state.selection as string[],
                mode: state.mode as 'edit' | 'view',
              });
            }
          });
          set({ connectedUsers: users });
        };

        const awarenessChangeHandler = (changes: {
          added: number[];
          updated: number[];
          removed: number[];
        }) => {
          // Clean up editing states for disconnected users
          if (changes.removed.length > 0 && !isViewMode) {
            const states = awareness.getStates();
            const yNodes = doc.getMap<Y.Map<unknown>>('nodes');

            // Check all nodes and clean up any that are marked as being edited
            // but the editor is no longer in the awareness states
            const currentUserNames = new Set<string>();
            states.forEach((state) => {
              if ('userName' in state && state.userName) {
                currentUserNames.add(state.userName as string);
              }
            });

            yNodes.forEach((yNode) => {
              const editedBy = yNode.get('editedBy') as string | null;
              const isBeingEdited = yNode.get('isBeingEdited') as boolean;

              // If a node is being edited but the editor is no longer connected, clean it up
              if (
                isBeingEdited &&
                editedBy &&
                !currentUserNames.has(editedBy)
              ) {
                yNode.set('isBeingEdited', false);
                yNode.set('editedBy', null);
              }
            });
          }

          updateConnectedUsers();
        };

        awareness.on('change', awarenessChangeHandler);

        // Call immediately to get current state
        updateConnectedUsers();

        // Add beforeunload handler to ensure cleanup on page close/refresh
        const handleBeforeUnload = () => {
          awareness.setLocalState(null);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        // Store cleanup function to remove listener and beforeunload handler
        const cleanupAwareness = () => {
          awareness.off('change', awarenessChangeHandler);
          window.removeEventListener('beforeunload', handleBeforeUnload);
        };

        const applyFromY = () => {
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

          // Get diagram name from Yjs metadata
          const yMetadata = doc.getMap<string>('metadata');
          const diagramName = yMetadata.get('name') || learningPathId;

          set({ nodes, edges, title: diagramName });
        };

        provider.once('sync', async (isSynced: boolean) => {
          try {
            if (!isSynced) return;

            // Clear timeout on successful sync
            clearTimeout(syncTimeout);

            // Assign color after sync - now yUserColors has data from other clients
            const yUserColors = doc.getMap<string>('userColors');

            // Check if this user already has a color assigned
            let userColor = yUserColors.get(user.userId);

            if (!userColor) {
              // Find first unused color from the palette
              const usedColors = new Set(yUserColors.values());
              userColor = AVATAR_COLORS.find((color) => !usedColors.has(color));

              if (!userColor) {
                // All colors in use - use modulo of total assigned colors
                userColor =
                  AVATAR_COLORS[yUserColors.size % AVATAR_COLORS.length];
              }

              // Persist the color assignment
              yUserColors.set(user.userId, userColor);
            }

            // Update the stored currentUser to include the color and mode
            set({
              currentUser: {
                ...user,
                color: userColor,
                mode: isViewMode ? 'view' : 'edit',
              },
            });

            // Set local awareness state with user info
            awareness.setLocalState({
              userId: user.userId,
              userName: user.userName,
              color: userColor,
              mode: isViewMode ? 'view' : 'edit',
            });

            // Fetch initial diagram data if not already loaded
            if (yNodes.size === 0) {
              try {
                // /editor/diagrams/:id → nginx → be-editor /api/diagrams/:id
                const response = await fetch(
                  `/editor/diagrams/${learningPathId}`,
                );

                if (response.ok) {
                  const diagram = (await response.json()) as {
                    nodes: DiagramNode[];
                    edges: DiagramEdge[];
                    name: string;
                  };

                  // Use transaction to batch all updates and fire observers only once
                  doc.transact(() => {
                    // Store diagram name in Yjs metadata for all clients
                    const yMetadata = doc.getMap<string>('metadata');
                    if (!yMetadata.get('name')) {
                      yMetadata.set('name', diagram.name);
                    }

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
                  });

                  // Observers will fire automatically after transaction
                } else {
                  console.error(
                    `API returned error status: ${String(response.status)}`,
                  );
                }
              } catch (error) {
                console.error('Failed to fetch initial diagram:', error);
              }
            } else {
              applyFromY();
            }

            // Mark initialization as complete
            set({ isInitializing: false });
          } catch (error) {
            console.error('Error in provider sync callback:', error);
            clearTimeout(syncTimeout);
            set({ isInitializing: false });
          }
        });

        yNodes.observeDeep(() => {
          applyFromY();
        });
        yEdges.observeDeep(() => {
          applyFromY();
        });

        // Add initialization timeout to prevent infinite loading
        const syncTimeout = setTimeout(() => {
          const currentState = get();
          if (currentState.isInitializing) {
            console.error(
              `WebSocket sync timeout after 30s for: "${learningPathId}"`,
            );
            set({ isInitializing: false, syncTimeoutId: null });
          }
        }, 30000);

        set({ syncTimeoutId: syncTimeout });

        provider.on('status', (event: { status: string }) => {
          const isConnected = event.status === 'connected';
          set({ isConnected });
        });

        // Handle connection errors (including authentication failures)
        provider.on('connection-error', (event: Event) => {
          const errorMsg =
            event instanceof ErrorEvent
              ? event.message
              : event instanceof Error
                ? event.message
                : 'Unknown error';
          console.error('WebSocket connection error:', errorMsg);

          const currentState = get();
          if (currentState.isInitializing) {
            if (currentState.syncTimeoutId) {
              clearTimeout(currentState.syncTimeoutId);
            }
            set({ isInitializing: false, syncTimeoutId: null });
          }

          // On auth error (401/4401), redirect to login directly
          // No need to validate - the error itself indicates invalid auth
          if (errorMsg.includes('4401') || errorMsg.includes('Unauthorized')) {
            window.location.href = '/login';
          }
        });

        set({
          ydoc: doc,
          yProvider: provider,
          awareness,
          awarenessCleanup: cleanupAwareness,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to load diagram:', errorMessage);
        set({ isInitializing: false });
      }
    },
    cleanup: () => {
      const { yProvider, ydoc, awareness, awarenessCleanup, syncTimeoutId } =
        get();

      if (syncTimeoutId) {
        clearTimeout(syncTimeoutId);
      }

      // Remove awareness listener first
      if (awarenessCleanup) {
        awarenessCleanup();
      }

      // Destroy awareness first - this will automatically notify other clients
      if (awareness) {
        // Setting local state to null removes this client from awareness
        awareness.setLocalState(null);
      }

      // Destroy provider and doc
      if (yProvider) {
        try {
          yProvider.destroy();
        } catch {
          // Ignore errors during provider destruction (e.g., WebSocket already closed)
        }
      }
      if (ydoc) {
        try {
          ydoc.destroy();
        } catch {
          // Ignore errors during doc destruction
        }
      }

      set({
        yProvider: null,
        ydoc: null,
        awareness: null,
        awarenessCleanup: null,
        syncTimeoutId: null,
        isConnected: false,
        connectedUsers: [],
        currentUser: null,
        learningPathId: 'default',
        isInitializing: false,
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

      // Handle selection changes (similar to edges)
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
            // Update and Calculate Node Side
            const newSide = calculateNodeSide(change.position.x);
            const currentData = yNode.get('data') as Record<string, unknown>;

            yNode.set('position', {
              x: change.position.x,
              y: change.position.y,
            });
            // Updade node side if changed
            if (currentData.side !== newSide) {
              yNode.set('data', {
                ...currentData,
                side: newSide,
              });
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

    deleteAllNodes: () => {
      const { ydoc, isViewMode } = get();
      if (!ydoc || isViewMode) return;
      const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
      yNodes.clear();
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

    updateNodeData: (nodeId, data) => {
      const { ydoc, isViewMode } = get();
      if (!ydoc || isViewMode) return;
      const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
      const yNode = yNodes.get(nodeId);
      if (yNode) {
        yNode.set('data', data);
      }
    },
    updateCursor: (position: { x: number; y: number }) => {
      const { awareness } = get();
      if (!awareness) return;

      const currentState = awareness.getLocalState() as Record<
        string,
        unknown
      > | null;
      awareness.setLocalState({
        ...currentState,
        cursor: position,
      });
    },
    updateSelection: (nodeIds: string[]) => {
      const { awareness } = get();
      if (!awareness) return;

      const currentState = awareness.getLocalState() as Record<
        string,
        unknown
      > | null;
      awareness.setLocalState({
        ...currentState,
        selection: nodeIds,
      });
    },
  })),
);
