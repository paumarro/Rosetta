import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { create } from 'zustand';
import type {
  CollaborativeState,
  UISlice,
  NodeLock,
} from '@/types/collaboration';
import { createUISlice } from '@/store/collaborationStore/slices/uiSlice';

/**
 * Creates a test store with UISlice and mock dependencies.
 * The new implementation uses acquireNodeLock, releaseNodeLock, and getNodeLockHolder
 * instead of setNodeBeingEdited.
 */
function createTestStore(options: {
  isViewMode?: boolean;
  currentUser?: { userId: string; userName: string } | null;
  /** Mock lock holder - simulates another user holding a lock */
  mockLockHolder?: NodeLock | null;
  /** Whether acquireNodeLock should succeed */
  mockAcquireLockResult?: boolean;
}) {
  type TestState = UISlice & {
    currentUser: { userId: string; userName: string } | null;
    acquireNodeLock: (nodeId: string) => boolean;
    releaseNodeLock: (nodeId: string) => void;
    getNodeLockHolder: (nodeId: string) => NodeLock | null;
  };

  const acquireNodeLockMock = vi.fn(
    () => options.mockAcquireLockResult ?? true,
  );
  const releaseNodeLockMock = vi.fn();
  const getNodeLockHolderMock = vi.fn(() => options.mockLockHolder ?? null);

  const store = create<TestState>()((set, get, api) => ({
    ...createUISlice(
      set as Parameters<typeof createUISlice>[0],
      get as unknown as () => CollaborativeState,
      api as Parameters<typeof createUISlice>[2],
    ),
    currentUser: options.currentUser ?? null,
    isViewMode: options.isViewMode ?? false,
    acquireNodeLock: acquireNodeLockMock,
    releaseNodeLock: releaseNodeLockMock,
    getNodeLockHolder: getNodeLockHolderMock,
  }));

  return {
    store,
    acquireNodeLockMock,
    releaseNodeLockMock,
    getNodeLockHolderMock,
  };
}

describe('UI Slice - Modal Locking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('openNodeModal', () => {
    it('opens modal when node is not locked', () => {
      const { store, acquireNodeLockMock, getNodeLockHolderMock } =
        createTestStore({
          currentUser: { userId: 'u1', userName: 'Alice' },
          mockLockHolder: null,
          mockAcquireLockResult: true,
        });

      store.getState().openNodeModal('n1');

      expect(getNodeLockHolderMock).toHaveBeenCalledWith('n1');
      expect(acquireNodeLockMock).toHaveBeenCalledWith('n1');
      expect(store.getState().modalNodeId).toBe('n1');
      expect(store.getState().shakeNodeId).toBeNull();
    });

    it('triggers shake when another user holds the lock', () => {
      const { store, acquireNodeLockMock, getNodeLockHolderMock } =
        createTestStore({
          currentUser: { userId: 'u1', userName: 'Alice' },
          mockLockHolder: {
            userId: 'u2',
            userName: 'Bob',
            timestamp: Date.now(),
          },
        });

      store.getState().openNodeModal('n1');

      expect(getNodeLockHolderMock).toHaveBeenCalledWith('n1');
      // Should NOT try to acquire since lock holder check fails first
      expect(acquireNodeLockMock).not.toHaveBeenCalled();
      // Modal should NOT open
      expect(store.getState().modalNodeId).toBeNull();
      // Shake should be triggered
      expect(store.getState().shakeNodeId).toBe('n1');
    });

    it('allows opening modal when current user holds the lock', () => {
      const { store, acquireNodeLockMock } = createTestStore({
        currentUser: { userId: 'u1', userName: 'Alice' },
        mockLockHolder: {
          userId: 'u1',
          userName: 'Alice',
          timestamp: Date.now(),
        },
        mockAcquireLockResult: true,
      });

      store.getState().openNodeModal('n1');

      // Should try to acquire lock (same user, so it succeeds)
      expect(acquireNodeLockMock).toHaveBeenCalledWith('n1');
      expect(store.getState().modalNodeId).toBe('n1');
      expect(store.getState().shakeNodeId).toBeNull();
    });

    it('triggers shake when lock acquisition fails (race condition)', () => {
      const { store, acquireNodeLockMock } = createTestStore({
        currentUser: { userId: 'u1', userName: 'Alice' },
        mockLockHolder: null, // No lock holder initially
        mockAcquireLockResult: false, // But acquisition fails (race condition)
      });

      store.getState().openNodeModal('n1');

      expect(acquireNodeLockMock).toHaveBeenCalledWith('n1');
      // Modal should NOT open due to failed acquisition
      expect(store.getState().modalNodeId).toBeNull();
      // Shake should be triggered
      expect(store.getState().shakeNodeId).toBe('n1');
    });

    it('allows opening modal in view mode without lock checks', () => {
      const { store, acquireNodeLockMock, getNodeLockHolderMock } =
        createTestStore({
          isViewMode: true,
          currentUser: { userId: 'u1', userName: 'Alice' },
          mockLockHolder: {
            userId: 'u2',
            userName: 'Bob',
            timestamp: Date.now(),
          },
        });

      store.getState().openNodeModal('n1');

      // In view mode, no lock checks should happen
      expect(getNodeLockHolderMock).not.toHaveBeenCalled();
      expect(acquireNodeLockMock).not.toHaveBeenCalled();
      // Modal should open even though node is "locked"
      expect(store.getState().modalNodeId).toBe('n1');
      expect(store.getState().shakeNodeId).toBeNull();
    });
  });

  describe('closeNodeModal', () => {
    it('releases lock when closing modal in edit mode', () => {
      const { store, releaseNodeLockMock } = createTestStore({
        currentUser: { userId: 'u1', userName: 'Alice' },
        mockAcquireLockResult: true,
      });

      // First open the modal
      store.getState().openNodeModal('n1');
      expect(store.getState().modalNodeId).toBe('n1');

      // Now close it
      store.getState().closeNodeModal();

      expect(releaseNodeLockMock).toHaveBeenCalledWith('n1');
      expect(store.getState().modalNodeId).toBeNull();
    });

    it('does not release lock when closing modal in view mode', () => {
      const { store, releaseNodeLockMock } = createTestStore({
        isViewMode: true,
        currentUser: { userId: 'u1', userName: 'Alice' },
      });

      // Open in view mode
      store.getState().openNodeModal('n1');
      expect(store.getState().modalNodeId).toBe('n1');

      // Close
      store.getState().closeNodeModal();

      // Should not call releaseLock in view mode
      expect(releaseNodeLockMock).not.toHaveBeenCalled();
      expect(store.getState().modalNodeId).toBeNull();
    });
  });

  describe('clearShakeNode', () => {
    it('clears the shake node ID', () => {
      const { store } = createTestStore({
        currentUser: { userId: 'u1', userName: 'Alice' },
        mockLockHolder: {
          userId: 'u2',
          userName: 'Bob',
          timestamp: Date.now(),
        },
      });

      // Trigger shake by trying to open locked node
      store.getState().openNodeModal('n1');
      expect(store.getState().shakeNodeId).toBe('n1');

      // Clear shake
      store.getState().clearShakeNode();
      expect(store.getState().shakeNodeId).toBeNull();
    });
  });
});
