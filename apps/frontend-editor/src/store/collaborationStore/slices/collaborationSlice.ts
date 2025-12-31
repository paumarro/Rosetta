import type { StateCreator } from 'zustand';
import type { DiagramNode, DiagramEdge } from '@/types/reactflow';
import type {
  CollaborativeState,
  CollaborationSlice,
  CollaborativeUser,
} from '@/types/collaboration';
import { AVATAR_COLORS, SYNC_TIMEOUT_MS } from '../constants';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export const createCollaborationSlice: StateCreator<
  CollaborativeState,
  [],
  [],
  CollaborationSlice
> = (set, get) => ({
  // Initial state
  isConnected: false,
  isInitializing: false,
  connectedUsers: [],
  currentUser: null,
  learningPathId: 'default',
  ydoc: null,
  yProvider: null,
  awareness: null,
  awarenessCleanup: null,
  syncTimeoutId: null,

  // Actions
  initializeCollaboration: (
    learningPathId: string,
    user: CollaborativeUser,
    isViewMode = false,
  ) => {
    const state = get();

    if (state.isInitializing) return;

    // If already connected to this diagram, just update mode
    if (state.yProvider && state.learningPathId === learningPathId) {
      if (state.isViewMode !== isViewMode) {
        set({
          isViewMode,
          currentUser: state.currentUser
            ? { ...state.currentUser, mode: isViewMode ? 'view' : 'edit' }
            : null,
        });

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
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/editor/ws`;
      const provider = new WebsocketProvider(wsUrl, learningPathId, doc);

      const yNodes = doc.getMap<Y.Map<unknown>>('nodes');
      const yEdges = doc.getMap<Y.Map<unknown>>('edges');
      const awareness = provider.awareness;

      // Update connected users from awareness
      const updateConnectedUsers = () => {
        const states = awareness.getStates();
        const users: CollaborativeUser[] = [];
        states.forEach((state) => {
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

      // Handle awareness changes (user join/leave)
      const awarenessChangeHandler = (changes: {
        added: number[];
        updated: number[];
        removed: number[];
      }) => {
        // Clean up editing states for disconnected users
        if (changes.removed.length > 0 && !isViewMode) {
          const states = awareness.getStates();
          const currentUserNames = new Set<string>();
          states.forEach((state) => {
            if ('userName' in state && state.userName) {
              currentUserNames.add(state.userName as string);
            }
          });

          yNodes.forEach((yNode) => {
            const editedBy = yNode.get('editedBy') as string | null;
            const isBeingEdited = yNode.get('isBeingEdited') as boolean;
            if (isBeingEdited && editedBy && !currentUserNames.has(editedBy)) {
              yNode.set('isBeingEdited', false);
              yNode.set('editedBy', null);
            }
          });
        }
        updateConnectedUsers();
      };

      awareness.on('change', awarenessChangeHandler);
      updateConnectedUsers();

      // Cleanup on page close
      const handleBeforeUnload = () => {
        awareness.setLocalState(null);
      };
      window.addEventListener('beforeunload', handleBeforeUnload);

      const cleanupAwareness = () => {
        awareness.off('change', awarenessChangeHandler);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };

      // Apply Yjs state to React state
      const applyFromY = () => {
        const nodes = Array.from(yNodes.entries()).map(([id, yNode]) => ({
          id,
          type: (yNode.get('type') as string | undefined) || 'topic',
          position: (yNode.get('position') as
            | { x: number; y: number }
            | undefined) || {
            x: 0,
            y: 0,
          },
          data:
            (yNode.get('data') as Record<string, unknown> | undefined) || {},
          isBeingEdited: Boolean(yNode.get('isBeingEdited')),
          editedBy:
            (yNode.get('editedBy') as string | null | undefined) || null,
        })) as DiagramNode[];

        const edges = Array.from(yEdges.entries()).map(([id, yEdge]) => ({
          id,
          source: (yEdge.get('source') as string) || '',
          target: (yEdge.get('target') as string) || '',
          sourceHandle: (yEdge.get('sourceHandle') as string | null) ?? null,
          targetHandle: (yEdge.get('targetHandle') as string | null) ?? null,
        })) as DiagramEdge[];

        const yMetadata = doc.getMap<string>('metadata');
        const diagramName = yMetadata.get('name') || learningPathId;

        set({ nodes, edges, title: diagramName });
      };

      // Handle initial sync
      provider.once('sync', async (isSynced: boolean) => {
        try {
          if (!isSynced) return;
          clearTimeout(syncTimeout);

          // Assign user color
          const yUserColors = doc.getMap<string>('userColors');
          let userColor = yUserColors.get(user.userId);

          if (!userColor) {
            const usedColors = new Set(yUserColors.values());
            userColor = AVATAR_COLORS.find((c) => !usedColors.has(c));
            if (!userColor) {
              userColor =
                AVATAR_COLORS[yUserColors.size % AVATAR_COLORS.length];
            }
            yUserColors.set(user.userId, userColor);
          }

          set({
            currentUser: {
              ...user,
              color: userColor,
              mode: isViewMode ? 'view' : 'edit',
            },
          });

          awareness.setLocalState({
            userId: user.userId,
            userName: user.userName,
            color: userColor,
            mode: isViewMode ? 'view' : 'edit',
          });

          // Fetch initial diagram if empty
          if (yNodes.size === 0) {
            try {
              const response = await fetch(
                `/editor/diagrams/${learningPathId}`,
              );
              if (response.ok) {
                const diagram = (await response.json()) as {
                  nodes: DiagramNode[];
                  edges: DiagramEdge[];
                  name: string;
                };

                doc.transact(() => {
                  const yMetadata = doc.getMap<string>('metadata');
                  // Always sync name from MongoDB (allows updates from backend)
                  yMetadata.set('name', diagram.name);

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

          set({ isInitializing: false });
        } catch (error) {
          console.error('Error in provider sync callback:', error);
          clearTimeout(syncTimeout);
          set({ isInitializing: false });
        }
      });

      // Observe Yjs changes
      yNodes.observeDeep(() => {
        applyFromY();
      });
      yEdges.observeDeep(() => {
        applyFromY();
      });

      // Sync timeout
      const syncTimeout = setTimeout(() => {
        if (get().isInitializing) {
          console.error(
            `WebSocket sync timeout after ${String(SYNC_TIMEOUT_MS)}ms for: "${learningPathId}"`,
          );
          set({ isInitializing: false, syncTimeoutId: null });
        }
      }, SYNC_TIMEOUT_MS);

      set({ syncTimeoutId: syncTimeout });

      // Connection status
      provider.on('status', (event: { status: string }) => {
        set({ isConnected: event.status === 'connected' });
      });

      // Connection errors
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

    if (syncTimeoutId) clearTimeout(syncTimeoutId);
    if (awarenessCleanup) awarenessCleanup();
    if (awareness) awareness.setLocalState(null);

    if (yProvider) {
      try {
        yProvider.destroy();
      } catch {
        // Ignore errors during destruction
      }
    }

    if (ydoc) {
      try {
        ydoc.destroy();
      } catch {
        // Ignore errors during destruction
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
      modalNodeId: null,
    });
  },

  updateCursor: (position) => {
    const { awareness } = get();
    if (!awareness) return;

    const currentState = awareness.getLocalState() as Record<
      string,
      unknown
    > | null;
    awareness.setLocalState({ ...currentState, cursor: position });
  },

  updateSelection: (nodeIds) => {
    const { awareness } = get();
    if (!awareness) return;

    const currentState = awareness.getLocalState() as Record<
      string,
      unknown
    > | null;
    awareness.setLocalState({ ...currentState, selection: nodeIds });
  },
});
