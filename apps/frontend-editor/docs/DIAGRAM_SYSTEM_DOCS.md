# FE-Editor - Diagram Editor Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Flow](#data-flow)
4. [Component Hierarchy](#component-hierarchy)
5. [New Diagram Creation Flow](#new-diagram-creation-flow)
6. [Existing Diagram Loading Flow](#existing-diagram-loading-flow)
7. [Node Management System](#node-management-system)
8. [Store Management](#store-management)
9. [WebSocket Integration](#websocket-integration)
10. [Quick Start Guide](#quick-start-guide)

## Overview

The FE-Editor is a collaborative diagram editor built with React, ReactFlow, and Zustand. It allows multiple users to create and edit flowcharts in real-time with live collaboration features.

### Key Technologies:
- **Frontend**: React + TypeScript + Vite
- **State Management**: Zustand
- **Diagram Engine**: ReactFlow
- **Real-time Collaboration**: Socket.IO
- **Styling**: Tailwind CSS + Shadcn/ui

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │  Backend API    │    │   WebSocket     │
│                 │    │                 │    │   Server        │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │DiagramEditor│ │◄──►│ │/api/diagrams│ │    │ │Socket.IO    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │                 │
│ │CollabStore  │ │◄──►│ │   Database  │ │◄──►│                 │
│ └─────────────┘ │    │ └─────────────┘ │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Data Flow

### 1. Application Initialization
```
User opens diagram → DiagramEditor mounts → useEffect triggers → 
CollaborativeStore.initializeCollaboration() → 
Fetch existing data OR load template → 
Initialize WebSocket → 
Render ReactFlow
```

### 2. User Interactions
```
User clicks "Add Topic" → addNode() in store → 
Updates local state → 
Broadcasts via WebSocket → 
Other users receive update → 
UI re-renders
```

## Component Hierarchy

```
App
└── DiagramEditor
    ├── ReactFlow
    │   ├── TopicNode (unified component)
    │   ├── Background
    │   ├── Controls
    │   └── Panels
    │       ├── Status Panel
    │       └── Toolbar Panel
    └── LoadingOverlay
```

## New Diagram Creation Flow

### Step 1: Diagram Initialization
**Location**: `DiagramEditor.tsx` → `useEffect`
```typescript
useEffect(() => {
  const initializeCollaborativeStore = async () => {
    await initializeCollaboration(diagramName, currentUser);
  };
  void initializeCollaborativeStore();
}, [diagramName, currentUser]);
```

### Step 2: Store Initialization
**Location**: `collaborativeStore.ts` → `initializeCollaboration`
```typescript
// 1. Set loading state
set({ isInitializing: true, diagramName, currentUser: user });

// 2. Try to fetch existing diagram
const response = await fetch(`http://localhost:3001/api/diagrams/${diagramName}`);

// 3a. If diagram doesn't exist or is empty, load template
if (diagram.nodes.length === 0) {
  set({
    nodes: TemplateData.nodes,  // From newDiagram.json
    edges: TemplateData.edges,
    title: diagramName,
  });
}

// 4. Initialize WebSocket connection
const newSocket = io('http://localhost:3001', {
  query: { userId, userName, diagramName }
});
```

### Step 3: Template Loading
**Location**: `src/lib/templates/newDiagram.json`
```json
{
  "nodes": [
    {
      "id": "start-template",
      "type": "start",
      "position": { "x": 0, "y": 200 },
      "data": { "label": "Start Here", "type": "start" }
    }
  ],
  "edges": []
}
```

### Step 4: Render Components
**Location**: `DiagramEditor.tsx`
```typescript
<ReactFlow
  nodes={storeNodes}        // From collaborative store
  edges={storeEdges}        // From collaborative store  
  nodeTypes={nodeTypes}     // Component mapping
  onNodesChange={onNodeChange}
  onEdgesChange={onEdgeChange}
  onConnect={onConnect}
/>
```

## Existing Diagram Loading Flow

### Step 1: API Request
**Location**: `collaborativeStore.ts` → `initializeCollaboration`
```typescript
const response = await fetch(`http://localhost:3001/api/diagrams/${diagramName}`);
const diagram = await response.json() as FullDiagram;
```

### Step 2: Data Population
```typescript
// If diagram has existing data
if (diagram.nodes.length > 0) {
  set({
    nodes: diagram.nodes,    // Existing nodes from database
    edges: diagram.edges,    // Existing edges from database
    title: diagramName,
  });
}
```

### Step 3: WebSocket Synchronization
```typescript
// Connect to real-time collaboration
newSocket.on('nodes-updated', (updatedNodes) => {
  set({ nodes: updatedNodes });
});

newSocket.on('edges-updated', (updatedEdges) => {
  set({ edges: updatedEdges });
});
```

## Node Management System

### Current Node Types
1. **Topic Nodes** (`type: "topic"`): Main category nodes (black background)
2. **Subtopic Nodes** (`type: "subtopic"`): Sub-category nodes (colored background)

### Node Data Structure
```typescript
interface DiagramNode {
  id: string;              // Unique identifier
  type: 'topic' | 'subtopic'; // ReactFlow component type
  position: { x: number; y: number };
  data: {
    label: string;         // Display text
    level?: number;        // Hierarchy level (0 for topics, 1 for subtopics)
    parentId?: string;     // Parent node ID for subtopics
  };
}
```

### Adding New Nodes
**Location**: `DiagramEditor.tsx` → Toolbar Panel
```typescript
<Button onClick={() => addNode('Topic')}>
  <Circle className="w-4 h-4" />
  Topic
</Button>

<Button onClick={() => addNode('Sub Topic')}>
  <Diamond className="w-4 h-4" />
  Sub Topic
</Button>
```

**Location**: `collaborativeStore.ts` → `addNode`
```typescript
addNode: (type, position) => {
  const newNode: DiagramNode = {
    id: `${type}-${Date.now()}`,
    type: type === 'Start' ? 'start' : 'custom',
    position: position || autoCalculatedPosition,
    data: {
      label: type,
      type: type.toLowerCase(),
    },
  };
  
  set((state) => ({
    nodes: [...state.nodes, newNode],
  }));
}
```

### Node Component Mapping
**Location**: `DiagramEditor.tsx`
```typescript
const nodeTypes: NodeTypes = {
  custom: CustomNode,      // Legacy - to be replaced
  start: StartNode,        // Legacy - to be replaced  
  topic: TopicNode,        // New unified component
};
```

## Store Management

### Collaborative Store Structure
**Location**: `src/lib/stores/collaborativeStore.ts`

```typescript
interface CollaborativeState {
  // ReactFlow State
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  title: string;

  // Connection State  
  socket: Socket | null;
  isConnected: boolean;

  // Collaboration State
  connectedUsers: User[];
  currentUser: User | null;
  diagramName: string;

  // Loading States
  isInitializing: boolean;

  // Actions
  initializeCollaboration: (diagramName: string, user: User) => Promise<void>;
  cleanup: () => void;
  addNode: (type: string, position?: Position) => void;
  onNodeChange: (changes: NodeChange[]) => void;
  onEdgeChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
}
```

### Key Store Methods

#### `initializeCollaboration()`
- Fetches existing diagram data or loads template
- Establishes WebSocket connection
- Sets up real-time event listeners

#### `addNode()`
- Creates new node with auto-calculated position
- Updates local state
- Broadcasts change to other users

#### `onNodeChange()` / `onEdgeChange()`
- Handles ReactFlow changes (drag, delete, etc.)
- Applies changes to local state
- Broadcasts to other users

#### `cleanup()`
- Disconnects WebSocket
- Resets store state
- Called on component unmount

## WebSocket Integration

### Connection Setup
```typescript
const newSocket = io('http://localhost:3001', {
  query: {
    userId: user.userId,
    userName: user.userName, 
    diagramName: diagramName,
  },
  reconnection: true,
  reconnectionAttempts: 5,
});
```

### Event Listeners
```typescript
// Incoming updates from other users
newSocket.on('nodes-updated', (updatedNodes) => {
  set({ nodes: updatedNodes });
});

newSocket.on('edges-updated', (updatedEdges) => {
  set({ edges: updatedEdges });
});

// User connection events
newSocket.on('user-joined', (users) => {
  set({ connectedUsers: users });
});
```

### Broadcasting Changes
```typescript
// When local user makes changes
if (socket && isConnected) {
  socket.emit('nodes-updated', updatedNodes, diagramName);
  socket.emit('edges-updated', updatedEdges, diagramName);
}
```

## Quick Start Guide

### For New Team Members

1. **Understanding the Flow**:
   - Start with `DiagramEditor.tsx` - main component
   - Follow the `useEffect` to `collaborativeStore.ts` 
   - Understand how templates are loaded from `src/lib/templates/`

2. **Key Files to Know**:
   - `src/components/DiagramEditor.tsx` - Main editor component
   - `src/lib/stores/collaborativeStore.ts` - State management & WebSocket
   - `src/components/nodes/TopicNode.tsx` - Node component (being unified)
   - `src/lib/templates/newDiagram.json` - Default template
   - `src/types/diagram.ts` & `src/types/reactflow.ts` - Type definitions

3. **Making Changes**:
   - **Add new node type**: Update `nodeTypes` in DiagramEditor, create component
   - **Modify template**: Edit `newDiagram.json` 
   - **Change collaboration**: Modify WebSocket events in `collaborativeStore.ts`
   - **Update UI**: Modify toolbar in `DiagramEditor.tsx`

### Development Workflow

1. **Start Backend**: Ensure backend API server is running on `localhost:3001`
2. **Start Frontend**: `npm run dev` 
3. **Test Collaboration**: Open multiple browser tabs to test real-time features
4. **Debug**: Check browser console for store logs (`[CollaborativeStore]` prefix)

### Common Debugging

- **Diagram not loading**: Check network tab for API calls to `/api/diagrams/`
- **Real-time not working**: Check WebSocket connection in browser dev tools
- **Nodes not appearing**: Verify `nodeTypes` mapping in `DiagramEditor.tsx`
- **Store issues**: Look for `[CollaborativeStore]` logs in console

---

*Last updated: 2025-09-22*
*This documentation should be updated whenever the diagram creation or loading logic changes.*