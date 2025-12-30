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

  initializeCollaboration: (
    learningPathId: string,
    user: CollaborativeUser,
    isViewMode?: boolean,
  ) => void;
  cleanup: () => void;
  updateCursor: (position: { x: number; y: number }) => void;
  updateSelection: (nodeIds: string[]) => void;
}

/**
 * UI Slice - Local UI state (not synced)
 */
export interface UISlice {
  modalNodeId: string | null;
  isViewMode: boolean;

  openNodeModal: (nodeId: string) => void;
  closeNodeModal: () => void;
  setViewMode: (isViewMode: boolean) => void;
}

/**
 * Combined store type
 */
export type CollaborativeState = DiagramSlice & CollaborationSlice & UISlice;
