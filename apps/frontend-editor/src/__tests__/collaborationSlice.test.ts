import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { create } from 'zustand';
import * as Y from 'yjs';
import type {
  CollaborativeState,
  CollaborationSlice,
  CollaborativeUser,
} from '@/types/collaboration';
import { createCollaborationSlice } from '@/store/collaborationStore/slices/collaborationSlice';
import { AVATAR_COLORS } from '@/store/collaborationStore/constants';

/**
 * Mock awareness object for testing cursor/selection updates
 */
function createMockAwareness() {
  let localState: Record<string, unknown> | null = null;
  const listeners = new Map<string, Set<(args: unknown) => void>>();

  return {
    getLocalState: () => localState,
    setLocalState: (state: Record<string, unknown> | null) => {
      localState = state;
    },
    getStates: () => new Map(),
    on: (event: string, handler: (args: unknown) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    },
    off: (event: string, handler: (args: unknown) => void) => {
      listeners.get(event)?.delete(handler);
    },
    _emit: (event: string, args: unknown) => {
      listeners.get(event)?.forEach((handler) => handler(args));
    },
  };
}

/**
 * Creates a test store with CollaborationSlice state pre-configured
 */
function createTestStore(overrides: Partial<CollaborationSlice> = {}) {
  type TestState = CollaborationSlice & { isViewMode: boolean };

  return create<TestState>()((set, get, api) => ({
    ...createCollaborationSlice(
      set as Parameters<typeof createCollaborationSlice>[0],
      get as unknown as () => CollaborativeState,
      api as Parameters<typeof createCollaborationSlice>[2],
    ),
    isViewMode: false,
    ...overrides,
  }));
}

