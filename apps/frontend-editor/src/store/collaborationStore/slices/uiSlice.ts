import type { StateCreator } from 'zustand';
import type { CollaborativeState, UISlice } from '@/types/collaboration';

/**
 * Creates the UI slice of the collaborative store.
 * Manages modal state, view mode settings, and shake feedback for locked nodes.
 *
 * Node locking is handled centrally in CollaborationSlice via Yjs nodeLocks map.
 * This slice only manages UI-specific state like which modal is open and shake animations.
 */
export const createUISlice: StateCreator<
  CollaborativeState,
  [],
  [],
  UISlice
> = (set, get) => ({
  // Initial state
  modalNodeId: null,
  isViewMode: false,
  shakeNodeId: null,

  // Actions

  /**
   * Attempts to open the node modal.
   * Uses the centralized lock system to check if the node is available.
   * If locked by another user, triggers shake animation instead of opening.
   */
  openNodeModal: (nodeId: string) => {
    const { isViewMode, acquireNodeLock, getNodeLockHolder, currentUser } =
      get();

    // In view mode, always allow opening (read-only)
    if (isViewMode) {
      set({ modalNodeId: nodeId, shakeNodeId: null });
      return;
    }

    // Check current lock holder
    const lockHolder = getNodeLockHolder(nodeId);

    // If locked by another user, trigger shake feedback
    if (lockHolder && lockHolder.userId !== currentUser?.userId) {
      set({ shakeNodeId: nodeId });
      return;
    }

    // Try to acquire the lock
    const lockAcquired = acquireNodeLock(nodeId);

    if (lockAcquired) {
      // Lock acquired, open the modal
      set({ modalNodeId: nodeId, shakeNodeId: null });
    } else {
      // Lock acquisition failed (race condition), trigger shake
      set({ shakeNodeId: nodeId });
    }
  },

  /**
   * Closes the node modal and releases the lock.
   */
  closeNodeModal: () => {
    const { modalNodeId, isViewMode, releaseNodeLock } = get();

    // Release the lock if we had the modal open in edit mode
    if (modalNodeId && !isViewMode) {
      releaseNodeLock(modalNodeId);
    }

    set({ modalNodeId: null });
  },

  setViewMode: (isViewMode: boolean) => {
    set({ isViewMode });
  },

  clearShakeNode: () => {
    set({ shakeNodeId: null });
  },
});
