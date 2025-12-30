/**
 * Collaborative Store - Central State Management for the Diagram Editor
 *
 * ARCHITECTURE
 * ============
 * This store is split into three logical slices:
 *
 * 1. DiagramSlice (slices/diagramSlice.ts)
 *    - React Flow state: nodes, edges, title
 *    - CRUD operations synced via Yjs
 *
 * 2. CollaborationSlice (slices/collaborationSlice.ts)
 *    - Yjs document and WebSocket provider
 *    - User presence via Awareness protocol
 *    - Connection state and initialization
 *
 * 3. UISlice (slices/uiSlice.ts)
 *    - Local UI state (modal, view mode)
 *    - Not synced across clients
 *
 * DATA FLOW
 * =========
 * User Action → Store Action → Yjs Update → Observer → State Update → Re-render
 *
 * NETWORK PATHS (via nginx)
 * =========================
 * - /editor/ws      → backend-editor WebSocket
 * - /editor/*       → backend-editor API
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { CollaborativeState } from '@/types/collaboration';
import { createDiagramSlice } from './slices/diagramSlice';
import { createCollaborationSlice } from './slices/collaborationSlice';
import { createUISlice } from './slices/uiSlice';

// Re-export types for convenience
export type {
  CollaborativeUser,
  CollaborativeState,
} from '@/types/collaboration';

// Re-export hooks
export { useNodeState } from './hooks/useNodeState';
export { useConnectionState } from './hooks/useConnectionState';

export const useCollaborativeStore = create<CollaborativeState>()(
  subscribeWithSelector((...args) => ({
    ...createDiagramSlice(...args),
    ...createCollaborationSlice(...args),
    ...createUISlice(...args),
  })),
);
