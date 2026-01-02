import type { StateCreator } from 'zustand';
import type { DiagramNode, DiagramEdge } from '@/types/reactflow';
import type {
  CollaborativeState,
  CollaborationSlice,
  CollaborativeUser,
  NodeLock,
} from '@/types/collaboration';
import {
  AVATAR_COLORS,
  SYNC_TIMEOUT_MS,
  BACKEND_STATE_SYNC_DELAY_MS,
  LOCK_STALE_THRESHOLD_MS,
  AWARENESS_HEARTBEAT_INTERVAL_MS,
} from '../constants';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { isTestMode, getTestUserId } from '@/components/TestUserProvider';

/**
 * Builds WebSocket provider options with test mode params if applicable
 * Uses y-websocket's params option which correctly appends query params
 * AFTER the room name is added to the URL path
 */
function buildWebSocketOptions(user: CollaborativeUser): {
  params?: Record<string, string>;
} {
  if (isTestMode()) {
    const testUserId = getTestUserId();
    if (testUserId) {
      return {
        params: {
          testUser: testUserId,
          testName: user.userName,
          testCommunity: 'TestCommunity',
        },
      };
    }
  }
  return {};
}

/**
 * Builds fetch options with test mode headers if applicable
 */
function buildFetchOptions(user: CollaborativeUser): RequestInit {
  if (isTestMode()) {
    const testUserId = getTestUserId();
    if (testUserId) {
      return {
        headers: {
          'X-Test-User': testUserId,
          'X-Test-Name': user.userName,
          'X-Test-Community': 'TestCommunity',
        },
      };
    }
  }
  return {};
}

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
  nodeLocks: new Map<string, NodeLock>(),

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
      // Use y-websocket's params option which correctly appends query params
      // AFTER the room name is added to the URL path
      const wsOptions = buildWebSocketOptions(user);
      const provider = new WebsocketProvider(
        wsUrl,
        learningPathId,
        doc,
        wsOptions,
      );

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
              photoURL: state.photoURL as string | undefined,
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
      // Clean up locks when users leave awareness (e.g., close tab)
      // The heartbeat mechanism keeps awareness alive while tab is open,
      // so locks will only be cleaned up when user truly disconnects.
      const awarenessChangeHandler = (changes: {
        added: number[];
        updated: number[];
        removed: number[];
      }) => {
        // Clean up locks for users who left awareness
        if (changes.removed.length > 0 && !isViewMode) {
          const states = awareness.getStates();
          const connectedUserIds = new Set<string>();
          states.forEach((state) => {
            if ('userId' in state && state.userId) {
              connectedUserIds.add(state.userId as string);
            }
          });

          // Release locks held by users no longer in awareness
          const yNodeLocks = doc.getMap<NodeLock>('nodeLocks');
          const locksToRemove: string[] = [];
          yNodeLocks.forEach((lock, nodeId) => {
            if (!connectedUserIds.has(lock.userId)) {
              locksToRemove.push(nodeId);
            }
          });

          if (locksToRemove.length > 0) {
            locksToRemove.forEach((nodeId) => {
              const lock = yNodeLocks.get(nodeId);
              if (lock) {
                console.log(
                  `[NodeLock] Releasing lock on ${nodeId} (user ${lock.userName} left awareness)`,
                );
              }
              yNodeLocks.delete(nodeId);

              // Also clear the node's editing state for visual feedback
              const yNode = yNodes.get(nodeId);
              if (yNode) {
                yNode.set('isBeingEdited', false);
                yNode.set('editedBy', null);
              }
            });
          }
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

      // Apply Yjs state to React state (nodes/edges only, NOT title)
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

        // Only update nodes/edges, NOT title (title comes from API)
        set({ nodes, edges });
      };

      // Handle initial sync
      provider.once('sync', async (isSynced: boolean) => {
        try {
          if (!isSynced) return;
          clearTimeout(syncTimeout);

          // Wait for backend to apply persisted state before checking if initialization is needed
          // The backend's bindState is async, so persisted state may arrive after sync event
          await new Promise((resolve) =>
            setTimeout(resolve, BACKEND_STATE_SYNC_DELAY_MS),
          );

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
            photoURL: user.photoURL,
            color: userColor,
            mode: isViewMode ? 'view' : 'edit',
          });

          // ALWAYS fetch name from API (source of truth for name)
          // Only fetch full diagram (nodes/edges) if Yjs is empty
          try {
            const response = await fetch(
              `/editor/diagrams/${learningPathId}`,
              buildFetchOptions(user),
            );
            if (response.ok) {
              const diagram = (await response.json()) as {
                nodes: DiagramNode[];
                edges: DiagramEdge[];
                name: string;
              };

              // ALWAYS set name in React state (source of truth)
              set({ title: diagram.name || learningPathId });

              // Only initialize with template if Yjs is COMPLETELY empty
              // If Yjs has ANY data, use it (preserves all edits, including deletions)
              if (yNodes.size === 0) {
                doc.transact(() => {
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
                applyFromY(); // Sync template to React state
              } else {
                applyFromY(); // Sync existing Yjs data to React
              }
            } else {
              console.error(
                `API returned error status: ${String(response.status)}`,
              );

              // In test mode with 404, initialize with a default test diagram
              if (
                isTestMode() &&
                response.status === 404 &&
                yNodes.size === 0
              ) {
                console.log(
                  '[Test Mode] Diagram not found, creating test diagram',
                );
                set({ title: `Test: ${learningPathId}` });

                // Create a default test node so users have something to work with
                const testNodeId = `test-node-${String(Date.now())}`;
                doc.transact(() => {
                  const yNode = new Y.Map<unknown>();
                  yNode.set('type', 'topic');
                  yNode.set('position', { x: 0, y: 0 });
                  yNode.set('data', {
                    label: 'Test Topic',
                    description:
                      'This is a test node for collaborative editing. Try opening this in another browser tab!',
                    resources: [],
                  });
                  yNode.set('isBeingEdited', false);
                  yNode.set('editedBy', null);
                  yNodes.set(testNodeId, yNode);
                });
                applyFromY();
              } else {
                set({ title: learningPathId }); // Fallback
              }
            }
          } catch (error) {
            console.error('Failed to fetch diagram:', error);
            set({ title: learningPathId }); // Fallback
          }

          set({ isInitializing: false });
        } catch (error) {
          console.error('Error in provider sync callback:', error);
          clearTimeout(syncTimeout);
          set({ isInitializing: false });
        }
      });

      // Observe Yjs changes for nodes/edges (NOT metadata - title comes from API)
      yNodes.observeDeep(() => {
        applyFromY();
      });
      yEdges.observeDeep(() => {
        applyFromY();
      });

      // Observe nodeLocks for reactive updates
      const yNodeLocks = doc.getMap<NodeLock>('nodeLocks');
      yNodeLocks.observe(() => {
        const locks = new Map<string, NodeLock>();
        yNodeLocks.forEach((lock, nodeId) => {
          locks.set(nodeId, lock);
        });
        set({ nodeLocks: locks });
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

      // Start awareness heartbeat to keep connection alive
      // Yjs Awareness has a 30-second timeout - we send a heartbeat every 15 seconds
      const heartbeatInterval = setInterval(() => {
        const currentState = awareness.getLocalState() as Record<
          string,
          unknown
        > | null;
        if (currentState) {
          // Touch the state with a timestamp to trigger an awareness update
          awareness.setLocalState({
            ...currentState,
            lastHeartbeat: Date.now(),
          });
        }
      }, AWARENESS_HEARTBEAT_INTERVAL_MS);

      // Store the heartbeat interval for cleanup
      const originalCleanup = cleanupAwareness;
      const cleanupWithHeartbeat = () => {
        clearInterval(heartbeatInterval);
        originalCleanup();
      };

      set({
        ydoc: doc,
        yProvider: provider,
        awareness,
        awarenessCleanup: cleanupWithHeartbeat,
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
      nodeLocks: new Map(),
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

  /**
   * Attempts to acquire a lock on a node.
   * Returns true if successful, false if the node is already locked by another user.
   * Locks are stored in a dedicated Yjs map for atomic operations.
   */
  acquireNodeLock: (nodeId: string): boolean => {
    const { ydoc, currentUser, isViewMode } = get();
    if (!ydoc || !currentUser || isViewMode) return false;

    const yNodeLocks = ydoc.getMap<NodeLock>('nodeLocks');
    const existingLock = yNodeLocks.get(nodeId);

    // Check if already locked by another user
    if (existingLock && existingLock.userId !== currentUser.userId) {
      const now = Date.now();
      const lockAge = now - existingLock.timestamp;

      // Only allow acquiring if the lock is stale (past timeout threshold)
      // Locks persist across navigation/refresh, so we don't check connected status
      if (lockAge > LOCK_STALE_THRESHOLD_MS) {
        // Stale lock - can be forcibly released
        console.log(
          `[NodeLock] Releasing stale lock on ${nodeId} (age: ${String(Math.round(lockAge / 1000))}s, holder: ${existingLock.userName})`,
        );
      } else {
        // Lock is still valid (within timeout) - cannot acquire
        return false;
      }
    }

    // Acquire the lock
    const newLock: NodeLock = {
      userId: currentUser.userId,
      userName: currentUser.userName,
      timestamp: Date.now(),
    };
    yNodeLocks.set(nodeId, newLock);

    // Also update the node's isBeingEdited for visual feedback
    const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
    const yNode = yNodes.get(nodeId);
    if (yNode) {
      yNode.set('isBeingEdited', true);
      yNode.set('editedBy', currentUser.userName);
    }

    return true;
  },

  /**
   * Releases a lock on a node.
   * Only the lock owner can release their lock.
   */
  releaseNodeLock: (nodeId: string) => {
    const { ydoc, currentUser, isViewMode } = get();
    if (!ydoc || !currentUser || isViewMode) return;

    const yNodeLocks = ydoc.getMap<NodeLock>('nodeLocks');
    const existingLock = yNodeLocks.get(nodeId);

    // Only release if we own the lock
    if (existingLock && existingLock.userId === currentUser.userId) {
      yNodeLocks.delete(nodeId);

      // Also update the node's isBeingEdited for visual feedback
      const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
      const yNode = yNodes.get(nodeId);
      if (yNode) {
        yNode.set('isBeingEdited', false);
        yNode.set('editedBy', null);
      }
    }
  },

  /**
   * Gets the current lock holder for a node.
   * Returns null if the node is not locked.
   */
  getNodeLockHolder: (nodeId: string): NodeLock | null => {
    const { ydoc } = get();
    if (!ydoc) return null;

    const yNodeLocks = ydoc.getMap<NodeLock>('nodeLocks');
    return yNodeLocks.get(nodeId) ?? null;
  },
});
