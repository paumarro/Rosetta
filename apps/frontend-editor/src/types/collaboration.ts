import type { DiagramNode, DiagramEdge } from './reactflow';
import type { Connection, NodeChange, EdgeChange } from '@xyflow/react';
import type * as Y from 'yjs';
import type { WebsocketProvider } from 'y-websocket';
import type { Awareness } from 'y-protocols/awareness';

/**
 * Collaborative session user (different from auth User)
 */
export interface CollaborativeUser {
  userId: string;
  userName: string;
  photoURL?: string;
  cursor?: { x: number; y: number };
  selection?: string[];
  color?: string;
  mode?: 'edit' | 'view';
}

/**
 * Diagram Slice - React Flow state and node/edge operations
 */
export interface DiagramSlice {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  title: string;

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
}

/**
 * Node lock entry stored in Yjs nodeLocks map.
 * Used to track which user is editing which node.
 */
export interface NodeLock {
  userId: string;
  userName: string;
  timestamp: number;
}

/**
 * Collaboration Slice - Yjs, WebSocket, and user presence
 */
export interface CollaborationSlice {
  isConnected: boolean;
  isInitializing: boolean;
  connectedUsers: CollaborativeUser[];
  currentUser: CollaborativeUser | null;
  learningPathId: string;
  ydoc: Y.Doc | null;
  yProvider: WebsocketProvider | null;
  awareness: Awareness | null;
  awarenessCleanup: (() => void) | null;
  syncTimeoutId: NodeJS.Timeout | null;
  /** Reactive state derived from Yjs nodeLocks map */
  nodeLocks: Map<string, NodeLock>;

  initializeCollaboration: (
    learningPathId: string,
    user: CollaborativeUser,
    isViewMode?: boolean,
  ) => void;
  cleanup: () => void;
  updateCursor: (position: { x: number; y: number }) => void;
  updateSelection: (nodeIds: string[]) => void;
  /** Acquires a lock on a node. Returns true if successful, false if locked by another user. */
  acquireNodeLock: (nodeId: string) => boolean;
  /** Releases the lock on a node. Only the lock owner can release. */
  releaseNodeLock: (nodeId: string) => void;
  /** Gets the current lock holder for a node, or null if unlocked. */
  getNodeLockHolder: (nodeId: string) => NodeLock | null;
}

/**
 * UI Slice - Local UI state (not synced across users)
 * Shake feedback is triggered when a user attempts to open a locked node.
 */
export interface UISlice {
  modalNodeId: string | null;
  isViewMode: boolean;
  /** Node ID to trigger shake animation on (set when lock acquisition fails) */
  shakeNodeId: string | null;

  /** Opens modal or triggers shake if node is locked by another user */
  openNodeModal: (nodeId: string) => void;
  closeNodeModal: () => void;
  setViewMode: (isViewMode: boolean) => void;
  /** Clears the shake animation trigger */
  clearShakeNode: () => void;
}

/**
 * Combined store type
 */
export type CollaborativeState = DiagramSlice & CollaborationSlice & UISlice;
