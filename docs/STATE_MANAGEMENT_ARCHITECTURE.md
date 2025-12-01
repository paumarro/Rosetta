# Rosetta State Management Architecture - Comprehensive Analysis

**Version:** 2.0 (Updated November 2025)
**Last Updated:** 2025-11-25
**Status:** Current/Active Implementation

---

## Executive Summary

Rosetta uses a **hybrid state management architecture** combining Zustand for local application state and Yjs for collaborative real-time state synchronization. The system is split across three main applications:

1. **Frontend** - Zustand stores for user and learning path state
2. **Frontend Editor** - Zustand + Yjs for collaborative diagram editing
3. **Backend Editor** - Yjs persistence with MongoDB and WebSocket server

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [State Management Layer 1: Zustand Stores](#state-management-layer-1-zustand-stores)
3. [State Management Layer 2: Yjs CRDT](#state-management-layer-2-yjs-crdt)
4. [React Integration Patterns](#react-integration-patterns)
5. [WebSocket & Real-time Sync](#websocket--real-time-sync)
6. [Authentication & Authorization](#authentication--authorization)
7. [Data Flow Diagrams](#data-flow-diagrams)
8. [Key Implementation Patterns](#key-implementation-patterns)
9. [Known Issues & Deprecated Patterns](#known-issues--deprecated-patterns)

---

## Project Structure

### Monorepo Layout

```
rosetta-monorepo/
├── apps/
│   ├── frontend/                      # Main application (React)
│   │   ├── src/
│   │   │   ├── store/
│   │   │   │   ├── userStore.ts        # User profile state
│   │   │   │   └── learningPathStore.ts # Learning paths + favorites
│   │   │   ├── contexts/
│   │   │   │   └── AuthContext.tsx     # Auth provider (integrates with stores)
│   │   │   └── components/
│   │   │       ├── dashboard/
│   │   │       ├── creator-studio/
│   │   │       └── nav-user.tsx
│   │   └── package.json               # zustand^5.0.3
│   │
│   └── frontend-editor/               # Collaborative editor (React)
│       ├── src/
│       │   ├── lib/
│       │   │   ├── stores/
│       │   │   │   ├── collaborativeStore.ts  # Yjs + Zustand hybrid
│       │   │   │   ├── diagramStore.ts        # Diagram list (REST-based)
│       │   │   │   ├── userStore.ts           # User profile
│       │   │   │   └── index.ts               # Store exports
│       │   │   ├── hooks/
│       │   │   │   └── useNodeState.ts        # Node state selector hook
│       │   │   ├── connectionUtils.ts         # Connection validation utils
│       │   │   └── ...
│       │   ├── types/
│       │   │   ├── base.ts             # BaseStore, BaseEntity
│       │   │   ├── diagram.ts          # DiagramStore interface
│       │   │   ├── reactflow.ts        # DiagramNode, DiagramEdge
│       │   │   └── ...
│       │   └── components/
│       │       ├── DiagramEditor.tsx   # Main editor component
│       │       ├── NodeModal.tsx       # Node detail modal
│       │       ├── nodes/
│       │       │   └── topicNode.tsx   # ReactFlow node component
│       │       └── ui/
│       │           ├── Cursors.tsx     # Remote cursors
│       │           ├── AvatarDemo.tsx  # Connected users
│       │           └── addNodeButton.tsx
│       └── package.json               # zustand^5.0.6, yjs^13.6.27, y-websocket^3.0.0
│
└── services/
    ├── backend-editor/                # Node.js/Express server
    │   ├── src/
    │   │   ├── server.ts              # WebSocket server + Yjs setup
    │   │   ├── sockets/
    │   │   │   └── diagramSockets.ts   # Socket.IO removed (Yjs y-websocket used instead)
    │   │   ├── services/
    │   │   │   └── authService.ts      # Token validation
    │   │   ├── middleware/
    │   │   │   └── wsAuth.ts           # WebSocket authentication
    │   │   └── ...
    │   └── package.json               # yjs^13.6.27, y-websocket^1.5.4, y-mongodb^0.1.11
    │
    └── auth-service/                  # Separate auth service (external)
```

---

## State Management Layer 1: Zustand Stores

### 1.1 Frontend App - User Store

**File:** `/apps/frontend/src/store/userStore.ts`

```typescript
interface User {
  ID: number;
  CreatedAt: string;
  UpdatedAt: string;
  DeletedAt: string | null;
  Name: string;
  Email: string;
  EntraID: string;
  PhotoURL: string;
}

interface UserStore {
  user: User | null;
  isLoading: boolean;
  error: string | null;

  setError: (error: string | null) => void;
  fetchCurrentUser: () => Promise<void>;
  updateUserProfile: (data: UpdateUserData) => Promise<void>;
  clearUser: () => void;
}
```

**State Shape:**
- `user`: Current authenticated user from backend API
- `isLoading`: Async operation state
- `error`: Error messages for UI

**Actions:**
- `fetchCurrentUser()` - GET `/api/user/me` (relative path via nginx)
- `updateUserProfile(data)` - PATCH `/api/user/me`
- `clearUser()` - Clear store on logout
- `setError(msg)` - Manual error setting

**Middleware Used:** None (simple create)

**API Integration:**
```typescript
// Uses apiFetch helper for error handling
const response = await apiFetch('/api/user/me');
const data = (await response.json()) as User;
set({ user: data, isLoading: false, error: null });
```

**Component Usage:**
```typescript
// In Dashboard.tsx
const { user, fetchCurrentUser } = useUserStore();

useEffect(() => {
  void fetchCurrentUser();
}, [fetchCurrentUser]);
```

---

### 1.2 Frontend App - Learning Path Store

**File:** `/apps/frontend/src/store/learningPathStore.ts`

```typescript
export interface LearningPath {
  ID: string;
  Title: string;
  Description: string;
  IsPublic: boolean;
  Thumbnail: string;
  DiagramID: string;
  CreatedAt: string;
  UpdatedAt: string;
  DeletedAt?: string;
  Skills?: Skill[];
}

export interface LearningPathStore {
  learningPaths: LearningPath[];
  favorites: LearningPath[];
  isLoading: boolean;
  error: string | null;
  
  fetchLearningPaths: () => Promise<void>;
  fetchUserFavorites: () => Promise<void>;
  addToFavorites: (id: string) => Promise<void>;
  removeFromFavorites: (id: string) => Promise<void>;
  isFavorited: (id: string) => boolean;
  deleteLearningPath: (id: string) => Promise<void>;
  setError: (error: string | null) => void;
}
```

**State Shape:**
- `learningPaths`: Array of all available learning paths
- `favorites`: Array of user's favorited paths
- `isLoading`: Loading state for async operations
- `error`: Error message display

**Actions:**
- `fetchLearningPaths()` - GET `/api/learning-paths`
- `fetchUserFavorites()` - GET `/api/learning-paths/favorites`
- `addToFavorites(id)` - POST `/api/learning-paths/{id}/favorite`
- `removeFromFavorites(id)` - DELETE `/api/learning-paths/{id}/favorite`
- `deleteLearningPath(id)` - DELETE `/api/learning-paths/{id}`
- `isFavorited(id)` - Returns boolean from `get()` state

**Middleware Used:** None

**Component Usage:**
```typescript
// In LearningPaths.tsx
const { useLearningPathStore } = from '@/store/learningPathStore';
const { 
  isFavorited, 
  addToFavorites, 
  removeFromFavorites 
} = useLearningPathStore();

// Toggle favorite
const handleBookmark = async () => {
  if (isFavorited(path.ID)) {
    await removeFromFavorites(path.ID);
  } else {
    await addToFavorites(path.ID);
  }
};
```

---

### 1.3 Frontend Editor - User Store

**File:** `/apps/frontend-editor/src/lib/stores/userStore.ts`

**Similar to frontend/src/store/userStore.ts but with different API paths:**

```typescript
fetchCurrentUser: async () => {
  set({ isLoading: true, error: null });
  try {
    // Relative path - nginx routes to backend
    const response = await fetch('/api/user/me', {
      credentials: 'include',
    });
    
    if (!response.ok) {
      console.error('User not authenticated, redirecting to login');
      window.location.href = '/login';
      return;
    }

    const data = (await response.json()) as User;
    set({ user: data, isLoading: false, error: null });
  } catch (error) {
    // Redirect to login on network error
    window.location.href = '/login';
  }
}
```

---

### 1.4 Frontend Editor - Diagram Store

**File:** `/apps/frontend-editor/src/lib/stores/diagramStore.ts`

```typescript
interface DiagramStore extends BaseStore {
  diagrams: Diagram[];
  fetchDiagrams: () => Promise<void>;
  deleteDiagram: (name: string) => Promise<void>;
}
```

**State Shape:**
- `diagrams`: List of available diagrams
- `isLoading`: Async operation state
- `error`: Error messages

**Actions:**
- `fetchDiagrams()` - GET `/editor/diagrams` (nginx routes to be-editor `/api/diagrams`)
- `deleteDiagram(name)` - DELETE `/editor/diagrams/{name}`

**Used in:** `/apps/frontend-editor/src/pages/Diagrams.tsx`

```typescript
const { diagrams, isLoading, fetchDiagrams, deleteDiagram, error, setError } =
  useDiagramStore();

useEffect(() => {
  void fetchDiagrams();
}, [fetchDiagrams]);
```

---

### 1.5 Frontend Editor - Store Index

**File:** `/apps/frontend-editor/src/lib/stores/index.ts`

```typescript
// export { useCollaborationStore } from './collaborativeStore'; // Commented out
export { useDiagramStore } from './diagramStore';
```

**Note:** `useCollaborativeStore` is intentionally NOT exported from index.ts. Components import it directly:
```typescript
import { useCollaborativeStore } from '@/lib/stores/collaborativeStore';
```

This is likely a deliberate pattern to avoid circular imports or to make the store's complexity more explicit.

---

## State Management Layer 2: Yjs CRDT

### 2.1 Collaborative Store (Zustand + Yjs Hybrid)

**File:** `/apps/frontend-editor/src/lib/stores/collaborativeStore.ts`
**Lines:** 809 lines - The most complex store in the monorepo

#### Architecture Overview

This store combines:
- **Zustand** for local UI state (nodes, edges, UI flags)
- **Yjs** (CRDT) for conflict-free collaborative state
- **Awareness Protocol** for user presence (cursors, selections)
- **WebsocketProvider** for real-time synchronization

#### State Interface

```typescript
interface CollaborativeState {
  // React Flow State
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  title: string;

  // Connection State
  isConnected: boolean;

  // Collaboration State
  connectedUsers: User[];
  currentUser: User | null;
  diagramName: string;
  learningPathId: string;
  
  // Yjs Documents
  ydoc: Y.Doc | null;
  yProvider: WebsocketProvider | null;
  awareness: Awareness | null;
  awarenessCleanup: (() => void) | null;
  
  // View Mode
  isViewMode: boolean;
  syncTimeoutId: NodeJS.Timeout | null;

  // Loading States
  isInitializing: boolean;

  // Actions
  initializeCollaboration(...): Promise<void>;
  cleanup(): void;
  setNodes(...): void;
  onNodeChange(...): void;
  onEdgeChange(...): void;
  onConnect(...): void;
  addNode(...): void;
  deleteNode(...): void;
  updateNodeData(...): void;
  setNodeBeingEdited(...): void;
  updateCursor(...): void;
  updateSelection(...): void;
}
```

#### Middleware

```typescript
export const useCollaborativeStore = create<CollaborativeState>()(
  subscribeWithSelector((set, get) => ({
    // Store implementation
  }))
);
```

**Middleware:** `subscribeWithSelector` from zustand
- Enables selective subscriptions: `store.subscribe(state => state.nodes)`
- Optimizes performance by only re-rendering when specific state changes

#### Key Yjs Data Structures

**Document Structure:**
```
Y.Doc (learningPathId)
├── nodes: Y.Map<Y.Map>        // node_id -> YNode
│   └── YNode
│       ├── type: string
│       ├── position: {x, y}
│       ├── data: {...}
│       ├── isBeingEdited: boolean
│       └── editedBy: string | null
│
├── edges: Y.Map<Y.Map>        // edge_id -> YEdge
│   └── YEdge
│       ├── source: string
│       ├── target: string
│       ├── sourceHandle: string | null
│       └── targetHandle: string | null
│
├── userColors: Y.Map<string>  // userId -> hex_color
│
└── metadata: Y.Map<string>    // Contains diagram name
```

#### Initialization Flow

**Step 1: Create Yjs Document & WebSocket Provider**

```typescript
const doc = new Y.Doc();
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${window.location.host}/editor/ws`;
const provider = new WebsocketProvider(wsUrl, learningPathId, doc);
```

**Paths (with Nginx reverse proxy):**
- Development: `ws://localhost:3000/editor/ws`
- Production: via nginx to `be-editor:3001`

**Step 2: Setup Awareness (User Presence)**

```typescript
const awareness = provider.awareness;

// Update connected users from awareness states
const updateConnectedUsers = () => {
  const states = awareness.getStates();
  const users: User[] = [];
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

awareness.on('change', awarenessChangeHandler);
```

**Awareness Local State:**
```typescript
awareness.setLocalState({
  userId: user.userId,
  userName: user.userName,
  color: userColor,
  mode: isViewMode ? 'view' : 'edit',
});
```

**Step 3: Subscribe to Yjs Changes (observeDeep)**

```typescript
yNodes.observeDeep(() => {
  applyFromY(); // Sync Yjs state to Zustand
});
yEdges.observeDeep(() => {
  applyFromY();
});
```

**Step 4: Wait for Sync**

```typescript
provider.once('sync', async (isSynced: boolean) => {
  if (!isSynced) return;

  // 1. Assign user color
  const yUserColors = doc.getMap<string>('userColors');
  let userColor = yUserColors.get(user.userId);
  if (!userColor) {
    userColor = assignNewColor(yUserColors);
    yUserColors.set(user.userId, userColor);
  }

  // 2. Set awareness state
  awareness.setLocalState({
    userId: user.userId,
    userName: user.userName,
    color: userColor,
    mode: isViewMode ? 'view' : 'edit',
  });

  // 3. Load initial data if empty
  if (yNodes.size === 0) {
    const response = await fetch(`/editor/diagrams/${learningPathId}`);
    const diagram = await response.json();
    
    doc.transact(() => {
      // Batch updates for efficiency
      diagram.nodes.forEach((node) => {
        const yNode = new Y.Map();
        yNode.set('type', node.type);
        // ... set other properties
        yNodes.set(node.id, yNode);
      });
    });
  }

  set({ isInitializing: false });
});
```

#### Cleanup on Disconnect

```typescript
cleanup: () => {
  const { yProvider, ydoc, awareness, awarenessCleanup, syncTimeoutId } = get();

  // Remove awareness listeners
  if (awarenessCleanup) {
    awarenessCleanup();
  }

  // Clear local awareness state (notifies other clients)
  if (awareness) {
    awareness.setLocalState(null);
  }

  // Destroy provider and doc
  if (yProvider) {
    yProvider.destroy();
  }
  if (ydoc) {
    ydoc.destroy();
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
  });
}
```

#### Action: Add Node (Write to Yjs)

```typescript
addNode: (type, position) => {
  const { nodes, ydoc, currentUser, isViewMode } = get();

  if (!ydoc || isViewMode) {
    console.error('Cannot add node: Yjs document not initialized or in view mode');
    return;
  }

  const nodePosition = position || calculateAutoPosition(type, nodes);
  const nodeId = `${type}-${nanoid(8)}`;

  const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
  const yNode = new Y.Map<unknown>();
  
  yNode.set('type', type);
  yNode.set('position', nodePosition);
  yNode.set('data', { label: type, side: calculateNodeSide(nodePosition.x) });
  yNode.set('isBeingEdited', false);
  yNode.set('editedBy', currentUser?.userName || null);
  
  yNodes.set(nodeId, yNode);
}
```

**Important:** All writes go directly to Yjs, which automatically propagates to other clients.

#### Action: Position Change (Position Tracking)

```typescript
onNodeChange: (changes) => {
  const { ydoc, nodes, isViewMode } = get();
  if (!ydoc) return;
  const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');

  if (isViewMode) return; // Block write in view mode

  changes.forEach((change) => {
    if (change.type === 'position' && change.position) {
      const yNode = yNodes.get(change.id);
      if (yNode) {
        const newSide = calculateNodeSide(change.position.x);
        const currentData = yNode.get('data') as Record<string, unknown>;

        yNode.set('position', {
          x: change.position.x,
          y: change.position.y,
        });
        
        // Update node side if changed (for visual layout)
        if (currentData.side !== newSide) {
          yNode.set('data', { ...currentData, side: newSide });
        }
      }
    }
  });
}
```

#### Action: Node Editing State

```typescript
setNodeBeingEdited: (id: string, isBeingEdited: boolean) => {
  const { ydoc, currentUser, isViewMode } = get();
  if (!ydoc || isViewMode) return;
  
  const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
  const yNode = yNodes.get(id);
  
  if (yNode) {
    yNode.set('isBeingEdited', isBeingEdited);
    yNode.set(
      'editedBy',
      isBeingEdited ? currentUser?.userName || null : null
    );
  }
}
```

**Used in:** NodeModal component to prevent concurrent edits

#### Action: Cursor Updates (Awareness)

```typescript
updateCursor: (position: { x: number; y: number }) => {
  const { awareness } = get();
  if (!awareness) return;

  const currentState = awareness.getLocalState() as Record<string, unknown> | null;
  awareness.setLocalState({
    ...currentState,
    cursor: position,
  });
}
```

**Called on:** Mouse move events (throttled in DiagramEditor)

```typescript
// In DiagramEditor.tsx
const handleMouseMove = useCallback((e: React.MouseEvent) => {
  const now = Date.now();
  if (now - lastCursorUpdate.current > 100) { // 100ms throttle
    updateCursor({ x: e.clientX, y: e.clientY });
    lastCursorUpdate.current = now;
  }
}, [updateCursor]);
```

#### Action: Selection Updates (Awareness)

```typescript
updateSelection: (nodeIds: string[]) => {
  const { awareness } = get();
  if (!awareness) return;

  const currentState = awareness.getLocalState() as Record<string, unknown> | null;
  awareness.setLocalState({
    ...currentState,
    selection: nodeIds,
  });
}
```

---

## React Integration Patterns

### 3.1 Custom Hook: useNodeState

**File:** `/apps/frontend-editor/src/lib/hooks/useNodeState.ts`

```typescript
import { useCollaborativeStore } from '@/lib/stores/collaborativeStore';
import { useMemo } from 'react';

export const useNodeState = (id: string) => {
  const { nodes } = useCollaborativeStore();

  return useMemo(() => {
    const currentNode = nodes.find((n) => n.id === id);
    return {
      node: currentNode,
      isBeingEdited: currentNode?.isBeingEdited || false,
      editedBy: currentNode?.editedBy || null,
    };
  }, [nodes, id]);
};
```

**Pattern:** Selector hook for performance optimization

**Used in:** TopicNode component to track which user is editing a node

### 3.2 Store Subscription Pattern

**Using subscribeWithSelector:**

```typescript
// In DiagramEditor.tsx
const {
  initializeCollaboration,
  isInitializing,
  cleanup,
  nodes: storeNodes,
  edges: storeEdges,
  title,
  onNodeChange,
  onEdgeChange,
  onConnect,
  updateCursor,
} = useCollaborativeStore();
```

**Performance Pattern:**

```typescript
// Selective subscription (if needed)
const nodes = useCollaborativeStore(state => state.nodes);
const addNode = useCollaborativeStore(state => state.addNode);
```

### 3.3 Component Examples

#### DiagramEditor.tsx (Main)

```typescript
export default function DiagramEditor({
  diagramName = 'default',
  mode = 'edit',
}: DiagramEditorProps) {
  const {
    initializeCollaboration,
    isInitializing,
    cleanup,
    nodes: storeNodes,
    edges: storeEdges,
    title,
    onNodeChange,
    onEdgeChange,
    onConnect,
    updateCursor,
  } = useCollaborativeStore();

  const { user, fetchCurrentUser, isLoading } = useUserStore();

  // Initialize collaboration on mount
  useEffect(() => {
    if (isLoading) return;

    const currentUser = user
      ? { userId: user.EntraID, userName: user.Name }
      : guestUser;

    void initializeCollaboration(diagramName, currentUser, isViewMode);
  }, [diagramName, user, guestUser, initializeCollaboration, isLoading, isViewMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return (
    <ReactFlow nodes={storeNodes} edges={storeEdges} onNodesChange={onNodeChange} onEdgesChange={onEdgeChange} onConnect={onConnect}>
      {/* UI Components */}
    </ReactFlow>
  );
}
```

#### Cursors.tsx (Remote Cursors)

```typescript
export default function Cursors() {
  const { connectedUsers, currentUser, isViewMode, nodes } =
    useCollaborativeStore();

  // Get usernames of users currently editing nodes
  const editingUsers = new Set(
    nodes
      .filter((node) => node.isBeingEdited && node.editedBy)
      .map((node) => node.editedBy)
  );

  // Filter: exclude current user, users without cursor, users editing
  const otherUsersWithCursors = isViewMode
    ? []
    : connectedUsers.filter(
        (user) =>
          user.userId !== currentUser?.userId &&
          user.cursor &&
          !editingUsers.has(user.userName)
      );

  return (
    <>
      {otherUsersWithCursors.map((user) => (
        <div
          key={user.userId}
          style={{
            position: 'absolute',
            left: user.cursor.x,
            top: user.cursor.y,
          }}
        >
          {/* Figma-style cursor SVG with user name label */}
        </div>
      ))}
    </>
  );
}
```

#### AvatarDemo.tsx (Connected Users)

```typescript
export default function AvatarDemo() {
  const { connectedUsers, currentUser } = useCollaborativeStore();

  const otherUsers = connectedUsers.filter(
    (user) => user.userId !== currentUser?.userId
  );

  const connectedAuthors = [
    ...(currentUser ? [{ userId: currentUser.userId, ... }] : []),
    ...otherUsers.map((user) => ({ userId: user.userId, ... }))
  ];

  return (
    <div className="flex -space-x-3 items-center">
      {connectedAuthors.slice(0, 4).map((author) => (
        <Avatar key={author.userId} userColor={author.color}>
          <AvatarFallback>{author.fallback}</AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}
```

#### TopicNode.tsx (Node Component)

```typescript
const TopicNode = ({ id, data, selected, type, ...nodeProps }: TopicNodeProps) => {
  const { connectedUsers, isViewMode, nodes, edges } = useCollaborativeStore();
  const { isBeingEdited, editedBy } = useNodeState(id);

  // Find the user who is editing this node
  const editingUser = connectedUsers.find((user) => user.userName === editedBy);

  // Determine handle visibility
  const isHandleValid = useHandleVisibility(id, type, nodePosition, data, edges);

  // Render with visual indicator if being edited
  const getNodeStyles = () => {
    if (isBeingEdited && !isViewMode) {
      return {
        base: 'bg-white',
        border: 'border-black border-[2.5px] rounded-[5px]',
      };
    }
    // ... other styles
  };

  return (
    <div className={`${getNodeStyles().base} ${getNodeStyles().border}`}>
      {/* Node content */}
      {editingUser && (
        <div className="text-xs text-gray-500">
          Editing: {editingUser.userName}
        </div>
      )}
    </div>
  );
};
```

#### NodeModal.tsx (Edit Node Data)

```typescript
export function NodeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);

  const { deleteNode, setNodeBeingEdited, updateNodeData, isViewMode } =
    useCollaborativeStore();

  const handleOpenModal = (event: CustomEvent<ModalData>) => {
    setModalData(event.detail);
    setNodeBeingEdited(event.detail.id, true); // Mark node as being edited
    setIsOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && modalData) {
      setNodeBeingEdited(modalData.id, false); // Clear editing state
    }
    setIsOpen(open);
  };

  const handleSave = () => {
    if (modalData) {
      updateNodeData(modalData.id, {
        label: editLabel,
        description: editDescription,
        resources: editResources,
      });
      handleOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {/* Modal content */}
      <button onClick={handleSave} disabled={isViewMode}>
        Save
      </button>
    </Dialog>
  );
}
```

---

## WebSocket & Real-time Sync

### 4.1 Backend Server Setup

**File:** `/services/backend-editor/src/server.ts`

```typescript
import express from 'express';
import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import yMongo from 'y-mongodb';

const { MongodbPersistence } = yMongo;

const app = express();
const server = createServer(app);

// Yjs WebSocket server with MongoDB persistence
const wss = new WebSocketServer({ noServer: true });

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/yjs';
const yPersistence = new MongodbPersistence(mongoUrl);

// Handle WebSocket upgrade with authentication
server.on('upgrade', (req: IncomingMessage, socket, head) => {
  void (async () => {
    try {
      // 1. Extract id_token from cookies
      const cookies = parseCookies(req.headers.cookie);
      const idToken = cookies['id_token'];

      // 2. Validate token with auth-service
      const authService = (await import('./services/authService.js')).default;
      const validationResult = await authService.validateToken(idToken);
      const user = authService.getUserFromValidation(validationResult);

      // 3. Reject if invalid
      if (!idToken || !validationResult.valid || !user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // 4. Accept upgrade
      wss.handleUpgrade(req, socket, head, (conn: WebSocket) => {
        // Extract document name from URL path
        const urlPath = req.url || '/';
        const docName = decodeURIComponent(urlPath.slice(1));

        // 5. Setup Yjs connection
        setupWSConnection(conn, req, {
          docName: docName,
          persistence: yPersistence,
          gc: true, // Enable garbage collection
        });

        // Emit connection event
        wss.emit('connection', conn, req);
      });
    } catch (error) {
      console.error('Error during WebSocket upgrade:', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  })();
});

const startServer = async () => {
  await connectDB();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
  
  await new Promise<void>((resolve, reject) => {
    server
      .listen(PORT, '0.0.0.0')
      .once('listening', () => {
        console.log(`Server running on port ${PORT}`);
        resolve();
      })
      .once('error', (err) => {
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
};

void startServer();
```

### 4.2 MongoDB Persistence

**Installed Dependencies:**
```json
{
  "y-mongodb": "^0.1.11",
  "y-websocket": "1.5.4"
}
```

**Persistence Pattern:**

```typescript
const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/yjs';
const yPersistence = new MongodbPersistence(mongoUrl);

// Used in setupWSConnection
setupWSConnection(conn, req, {
  docName: docName,
  persistence: yPersistence,
  gc: true,
});
```

**Storage Structure:**
- MongoDB database: `yjs`
- Collection per document: `docName` (e.g., `learning-path-123`)
- Stores: Updates, deletions, and document state
- Automatic garbage collection when enabled

### 4.3 WebSocket Authentication Middleware

**File:** `/services/backend-editor/src/middleware/wsAuth.ts`

```typescript
export async function authenticateWebSocket(
  conn: WebSocket,
  req: IncomingMessage,
): Promise<AuthenticatedUser | null> {
  // Extract id_token from cookies
  const cookies = parseCookies(req.headers.cookie);
  const idToken = cookies['id_token'];

  if (!idToken) {
    conn.close(4401, 'Unauthorized: No id_token provided');
    return null;
  }

  // Validate token with auth service
  const validationResult = await authService.validateToken(idToken);

  if (!validationResult.valid) {
    conn.close(4401, 'Unauthorized: Invalid or expired token');
    return null;
  }

  const user = authService.getUserFromValidation(validationResult);
  if (!user) {
    conn.close(4401, 'Unauthorized: Invalid user information');
    return null;
  }

  // Attach user to WebSocket connection
  (conn as AuthenticatedWebSocket).user = user;
  return user;
}
```

### 4.4 Authorization Flow

```
Client (Browser)
  │
  ├─ Has id_token in cookies (from auth-service)
  │
  ├─ Initiates WebSocket upgrade to /editor/ws
  │
Server (be-editor)
  │
  ├─ Receives HTTP upgrade request with cookies
  │
  ├─ Extracts id_token from cookies
  │
  ├─ Validates token with auth-service (async HTTP call)
  │
  ├─ If valid:
  │   └─ Accept WebSocket upgrade
  │   └─ Setup Yjs connection
  │
  └─ If invalid:
      └─ Close connection with 401 error
```

**Key Security Feature:** Authentication happens BEFORE WebSocket upgrade, preventing unauthorized clients from establishing connections or accessing documents.

---

## Authentication & Authorization

### 5.1 Auth Service Integration

**Auth Service (External):**
- Separate service handling OAuth with Microsoft Azure AD
- Issues `id_token` and `access_token` cookies
- Provides `/auth/validate` endpoint

**Integration Points:**

```typescript
// Frontend: Check if authenticated
const response = await fetch('/auth/validate', {
  method: 'GET',
  credentials: 'include', // Include cookies
});
const data = await response.json(); // { valid: boolean }

// Frontend: Get user info
const userResponse = await fetch('/api/user/me', {
  credentials: 'include',
});
const user = await userResponse.json();

// Backend Editor: Validate token
const authService = (await import('./services/authService.js')).default;
const validationResult = await authService.validateToken(idToken);
```

### 5.2 View Mode (Read-only Access)

**Initialization:**
```typescript
const isViewMode = true; // From route/props
void initializeCollaboration(diagramName, currentUser, isViewMode);
```

**Enforcement in Store:**
```typescript
// In all write operations
if (isViewMode) return; // Block writes

// In UI components
{isViewMode && <p>Viewing only</p>}
```

**Protected Operations:**
- `addNode()` - blocked
- `deleteNode()` - blocked
- `onNodeChange()` - blocked (except selection)
- `onEdgeChange()` - blocked
- `onConnect()` - blocked
- `updateNodeData()` - blocked

---

## Data Flow Diagrams

### 5.1 Initialization Sequence

```
Client initiates DiagramEditor
  │
  ├─ Fetch user: GET /api/user/me
  │  │
  │  └─ Fallback to guest user if not authenticated
  │
  ├─ Call initializeCollaboration(learningPathId, user, isViewMode)
  │  │
  │  ├─ Create Y.Doc()
  │  │
  │  ├─ Create WebsocketProvider(wsUrl, learningPathId, ydoc)
  │  │  │
  │  │  └─ Initiates WebSocket connection
  │  │     │
  │  │     Server receives upgrade request
  │  │     │
  │  │     ├─ Validates id_token from cookies
  │  │     │
  │  │     ├─ Calls setupWSConnection (Yjs)
  │  │     │
  │  │     └─ Returns sync state
  │  │
  │  ├─ Setup Awareness (provider.awareness)
  │  │  │
  │  │  └─ Listen for 'change' events
  │  │
  │  ├─ Wait for sync: provider.once('sync')
  │  │  │
  │  │  ├─ Assign user color from userColors map
  │  │  │
  │  │  ├─ Set local awareness state
  │  │  │
  │  │  ├─ Fetch initial data if empty:
  │  │  │  │
  │  │  │  ├─ GET /editor/diagrams/:id
  │  │  │  │
  │  │  │  └─ Batch write to Yjs with doc.transact()
  │  │  │
  │  │  └─ Subscribe to Yjs changes: yNodes.observeDeep()
  │  │
  │  └─ Mark initialization complete
  │
  └─ Render DiagramEditor with nodes/edges
```

### 5.2 Real-time Edit Flow

```
User moves node in Editor
  │
  ├─ ReactFlow fires onNodesChange([{type: 'position', ...}])
  │
  ├─ Store.onNodeChange() is called
  │  │
  │  ├─ Get yNodes from Yjs doc
  │  │
  │  ├─ Find yNode by id
  │  │
  │  └─ yNode.set('position', {x, y})
  │     │
  │     └─ Yjs syncs to other clients via WebSocket
  │
  ├─ Other clients receive update
  │  │
  │  └─ Yjs fires observeDeep event
  │     │
  │     └─ applyFromY() syncs Zustand state
  │        │
  │        └─ Zustand notifies components
  │           │
  │           └─ ReactFlow re-renders node at new position
  │
  └─ Changes persisted to MongoDB
```

### 5.3 Collaboration Flow (Multiple Users)

```
User A                                    User B
   │                                         │
   ├─ Adds "React" node                     │
   │  │                                     │
   │  └─ yNodes.set('node-123', {type: "topic"})
   │     │                                  │
   │     └─ Yjs syncs via WebSocket ──────→ │
   │                                        │
   │                                        ├─ Receives update
   │                                        │
   │                                        └─ observeDeep fires
   │                                           │
   │                                           └─ applyFromY()
   │                                              │
   │                                              └─ Node appears on B's screen
   │
   ├─ Moves "React" node right              │
   │  │                                     │
   │  └─ yNode.set('position', {x: 100})   │
   │     │                                  │
   │     └─ Sync ──────────────────────────→ │
   │                                        │
   │                                        └─ Node moves on B's screen
   │
   ├─ Edits "React" description             │
   │  │                                     │
   │  ├─ Opens NodeModal                    │
   │  │  │                                  │
   │  │  └─ setNodeBeingEdited(id, true)   │
   │  │     │                               │
   │  │     └─ Syncs via Awareness ────────→ │
   │  │                                     │
   │  │                                     ├─ Receives awareness change
   │  │                                     │
   │  │                                     └─ Shows "User A is editing"
   │  │
   │  └─ updateNodeData(id, {description: "..."})
   │     │
   │     └─ Sync via Yjs ────────────────────→ Node data updates
   │
   └─ (Other collaboration patterns similar)
```

---

## Key Implementation Patterns

### 6.1 Observer Pattern (Zustand Subscription)

```typescript
// Selective subscription using subscribeWithSelector
const myStore = create<State>()(
  subscribeWithSelector((set, get) => ({
    // Implementation
  }))
);

// Usage: Only re-renders when nodes change
const nodes = myStore((state) => state.nodes);

// Or subscribe manually
myStore.subscribe(
  (state) => state.nodes,
  (nodes) => {
    console.log('Nodes changed:', nodes);
  }
);
```

**Benefit:** Optimized performance - only components that use changed state re-render.

### 6.2 CRDT Pattern (Yjs)

```typescript
// Conflict-free: All edits are commutative and idempotent
yNode.set('type', 'topic');  // Safe to call from multiple clients
yNode.set('position', {x: 100, y: 200}); // No conflicts

// Automatic merge: Concurrent edits automatically resolved
// User A: yNode.set('color', 'red')
// User B: yNode.set('color', 'blue')
// Result: Last write wins (deterministic across all clients)
```

**Why CRDT?**
- No need for server-side conflict resolution
- Works offline (sync when reconnected)
- Deterministic: all clients converge to same state

### 6.3 Transaction Pattern (Yjs)

```typescript
// Batch multiple updates - observers fire only once
doc.transact(() => {
  diagram.nodes.forEach((node) => {
    const yNode = new Y.Map();
    yNode.set('type', node.type);
    yNode.set('position', node.position);
    yNodes.set(node.id, yNode);
  });
});
// One observeDeep event fires, not N
```

### 6.4 Awareness Pattern (User Presence)

```typescript
// Local state: cursor, selection, editing status
awareness.setLocalState({
  userId: user.userId,
  userName: user.userName,
  color: userColor,
  cursor: { x: 100, y: 200 },
  selection: ['node-1', 'node-2'],
  mode: 'edit',
});

// Listen for other users' changes
awareness.on('change', (changes) => {
  const { added, updated, removed } = changes;
  // added/updated: new users or state changes
  // removed: users who disconnected
});

// Get all users
const states = awareness.getStates();
states.forEach((state, clientID) => {
  console.log(state.userName, state.cursor);
});

// Cleanup on disconnect
awareness.setLocalState(null); // Notifies others
```

### 6.5 Selective Synchronization

**UI-only state (Zustand, no sync):**
```typescript
connectedUsers: User[]; // From awareness
isViewMode: boolean;    // From props
currentUser: User | null; // From auth
```

**Collaborative state (Yjs, synced):**
```typescript
nodes: DiagramNode[];  // From Y.Doc
edges: DiagramEdge[];  // From Y.Doc
```

**Pattern:** Separate what needs to sync from what's local-only.

---

## Known Issues & Deprecated Patterns

### 7.1 Socket.IO Removed

**Status:** DEPRECATED - Replaced with Yjs y-websocket

**File:** `/services/backend-editor/src/sockets/diagramSockets.ts`
```typescript
// Socket.IO path removed in favor of Yjs y-websocket + MongoDB persistence.
export {};
```

**Why changed:**
- Yjs is designed for CRDTs and collaboration
- Socket.IO requires custom conflict resolution logic
- y-websocket integrates with Yjs seamlessly
- MongoDB persistence replaces in-memory Socket.IO state

### 7.2 Store Index Export Issue

**Status:** QUIRK - Intentional but potentially confusing

**File:** `/apps/frontend-editor/src/lib/stores/index.ts`
```typescript
// export { useCollaborationStore } from './collaborativeStore'; // Commented out
export { useDiagramStore } from './diagramStore';
```

**Issue:** 
- `useCollaborativeStore` is not exported from `index.ts`
- Components must import directly: `import { useCollaborativeStore } from '@/lib/stores/collaborativeStore'`

**Likely reason:** Avoid circular import issues or make complexity explicit

**Recommendation:** Either export it or document why it's excluded

### 7.3 No Persistence Across Tabs

**Status:** LIMITATION

- Each tab maintains its own Y.Doc instance
- Opening same diagram in two tabs doesn't sync between tabs
- Workaround: Both tabs connect to same WebSocket server, changes sync server-side

### 7.4 Guest User Mode

**Status:** FALLBACK

- If user not authenticated, app uses guest user
- Guest edits are transient (not persisted to user account)
- Used for demo/testing purposes

**Code:**
```typescript
const [guestUser] = useState({
  userId: `guest-${Math.random().toString(36).substring(2, 9)}`,
  userName: `Guest-${Math.random().toString(36).substring(2, 4).toUpperCase()}`,
});

// Use guest if no real user
const currentUser = user ? { userId: user.EntraID, userName: user.Name } : guestUser;
```

### 7.5 View Mode Enforcement

**Status:** CLIENT-SIDE ONLY

- View mode is enforced in store actions (early return if `isViewMode`)
- Not enforced on backend (backend doesn't know about mode)
- If malicious client sends edits, backend would accept them

**Recommendation:** Add server-side authorization check:
```typescript
// Backend: Only allow writes if user has edit permission
if (!userHasEditPermission(user, docName)) {
  conn.close(4403, 'Forbidden: Read-only mode');
}
```

### 7.6 No Conflict Resolution for Concurrent Node Edits

**Status:** QUIRK

- When multiple users edit same node simultaneously, last write wins
- No merge logic for partial updates
- If User A edits label and User B edits description, B's change overwrites A's metadata

**Current behavior:**
```typescript
yNode.set('data', { label: 'New Label', description: 'Old' }); // User A
yNode.set('data', { label: 'Old', description: 'New' }); // User B
// Result: Only B's update persists (last write wins)
```

**Should be:**
```typescript
const currentData = yNode.get('data');
yNode.set('data', { ...currentData, description: 'New' }); // Merge updates
```

### 7.7 Editing Status Cleanup Timing

**Status:** POTENTIAL RACE CONDITION

- When user disconnects, editing status is cleaned up by other connected users
- If last user disconnects, editing status stays until document cleaned up

```typescript
// Cleanup runs on awareness 'change' event
if (changes.removed.length > 0 && !isViewMode) {
  const currentUserNames = new Set(
    states
      .map((state) => 'userName' in state ? state.userName : null)
      .filter(Boolean)
  );
  
  yNodes.forEach((yNode) => {
    const editedBy = yNode.get('editedBy');
    if (editedBy && !currentUserNames.has(editedBy)) {
      yNode.set('isBeingEdited', false);
      yNode.set('editedBy', null);
    }
  });
}
```

---

## Performance Considerations

### 8.1 Subscription Optimization

```typescript
// Good: Selective subscription
const nodes = useCollaborativeStore(state => state.nodes);

// Less optimal: Full store subscription (re-renders on any state change)
const state = useCollaborativeStore();
```

### 8.2 Cursor Update Throttling

```typescript
const lastCursorUpdate = useRef<number>(0);

const handleMouseMove = useCallback((e: React.MouseEvent) => {
  const now = Date.now();
  if (now - lastCursorUpdate.current > 100) { // 100ms throttle
    updateCursor({ x: e.clientX, y: e.clientY });
    lastCursorUpdate.current = now;
  }
}, [updateCursor]);
```

**Without throttle:** 60Hz * N users = 60N WebSocket messages/sec
**With 100ms throttle:** 10 messages/sec per user

### 8.3 Transaction Batching

```typescript
// Good: Single transaction, one observeDeep event
doc.transact(() => {
  diagram.nodes.forEach((node) => {
    // ... add nodes
  });
  diagram.edges.forEach((edge) => {
    // ... add edges
  });
});

// Less optimal: Multiple observeDeep events
diagram.nodes.forEach((node) => {
  // ... add node (fires observeDeep)
});
diagram.edges.forEach((edge) => {
  // ... add edge (fires observeDeep)
});
```

### 8.4 Garbage Collection

```typescript
setupWSConnection(conn, req, {
  docName: docName,
  persistence: yPersistence,
  gc: true, // Enable garbage collection
});
```

Enabled to prevent memory bloat in MongoDB from deleted nodes.

---

## Testing & Development

### 9.1 Development Paths

**Local development (nginx reverse proxy):**
```
Frontend:      http://localhost:3000 (or nginx :80)
Frontend Editor: http://localhost:3001/editor
Backend:       http://localhost:8080
Backend Editor: http://localhost:3001 (WebSocket)
Auth Service:  http://localhost:3002 (oauth)
```

**Via nginx:**
```
GET http://localhost/              → Frontend
GET http://localhost/editor        → Frontend Editor
GET http://localhost/editor/ws     → Backend Editor WebSocket
GET http://localhost/api/*         → Backend
GET http://localhost/auth/*        → Auth Service
```

### 9.2 Store Testing Pattern

```typescript
// Test isolated store behavior
it('should add node to diagram', () => {
  const store = useCollaborativeStore.getState();
  
  store.initializeCollaboration('test', { userId: '1', userName: 'Test' }, false);
  store.addNode('topic');
  
  const state = store.getState();
  expect(state.nodes).toHaveLength(1);
  expect(state.nodes[0].type).toBe('topic');
});
```

---

## Summary & Recommendations

### Current Architecture Strengths:
1. ✅ **Separation of concerns**: Zustand for local, Yjs for collaborative
2. ✅ **Real-time collaboration**: Yjs CRDT ensures consistency
3. ✅ **Persistence**: MongoDB stores all changes durably
4. ✅ **User presence**: Awareness protocol enables cursors, editing indicators
5. ✅ **View mode**: Read-only access without edit permissions

### Improvements to Consider:
1. ⚠️ **Export consistency**: Document or fix index.ts store exports
2. ⚠️ **Server-side authorization**: Enforce view mode on backend
3. ⚠️ **Concurrent edit merging**: Improve node data conflicts
4. ⚠️ **Cross-tab sync**: Consider IndexedDB + localStorage for multi-tab
5. ⚠️ **Editing status**: Reset editing indicator on disconnect

### Files to Monitor for Changes:
- `/apps/frontend-editor/src/lib/stores/collaborativeStore.ts` - Core collaboration logic
- `/services/backend-editor/src/server.ts` - WebSocket/Yjs setup
- `/apps/frontend-editor/src/components/DiagramEditor.tsx` - Store integration

