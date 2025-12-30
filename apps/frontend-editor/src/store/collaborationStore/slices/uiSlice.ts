import type { StateCreator } from 'zustand';
import type { CollaborativeState, UISlice } from '@/types/collaboration';

export const createUISlice: StateCreator<
  CollaborativeState,
  [],
  [],
  UISlice
> = (set, get) => ({
  // Initial state
  modalNodeId: null,
  isViewMode: false,

  // Actions
  openNodeModal: (nodeId: string) => {
    const { isViewMode } = get();
    set({ modalNodeId: nodeId });
    // Mark node as being edited (only in edit mode)
    if (!isViewMode) {
      get().setNodeBeingEdited(nodeId, true);
    }
  },

  closeNodeModal: () => {
    const { modalNodeId, isViewMode } = get();
    // Clear editing state before closing (only in edit mode)
    if (modalNodeId && !isViewMode) {
      get().setNodeBeingEdited(modalNodeId, false);
    }
    set({ modalNodeId: null });
  },

  setViewMode: (isViewMode: boolean) => {
    set({ isViewMode });
  },
});
