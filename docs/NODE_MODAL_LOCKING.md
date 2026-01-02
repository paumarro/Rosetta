# Node Modal Locking

This document describes the collaborative node locking feature in the diagram editor. The feature prevents multiple users from editing the same node simultaneously, avoiding conflicts and data loss.

## Overview

When a user opens a node modal in edit mode, the node becomes **locked** to that user. Other users attempting to open the same node will see a shake animation feedback indicating the node is currently being edited.

## Architecture

### Components Involved

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Editor                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────┐ │
│  │  CustomNode  │───▶│  UISlice         │───▶│ Collaboration │ │
│  │  (shake UI)  │    │  (openNodeModal) │    │ Slice (locks) │ │
│  └──────────────┘    └──────────────────┘    └───────────────┘ │
│                                                      │          │
│                                                      ▼          │
│                                              ┌───────────────┐  │
│                                              │  Yjs Doc      │  │
│                                              │  - nodeLocks  │  │
│                                              │  - awareness  │  │
│                                              └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼ WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                        Backend Editor                            │
│                    (y-websocket server)                          │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User clicks node** → `openNodeModal()` is called
2. **Check lock** → `getNodeLockHolder()` checks Yjs `nodeLocks` map
3. **If unlocked** → `acquireNodeLock()` writes lock to Yjs → Modal opens
4. **If locked by another** → `shakeNodeId` is set → Node shakes
5. **User closes modal** → `releaseNodeLock()` removes lock from Yjs

## Key Concepts

### Node Locks (Yjs Map)

Locks are stored in a dedicated Yjs map called `nodeLocks`:

```typescript
interface NodeLock {
  userId: string;    // Unique user identifier
  userName: string;  // Display name for UI
  timestamp: number; // Lock acquisition time (for staleness detection)
}

// Yjs structure
nodeLocks: Map<nodeId, NodeLock>
```

### Awareness & Heartbeat

Yjs Awareness tracks which users are currently connected. The default awareness timeout is 30 seconds - if no updates are received, a user is considered disconnected.

To prevent false disconnections while a user has the modal open, we send a **heartbeat** every 15 seconds:

```typescript
// constants.ts
AWARENESS_HEARTBEAT_INTERVAL_MS = 15 * 1000; // 15 seconds
```

When a user truly disconnects (closes tab), their awareness times out and their locks are automatically released by other connected clients.

### Stale Lock Detection

As a fallback for edge cases where awareness cleanup doesn't fire, locks have a staleness threshold:

```typescript
// constants.ts
LOCK_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
```

If a lock is older than 5 minutes, any user can forcibly acquire it.

## Behavior Matrix

| Scenario | Behavior |
|----------|----------|
| User A opens node modal | Lock acquired, modal opens |
| User B tries to open same node | Node shakes, modal doesn't open |
| User A closes modal | Lock released, node available |
| User A's tab is open but idle | Heartbeat keeps lock alive |
| User A closes browser tab | Awareness times out (~30s), lock released |
| User A's lock is >5 min old | Lock is stale, can be overridden |
| View mode | Locks don't apply, anyone can open modal (read-only) |

## Implementation Details

### Files Changed

| File | Purpose |
|------|---------|
| `src/types/collaboration.ts` | `NodeLock` interface, updated slice types |
| `src/store/collaborationStore/constants.ts` | Timeout constants |
| `src/store/collaborationStore/slices/collaborationSlice.ts` | Lock management functions, awareness handlers |
| `src/store/collaborationStore/slices/uiSlice.ts` | Modal opening logic with lock checks |
| `src/components/diagram/CustomNode.tsx` | Shake animation trigger |
| `src/index.css` | Shake animation keyframes |

### Lock Management Functions

```typescript
// CollaborationSlice

// Attempt to acquire a lock (returns false if locked by another)
acquireNodeLock(nodeId: string): boolean

// Release a lock (only owner can release)
releaseNodeLock(nodeId: string): void

// Get current lock holder (returns null if unlocked)
getNodeLockHolder(nodeId: string): NodeLock | null
```

### UI Feedback

When a user tries to open a locked node, the node displays a shake animation:

```css
/* index.css */
@keyframes node-shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

.node-shake {
  animation: node-shake 0.5s ease-in-out;
}
```

The shake is triggered by setting `shakeNodeId` in the UI slice, which the `CustomNode` component observes.

## Testing

The locking feature is covered by unit tests in `src/__tests__/uiSlice.test.ts`:

- Opens modal when node is not locked
- Triggers shake when another user holds the lock
- Allows opening when current user holds the lock
- Handles race conditions (lock acquisition failure)
- View mode bypasses lock checks
- Lock is released when modal is closed

Run tests:
```bash
cd apps/frontend-editor
npm test
```

## Configuration

Constants can be adjusted in `src/store/collaborationStore/constants.ts`:

| Constant | Default | Description |
|----------|---------|-------------|
| `LOCK_STALE_THRESHOLD_MS` | 5 minutes | Time after which a lock becomes stale |
| `AWARENESS_HEARTBEAT_INTERVAL_MS` | 15 seconds | Heartbeat frequency to keep awareness alive |

## Troubleshooting

### Lock not releasing after user closes tab

- Awareness has a ~30 second timeout before detecting disconnection
- Check browser console for `[NodeLock] Releasing lock` messages

### User can't open node they were editing

- If user refreshed page, they should be able to re-acquire their own lock
- If lock is stale (>5 min), it will be automatically overridden

### Shake animation not playing

- Check that `shakeNodeId` is being set in the store
- Verify the `.node-shake` CSS class is applied to the node
- Check browser dev tools for animation properties