describe('Collaboration Slice', () => {
  describe('Cursor Updates', () => {
    it('updates cursor position via awareness', () => {
      const mockAwareness = createMockAwareness();
      mockAwareness.setLocalState({ userId: 'u1', userName: 'Alice' });

      const store = createTestStore({
        awareness: mockAwareness as unknown as CollaborationSlice['awareness'],
      });

      store.getState().updateCursor({ x: 100, y: 200 });

      const state = mockAwareness.getLocalState();
      expect(state?.cursor).toEqual({ x: 100, y: 200 });
    });

    it('preserves existing awareness state when updating cursor', () => {
      const mockAwareness = createMockAwareness();
      mockAwareness.setLocalState({
        userId: 'u1',
        userName: 'Alice',
        color: '#6366f1',
        selection: ['n1'],
      });

      const store = createTestStore({
        awareness: mockAwareness as unknown as CollaborationSlice['awareness'],
      });

      store.getState().updateCursor({ x: 50, y: 75 });

      const state = mockAwareness.getLocalState();
      expect(state?.userId).toBe('u1');
      expect(state?.userName).toBe('Alice');
      expect(state?.color).toBe('#6366f1');
      expect(state?.selection).toEqual(['n1']);
      expect(state?.cursor).toEqual({ x: 50, y: 75 });
    });

    it('handles missing awareness gracefully', () => {
      const store = createTestStore({ awareness: null });

      // Should not throw
      expect(() => store.getState().updateCursor({ x: 0, y: 0 })).not.toThrow();
    });
  });

  describe('Selection Updates', () => {
    it('updates selection via awareness', () => {
      const mockAwareness = createMockAwareness();
      mockAwareness.setLocalState({ userId: 'u1', userName: 'Alice' });

      const store = createTestStore({
        awareness: mockAwareness as unknown as CollaborationSlice['awareness'],
      });

      store.getState().updateSelection(['node-1', 'node-2']);

      const state = mockAwareness.getLocalState();
      expect(state?.selection).toEqual(['node-1', 'node-2']);
    });

    it('allows clearing selection by passing empty array', () => {
      const mockAwareness = createMockAwareness();
      mockAwareness.setLocalState({
        userId: 'u1',
        userName: 'Alice',
        selection: ['node-1'],
      });

      const store = createTestStore({
        awareness: mockAwareness as unknown as CollaborationSlice['awareness'],
      });

      store.getState().updateSelection([]);

      const state = mockAwareness.getLocalState();
      expect(state?.selection).toEqual([]);
    });

    it('handles missing awareness gracefully', () => {
      const store = createTestStore({ awareness: null });

      expect(() => store.getState().updateSelection(['n1'])).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('clears all collaboration state on cleanup', () => {
      const mockAwareness = createMockAwareness();
      const mockProvider = {
        destroy: vi.fn(),
      };
      const mockYdoc = {
        destroy: vi.fn(),
      };
      const mockCleanup = vi.fn();

      const store = createTestStore({
        awareness: mockAwareness as unknown as CollaborationSlice['awareness'],
        yProvider:
          mockProvider as unknown as CollaborationSlice['yProvider'],
        ydoc: mockYdoc as unknown as CollaborationSlice['ydoc'],
        awarenessCleanup: mockCleanup,
        isConnected: true,
        connectedUsers: [
          { userId: 'u1', userName: 'Alice' } as CollaborativeUser,
        ],
        currentUser: { userId: 'u1', userName: 'Alice' } as CollaborativeUser,
        learningPathId: 'diagram-123',
        isInitializing: true,
      });

      store.getState().cleanup();

      const state = store.getState();
      expect(state.yProvider).toBeNull();
      expect(state.ydoc).toBeNull();
      expect(state.awareness).toBeNull();
      expect(state.isConnected).toBe(false);
      expect(state.connectedUsers).toEqual([]);
      expect(state.currentUser).toBeNull();
      expect(state.learningPathId).toBe('default');
      expect(state.isInitializing).toBe(false);
    });

    it('calls provider and doc destroy methods', () => {
      const mockProvider = { destroy: vi.fn() };
      const mockYdoc = { destroy: vi.fn() };
      const mockCleanup = vi.fn();

      const store = createTestStore({
        yProvider:
          mockProvider as unknown as CollaborationSlice['yProvider'],
        ydoc: mockYdoc as unknown as CollaborationSlice['ydoc'],
        awarenessCleanup: mockCleanup,
      });

      store.getState().cleanup();

      expect(mockProvider.destroy).toHaveBeenCalled();
      expect(mockYdoc.destroy).toHaveBeenCalled();
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('clears awareness local state', () => {
      const mockAwareness = createMockAwareness();
      mockAwareness.setLocalState({ userId: 'u1', userName: 'Alice' });

      const store = createTestStore({
        awareness: mockAwareness as unknown as CollaborationSlice['awareness'],
      });

      store.getState().cleanup();

      expect(mockAwareness.getLocalState()).toBeNull();
    });

    it('clears sync timeout if present', () => {
      vi.useFakeTimers();
      const timeoutId = setTimeout(() => {}, 30000);

      const store = createTestStore({
        syncTimeoutId: timeoutId,
      });

      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      store.getState().cleanup();

      expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId);
      vi.useRealTimers();
    });

    it('handles errors in provider destruction gracefully', () => {
      const mockProvider = {
        destroy: vi.fn(() => {
          throw new Error('Destruction failed');
        }),
      };

      const store = createTestStore({
        yProvider:
          mockProvider as unknown as CollaborationSlice['yProvider'],
      });

      // Should not throw
      expect(() => store.getState().cleanup()).not.toThrow();
    });
  });
});

describe('Avatar Colors', () => {
  it('provides enough colors for typical team size', () => {
    expect(AVATAR_COLORS.length).toBeGreaterThanOrEqual(10);
  });

  it('contains only valid hex colors', () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    AVATAR_COLORS.forEach((color) => {
      expect(color).toMatch(hexColorRegex);
    });
  });

  it('contains no duplicate colors', () => {
    const uniqueColors = new Set(AVATAR_COLORS);
    expect(uniqueColors.size).toBe(AVATAR_COLORS.length);
  });
});
