# Rosetta - Learning Path Management System

## Architecture Documentation

**Version:** 1.0
**Last Updated:** October 2025

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Components](#architecture-components)
3. [Technology Stack](#technology-stack)
4. [Data Flow and Collaboration](#data-flow-and-collaboration)
5. [Conflict Resolution](#conflict-resolution)
6. [Learning Path Lifecycle](#learning-path-lifecycle)
7. [Authentication and Security](#authentication-and-security)
8. [Database Architecture](#database-architecture)
9. [API Specifications](#api-specifications)
10. [Deployment Architecture](#deployment-architecture)

---

## 1. System Overview

Rosetta is a collaborative learning path management platform that enables users to create, edit, and share visual learning roadmaps in real-time. The system consists of four main applications working together to provide a seamless experience.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
├────────────────────────────┬────────────────────────────────────┤
│     Main Frontend (FE)     │   Collaborative Editor (fe-editor) │
│   React + Vite + Zustand   │   React + Vite + Yjs + ReactFlow   │
│   Port: 5173 (dev)         │   Port: 5173 (separate instance)   │
└──────────────┬─────────────┴────────────────┬───────────────────┘
               │                              │
               │ REST/HTTP                    │ WebSocket + REST
               │                              │
┌──────────────▼─────────────┐   ┌───────────▼────────────────────┐
│   Main Backend (BE)        │   │  Editor Backend (be-editor)    │
│   Go + Gin + GORM          │   │  Node.js + Express + Yjs       │
│   Port: 8080               │◄──┤  Port: 3001                    │
└──────────────┬─────────────┘   └───────────┬────────────────────┘
               │                              │
               │                              │
     ┌─────────▼──────────┐         ┌────────▼────────┐
     │  PostgreSQL        │         │  MongoDB        │
     │  (User, LP, Skills)│         │  (Yjs Docs)     │
     └────────────────────┘         └─────────────────┘
```

> **🎓 LEARNING NOTE - Microservices Architecture Pattern**
>
> **Why Separate Services?**
> - **Technology Fit**: Use Go for fast REST APIs, Node.js for WebSocket/Yjs ecosystem
> - **Independent Scaling**: WebSocket servers need different scaling than stateless REST
> - **Failure Isolation**: If editor crashes, main app still works
> - **Development Velocity**: Teams can work independently
>
> **Trade-offs**:
> - ✅ **Pros**: Better performance, easier scaling, technology flexibility
> - ❌ **Cons**: More complex deployment, cross-service coordination needed, distributed data
>
> **Design Pattern**: **Microservices Architecture**
>
> For thesis defense: "I chose microservices because collaborative editing (WebSocket) has different requirements than user management (REST). This allows independent scaling and technology choices optimal for each problem."

### Core Features

- **Real-time Collaborative Editing**: Multiple users can edit learning path diagrams simultaneously
- **Visual Diagram Editor**: Interactive node-based editor using ReactFlow
- **User Management**: OAuth-based authentication with Microsoft Azure AD
- **Learning Path Management**: Create, view, update, and delete learning paths
- **Skill Tagging**: Associate skills with learning paths for better discoverability

---

## 2. Architecture Components

### 2.1 Main Frontend (FE)

**Location:** `/FE`
**Purpose:** Primary user interface for browsing, creating, and managing learning paths

**Key Features:**
- User authentication and session management
- Learning path dashboard and browsing
- Creator studio for initiating new learning paths
- Integration with the collaborative editor

**Key Technologies:**
- React 19.0.0
- React Router DOM for routing
- Zustand for state management
- TailwindCSS for styling
- Radix UI for component library

> **🎓 LEARNING NOTE - Why Zustand?**
>
> **Comparison with Alternatives**:
>
> | Feature | Zustand | Redux | Context API |
> |---------|---------|-------|-------------|
> | Boilerplate | Minimal | Heavy | Medium |
> | TypeScript | Excellent | Good | Manual |
> | Provider needed? | No | Yes | Yes |
> | Bundle size | 1KB | 45KB | Built-in |
> | Learning curve | Easy | Steep | Easy |
>
> **Why We Chose Zustand**:
> - ✅ Simple API (no actions/reducers boilerplate)
> - ✅ TypeScript-first design
> - ✅ No Provider wrapping overhead
> - ✅ Selective subscriptions (better performance)
> - ✅ Easy to test
>
> **Design Pattern**: **Observer Pattern** (via subscription)
>
> See `LEARNING.md` for detailed Zustand examples

**Key Files:**
- `FE/src/App.tsx` - Main application routing
- `FE/src/store/learningPathStore.ts` - Learning path state management
- `FE/src/contexts/AuthContext.tsx` - Authentication context
- `FE/src/components/creator-studio/CreateNewPath.tsx` - Learning path creation form

### 2.2 Collaborative Editor Frontend (fe-editor)

**Location:** `/fe-editor`
**Purpose:** Real-time collaborative diagram editor for learning paths

**Key Features:**
- Real-time multi-user diagram editing
- Node and edge manipulation
- User presence indicators
- WebSocket-based synchronization
- Automatic conflict resolution

**Key Technologies:**
- React 19.1.0
- Yjs (v13.6.27) for CRDT-based collaboration
- y-websocket for real-time sync
- ReactFlow (@xyflow/react v12.7.1) for diagram rendering
- Zustand for local state management

> **🎓 LEARNING NOTE - CRDT (Conflict-free Replicated Data Type)**
>
> **What is a CRDT?** A data structure that automatically resolves conflicts in distributed systems.
>
> **Why Yjs over Operational Transformation (OT)?**
>
> | Feature | CRDT (Yjs) | OT (Google Docs-style) |
> |---------|------------|------------------------|
> | Conflict resolution | Automatic | Requires central server |
> | Offline support | Excellent | Limited |
> | Complexity | Lower | Higher |
> | Latency | Low | Medium (server round-trip) |
> | Order dependency | No | Yes (operations must be ordered) |
>
> **How Yjs Works**:
> 1. Each change gets a **Lamport timestamp** (logical clock)
> 2. Operations are **commutative** (order doesn't matter!)
> 3. **Last Write Wins (LWW)** for simple properties
> 4. **Vector clocks** track state from all clients
>
> **Real-World Example**:
> ```
> User A (offline): Moves node to x=150
> User B (offline): Moves same node to x=200
>
> When they reconnect:
> ✅ CRDT: Last timestamp wins (x=200)
> ❌ Without CRDT: Manual conflict resolution needed
> ```
>
> **Design Pattern**: **CRDT Pattern** + **Observer Pattern**
>
> For thesis defense: "I chose Yjs because CRDTs provide automatic conflict resolution without central coordination, enabling true peer-to-peer collaboration with lower latency."
>
> See Section 5 for deep dive into conflict resolution

**Key Files:**
- `fe-editor/src/components/DiagramEditor.tsx` - Main editor component
- `fe-editor/src/lib/stores/collaborativeStore.ts` - Collaboration state with Yjs integration
- `fe-editor/src/components/nodes/topicNode.tsx` - Custom node implementation

### 2.3 Main Backend (BE)

**Location:** `/BE`
**Purpose:** Primary backend service for user management, authentication, and learning path metadata

**Key Features:**
- OAuth authentication with Azure AD
- Learning path CRUD operations
- User and skill management
- Cross-service coordination (creates diagrams in MongoDB)

**Key Technologies:**
- Go 1.21+
- Gin web framework
- GORM for PostgreSQL ORM
- go-oidc for authentication
- CORS middleware

**Key Files:**
- `BE/cmd/main.go` - Application entry point
- `BE/internal/service/learningPath.go` - Business logic for learning paths
- `BE/internal/controller/learningPath.go` - HTTP handlers
- `BE/internal/model/learningPath.go` - Data models
- `BE/internal/middleware/auth.go` - Authentication middleware

### 2.4 Editor Backend (be-editor)

**Location:** `/be-editor`
**Purpose:** Backend service for collaborative diagram editing with persistence

**Key Features:**
- Real-time WebSocket server for Yjs synchronization
- MongoDB persistence for Yjs documents
- Diagram metadata storage
- RESTful API for diagram operations

**Key Technologies:**
- Node.js with TypeScript
- Express.js framework
- WebSocket (ws library)
- y-websocket utilities
- y-mongodb for persistence
- MongoDB for document storage
- Mongoose for MongoDB ORM

**Key Files:**
- `be-editor/src/server.ts` - WebSocket and HTTP server setup
- `be-editor/src/controllers/diagramController.ts` - Diagram CRUD operations
- `be-editor/src/models/diagramModel.ts` - Mongoose schemas
- `be-editor/src/templates/defaultDiagram.json` - Default diagram template

---

## 3. Technology Stack

### Frontend Technologies

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| UI Framework | React | 19.x | Component-based UI |
| Build Tool | Vite | 6.0+ | Fast development and building |
| Routing | React Router DOM | 7.x | Client-side routing |
| State Management | Zustand | 5.x | Lightweight state management |
| Styling | TailwindCSS | 4.x | Utility-first CSS |
| UI Components | Radix UI | Various | Accessible component primitives |
| Diagram Editor | ReactFlow | 12.x | Node-based diagram rendering |
| Collaboration | Yjs | 13.6+ | CRDT for real-time sync |
| WebSocket Client | y-websocket | 3.x | Yjs WebSocket provider |

### Backend Technologies

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Main Backend | Go | 1.21+ | High-performance API server |
| Web Framework | Gin | Latest | HTTP routing and middleware |
| ORM | GORM | Latest | PostgreSQL data access |
| Auth | go-oidc | Latest | OpenID Connect authentication |
| Editor Backend | Node.js | 20.x | JavaScript runtime |
| Web Framework | Express | 5.x | HTTP routing |
| WebSocket | ws | 8.x | WebSocket server |
| Yjs Server | y-websocket/utils | 1.5.x | Yjs server utilities |
| MongoDB Persistence | y-mongodb | 0.1.x | Yjs document persistence |

### Database Technologies

| Database | Purpose | Version |
|----------|---------|---------|
| PostgreSQL | User data, learning paths, skills | Latest |
| MongoDB | Yjs CRDT documents, diagram state | Latest |

---

## 4. Data Flow and Collaboration

### 4.1 Real-Time Collaboration Architecture

The collaborative editing system uses **Yjs**, a high-performance CRDT (Conflict-free Replicated Data Type) library, to enable real-time collaboration without conflicts.

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Client A   │         │   Client B   │         │   Client C   │
│  (Browser)   │         │  (Browser)   │         │  (Browser)   │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │ WebSocket              │ WebSocket              │ WebSocket
       │ ws://localhost:3001    │                        │
       │                        │                        │
       └────────────┬───────────┴────────────┬───────────┘
                    │                        │
                    ▼                        ▼
         ┌──────────────────────────────────────────┐
         │    be-editor WebSocket Server            │
         │    (y-websocket/bin/utils)               │
         │                                           │
         │  ┌────────────────────────────────────┐  │
         │  │   Yjs Document (In-Memory)         │  │
         │  │   - nodes: Y.Map<Y.Map>            │  │
         │  │   - edges: Y.Map<Y.Map>            │  │
         │  └────────────────────────────────────┘  │
         │                                           │
         │  ┌────────────────────────────────────┐  │
         │  │   MongodbPersistence               │  │
         │  │   - Syncs to MongoDB               │  │
         │  │   - Automatic updates              │  │
         │  └────────────────────────────────────┘  │
         └──────────────┬───────────────────────────┘
                        │
                        ▼
                 ┌─────────────┐
                 │   MongoDB   │
                 │  (yjsdb)    │
                 └─────────────┘
```

### 4.2 Collaboration Flow

**Step 1: Client Connection**

When a user opens a diagram in the editor:

```typescript
// fe-editor/src/lib/stores/collaborativeStore.ts

const doc = new Y.Doc();
const provider = new WebsocketProvider(
  'ws://localhost:3001',
  learningPathId,  // Room/document identifier
  doc,
);
```

**Step 2: Data Structure Setup**

The Yjs document contains two main shared types:

```typescript
const yNodes = doc.getMap<Y.Map<unknown>>('nodes');
const yEdges = doc.getMap<Y.Map<unknown>>('edges');
```

**Step 3: Initial Sync**

```typescript
provider.once('sync', async (isSynced: boolean) => {
  if (!isSynced) return;

  // Load from Yjs document
  applyFromY();

  // If empty, fetch from MongoDB and populate
  if (yNodes.size === 0) {
    const response = await fetch(
      `http://localhost:3001/api/diagrams/${learningPathId}`
    );
    const diagram = await response.json();

    // Populate Yjs document
    diagram.nodes.forEach((node) => {
      const yNode = new Y.Map<unknown>();
      yNode.set('type', node.type);
      yNode.set('position', node.position);
      yNode.set('data', node.data);
      yNodes.set(node.id, yNode);
    });
  }
});
```

**Step 4: Real-Time Updates**

When a user modifies a node:

```typescript
onNodeChange: (changes) => {
  const { ydoc } = get();
  if (!ydoc) return;

  const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');

  changes.forEach((change) => {
    if (change.type === 'position' && change.position) {
      const yNode = yNodes.get(change.id);
      if (yNode) {
        // This automatically broadcasts to all connected clients
        yNode.set('position', {
          x: change.position.x,
          y: change.position.y,
        });
      }
    }
  });
}
```

**Step 5: Observing Changes**

Clients listen for changes from other users:

```typescript
yNodes.observeDeep(() => {
  applyFromY();  // Re-render with new state
});
```

### 4.3 Data Synchronization Patterns

#### Pattern 1: Optimistic Updates
- All changes are applied locally first
- Changes are immediately visible to the user
- Synchronization happens in the background

#### Pattern 2: Broadcast to All Clients
- Server broadcasts all changes to connected clients
- Each client applies changes to their local Yjs document
- UI automatically updates via React state

#### Pattern 3: Persistence
- MongoDB persistence layer automatically saves changes
- No explicit save operation needed
- Document state persisted across sessions

### 4.4 Connection States

The system tracks connection status:

```typescript
provider.on('status', (event: { status: string }) => {
  set({ isConnected: event.status === 'connected' });
});
```

Possible states:
- **connecting**: Initial connection attempt
- **connected**: Active WebSocket connection
- **disconnected**: No connection (offline mode)

---

## 5. Conflict Resolution

### 5.1 CRDT-Based Conflict Resolution

Rosetta uses **Yjs**, which implements a CRDT (Conflict-free Replicated Data Type) algorithm. This means **conflicts are automatically resolved** without requiring user intervention or complex merge strategies.

### 5.2 How Yjs Resolves Conflicts

#### Core Principles

1. **Eventual Consistency**: All clients eventually converge to the same state
2. **Commutative Operations**: Operations can be applied in any order
3. **Idempotent**: Applying the same operation multiple times has the same effect as applying it once
4. **No Lost Updates**: All changes are preserved

#### Conflict Scenarios

**Scenario 1: Concurrent Node Position Changes**

```
Time    Client A                Client B
────────────────────────────────────────────────
t0      Node1.x = 100          Node1.x = 100
t1      Node1.x = 150          -
t2      -                      Node1.x = 200
t3      [Sync happens - Yjs resolves]
t4      Node1.x = 200          Node1.x = 200
```

**Resolution**: Last Write Wins (LWW) based on Lamport timestamps. Client B's change (200) wins because it has a higher timestamp.

**Scenario 2: Concurrent Node Creation**

```
Time    Client A                      Client B
──────────────────────────────────────────────────────
t0      -                            -
t1      Create Node "topic-abc123"   -
t2      -                            Create Node "topic-xyz789"
t3      [Sync happens]
t4      Both nodes exist             Both nodes exist
```

**Resolution**: Both operations are preserved. Each node has a unique ID, so no conflict occurs.

**Scenario 3: Concurrent Node Deletion and Modification**

```
Time    Client A                Client B
────────────────────────────────────────────────
t0      Node exists             Node exists
t1      Delete Node             -
t2      -                       Modify Node.label
t3      [Sync happens - Yjs resolves]
t4      Node is deleted         Node is deleted
```

**Resolution**: Deletion takes precedence. Once an object is deleted in a CRDT, modifications to that object are ignored.

### 5.3 Technical Implementation

#### Lamport Timestamps

Yjs assigns a logical timestamp to each operation:

```
Operation: {
  client: "user-abc",
  clock: 42,
  change: { type: 'position', x: 150, y: 200 }
}
```

Operations are ordered by:
1. Clock value (higher wins)
2. Client ID (deterministic tiebreaker)

#### Vector Clocks

Each client maintains a vector clock tracking the latest known state from all clients:

```
Client A: { A: 10, B: 5, C: 3 }
Client B: { A: 8,  B: 6, C: 3 }
```

When synchronizing, clients exchange their vector clocks to determine which operations need to be sent.

#### Y.Map for Nested Objects

Nodes and edges are stored as nested Y.Map structures:

```typescript
// Each node is a Y.Map
const yNode = new Y.Map<unknown>();
yNode.set('type', 'topic');
yNode.set('position', { x: 100, y: 200 });
yNode.set('data', { label: 'Node Title' });

// Stored in a parent Y.Map
yNodes.set('node-id-123', yNode);
```

This allows fine-grained conflict resolution at the property level:
- If Client A changes `position` and Client B changes `data.label`, both changes are preserved
- If both change `position`, LWW resolution applies

### 5.4 MongoDB as Source of Truth

While Yjs handles in-memory conflict resolution, MongoDB serves as the persistent source of truth:

```javascript
// be-editor/src/server.ts

const yPersistence = new MongodbPersistence(mongoUrl);

wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req, { persistence: yPersistence });
});
```

**Persistence Flow:**
1. Yjs document changes are automatically persisted to MongoDB
2. When a new client connects, the document is loaded from MongoDB
3. MongoDB stores the complete Yjs document state, including operation history

### 5.5 Edge Cases and Guarantees

#### Guarantee 1: No Data Loss
- All operations are logged and persisted
- Even if all clients disconnect, state is preserved in MongoDB
- When clients reconnect, they sync to the latest state

#### Guarantee 2: Network Partition Handling
- If a client loses connection, it continues working offline
- Local changes accumulate in the Yjs document
- Upon reconnection, all changes are synced and conflicts resolved automatically

#### Guarantee 3: Consistency
- All connected clients see the same final state
- Convergence typically happens within milliseconds
- No manual merge required

### 5.6 Limitations and Considerations

1. **Last Write Wins**: For simple properties (like position), the last write wins. This is usually acceptable for collaborative diagram editing.

2. **Deletion Semantics**: Deleted objects cannot be undeleted by concurrent modifications. This is by design in CRDTs.

3. **ID Generation**: Unique IDs (using nanoid) prevent accidental collisions when multiple users create nodes simultaneously.

4. **Memory**: The Yjs document stores operation history, which can grow over time. This is mitigated by:
   - MongoDB persistence
   - Periodic document compaction (can be configured)

---

## 6. Learning Path Lifecycle

### 6.1 Creation Flow

Creating a learning path involves coordinating between multiple services:

```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│   User   │         │    FE    │         │    BE    │         │be-editor │
└────┬─────┘         └────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │                    │
     │  Fill Form         │                    │                    │
     ├───────────────────►│                    │                    │
     │                    │                    │                    │
     │                    │  POST /api/        │                    │
     │                    │  learning-paths    │                    │
     │                    ├───────────────────►│                    │
     │                    │  {pathName,        │                    │
     │                    │   description,     │                    │
     │                    │   skills}          │                    │
     │                    │                    │                    │
     │                    │                    │  Generate UUID     │
     │                    │                    │  (lpID)            │
     │                    │                    │────┐               │
     │                    │                    │    │               │
     │                    │                    │◄───┘               │
     │                    │                    │                    │
     │                    │                    │  POST /api/        │
     │                    │                    │  diagrams/by-lp    │
     │                    │                    ├───────────────────►│
     │                    │                    │  {learningPathId,  │
     │                    │                    │   name}            │
     │                    │                    │                    │
     │                    │                    │                    │  Create Diagram
     │                    │                    │                    │  in MongoDB
     │                    │                    │                    │  (with template)
     │                    │                    │                    │────┐
     │                    │                    │                    │    │
     │                    │                    │                    │◄───┘
     │                    │                    │                    │
     │                    │                    │  {_id, lpId, name} │
     │                    │                    │◄───────────────────┤
     │                    │                    │                    │
     │                    │                    │  Create LP Row     │
     │                    │                    │  in PostgreSQL     │
     │                    │                    │  with DiagramID    │
     │                    │                    │────┐               │
     │                    │                    │    │               │
     │                    │                    │◄───┘               │
     │                    │                    │                    │
     │                    │                    │  Create Skills &   │
     │                    │                    │  Associations      │
     │                    │                    │────┐               │
     │                    │                    │    │               │
     │                    │                    │◄───┘               │
     │                    │                    │                    │
     │                    │  {learningPath}    │                    │
     │                    │◄───────────────────┤                    │
     │                    │                    │                    │
     │  Redirect to       │                    │                    │
     │  Editor            │                    │                    │
     │◄───────────────────┤                    │                    │
     │                    │                    │                    │
```

### 6.2 Creation Code Flow

**Step 1: Frontend Form Submission**

Location: `FE/src/components/creator-studio/CreateNewPath.tsx:40-73`

```typescript
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();

  const formData = {
    pathName: pathName,
    description: description,
    skills: skills,
  };

  const response = await fetch(`${BE_API_URL}/api/learning-paths`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });

  // Redirect to collaborative editor
  window.location.href = `${DEV_EDITOR_FE_URL}editor/${pathName}`;
};
```

**Step 2: Backend Processing**

Location: `BE/internal/service/learningPath.go:49-144`

```go
func (s *LearningPathService) CreateLearningPath(
  ctx context.Context,
  title, description string,
  isPublic bool,
  thumbnail string,
  skillNames []string,
) (*model.LearningPath, error) {

  // Generate unique UUID for learning path
  lpID := uuid.New()

  // Create diagram in MongoDB via editor backend
  body, _ := json.Marshal(map[string]string{
    "learningPathId": lpID.String(),
    "name":           title,
  })

  req, _ := http.NewRequestWithContext(
    ctx,
    http.MethodPost,
    fmt.Sprintf("%s/api/diagrams/by-lp", editorURL),
    bytes.NewReader(body),
  )

  resp, err := httpClient.Do(req)
  if err != nil {
    return nil, fmt.Errorf("create diagram request failed: %w", err)
  }

  // Parse diagram response to get MongoDB _id
  var dr diagramResponse
  json.NewDecoder(resp.Body).Decode(&dr)

  // Create learning path in PostgreSQL
  lp := &model.LearningPath{
    ID:          lpID,
    Title:       title,
    Description: description,
    IsPublic:    isPublic,
    Thumbnail:   thumbnail,
    DiagramID:   dr.ID,  // MongoDB ObjectID
  }

  if err := s.DB.WithContext(ctx).Create(lp).Error; err != nil {
    // Compensation: delete the diagram if LP creation fails
    _ = s.deleteDiagramByLP(ctx, httpClient, editorURL, lpID.String())
    return nil, fmt.Errorf("postgres insert failed: %w", err)
  }

  // Create skill associations
  for _, skillName := range skillNames {
    var skill model.Skill
    if err := s.DB.WithContext(ctx).
      Where("name = ?", skillName).
      First(&skill).Error; err != nil {
      // Create skill if it doesn't exist
      skill = model.Skill{Name: skillName}
      s.DB.WithContext(ctx).Create(&skill)
    }

    // Create association
    lpSkill := model.LPSkill{
      LPID:    lpID,
      SkillID: skill.ID,
    }
    s.DB.WithContext(ctx).Create(&lpSkill)
  }

  return lp, nil
}
```

**Step 3: Diagram Creation in MongoDB**

Location: `be-editor/src/controllers/diagramController.ts:70-106`

```typescript
export const createDiagramByLP = async (
  req: Request<object, object, { learningPathId: string; name?: string }>,
  res: Response,
) => {
  const { learningPathId, name } = req.body;
  const finalName = name && name.trim() !== '' ? name : learningPathId;

  try {
    // Load default template
    const nodes = defaultDiagramTemplate.nodes;
    const edges = defaultDiagramTemplate.edges;

    const diagram = new DiagramModel({
      learningPathId,
      name: finalName,
      nodes,
      edges,
    });

    await diagram.save();
    return res.status(201).json(diagram);

  } catch (err) {
    // If duplicate (E11000), return existing document
    if ((err as Error & { code?: number }).code === 11000) {
      const existing = await DiagramModel.findOne({ learningPathId });
      if (existing) return res.status(200).json(existing);
    }
    throw new Error(`Error: ${(err as Error).message}`);
  }
};
```

### 6.3 Retrieval and Display

**Main App - List View**

Location: `FE/src/store/learningPathStore.ts:36-56`

```typescript
fetchLearningPaths: async () => {
  set({ isLoading: true, error: null });

  const response = await fetch(`${BE_API_URL}/api/learning-paths`);
  const data = await response.json() as LearningPath[];

  set({ learningPaths: data, isLoading: false, error: null });
}
```

**Editor - Collaborative View**

Location: `fe-editor/src/lib/stores/collaborativeStore.ts:76-189`

```typescript
initializeCollaboration: async (learningPathId: string, user: User) => {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(
    'ws://localhost:3001',
    learningPathId,
    doc,
  );

  const yNodes = doc.getMap<Y.Map<unknown>>('nodes');
  const yEdges = doc.getMap<Y.Map<unknown>>('edges');

  provider.once('sync', async (isSynced: boolean) => {
    if (!isSynced) return;
    applyFromY();

    // If empty, fetch initial diagram from MongoDB
    if (yNodes.size === 0) {
      const response = await fetch(
        `http://localhost:3001/api/diagrams/${learningPathId}`
      );
      const diagram = await response.json();

      // Populate Yjs document
      diagram.nodes.forEach((node) => {
        const yNode = new Y.Map<unknown>();
        yNode.set('type', node.type);
        yNode.set('position', node.position);
        yNode.set('data', node.data);
        yNodes.set(node.id, yNode);
      });
    }
  });

  // Listen for changes
  yNodes.observeDeep(() => applyFromY());
  yEdges.observeDeep(() => applyFromY());
}
```

### 6.4 Update Flow

Updates happen automatically through Yjs synchronization. No explicit save operation is needed.

```typescript
// When user moves a node
onNodeChange: (changes) => {
  const { ydoc } = get();
  const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');

  changes.forEach((change) => {
    if (change.type === 'position' && change.position) {
      const yNode = yNodes.get(change.id);
      if (yNode) {
        // This automatically:
        // 1. Updates local state
        // 2. Broadcasts to all clients
        // 3. Persists to MongoDB
        yNode.set('position', {
          x: change.position.x,
          y: change.position.y,
        });
      }
    }
  });
}
```

### 6.5 Deletion Flow

Deletion requires careful coordination to maintain referential integrity:

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│    BE    │         │be-editor │         │ MongoDB  │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │
     │  DELETE LP         │                    │
     │  by UUID           │                    │
     │                    │                    │
     │  Find LP in        │                    │
     │  PostgreSQL        │                    │
     │────┐               │                    │
     │    │               │                    │
     │◄───┘               │                    │
     │                    │                    │
     │  DELETE /api/      │                    │
     │  diagrams/by-lp/   │                    │
     │  {lpId}            │                    │
     ├───────────────────►│                    │
     │                    │                    │
     │                    │  findOneAndDelete  │
     │                    │  {learningPathId}  │
     │                    ├───────────────────►│
     │                    │                    │
     │                    │    [Deleted]       │
     │                    │◄───────────────────┤
     │                    │                    │
     │  204 No Content    │                    │
     │◄───────────────────┤                    │
     │                    │                    │
     │  DELETE LP Row     │                    │
     │────┐               │                    │
     │    │               │                    │
     │◄───┘               │                    │
     │                    │                    │
```

Location: `BE/internal/service/learningPath.go:165-193`

```go
func (s *LearningPathService) DeleteLearningPath(
  ctx context.Context,
  lpID string,
) error {

  // Find the learning path
  var lp model.LearningPath
  if err := s.DB.WithContext(ctx).Where("id = ?", lpID).First(&lp).Error; err != nil {
    return errors.New("learning path not found")
  }

  // Delete diagram from MongoDB
  if err := s.deleteDiagramByLP(
    ctx,
    httpClient,
    editorURL,
    lp.ID.String(),
  ); err != nil {
    return fmt.Errorf("failed to delete diagram: %w", err)
  }

  // Delete from PostgreSQL (cascades to join tables)
  if err := s.DB.WithContext(ctx).Delete(&lp).Error; err != nil {
    return fmt.Errorf("failed to delete learning path: %w", err)
  }

  return nil
}
```

### 6.6 Compensation Pattern

The system uses a compensation pattern to handle failures:

```go
// If PostgreSQL insert fails, delete the MongoDB diagram
if err := s.DB.WithContext(ctx).Create(lp).Error; err != nil {
  // Compensation: clean up the diagram we just created
  _ = s.deleteDiagramByLP(ctx, httpClient, editorURL, lpID.String())
  return nil, fmt.Errorf("postgres insert failed: %w", err)
}
```

This ensures:
- No orphaned diagrams in MongoDB
- Consistent state across databases
- Transactional semantics across distributed system

> **🎓 LEARNING NOTE - Compensation Pattern (Saga Pattern)**
>
> **The Problem**: How to handle transactions across multiple databases?
>
> **Traditional Approach (doesn't work here)**:
> ```go
> BEGIN TRANSACTION
>   INSERT into PostgreSQL
>   INSERT into MongoDB  // ❌ Can't span databases!
> COMMIT
> ```
>
> **Compensation Pattern (our solution)**:
> ```go
> 1. Create diagram in MongoDB
> 2. Try to create learning path in PostgreSQL
> 3. If step 2 fails → DELETE diagram (compensate step 1)
> ```
>
> **Why This Pattern?**
> - **No distributed transactions**: Each database has local ACID guarantees
> - **Eventual consistency**: Brief window where diagram exists without LP (acceptable)
> - **Simple rollback**: Just delete what you created
> - **Idempotent**: Can retry safely
>
> **Design Pattern**: **Saga Pattern** (Compensation variant)
>
> **Trade-offs**:
> - ✅ **Pros**: Simple, works across any databases, no 2PC complexity
> - ❌ **Cons**: Brief inconsistency window, orphaned data if compensation fails
>
> **Real-World Analogy**:
> "Like booking a flight then a hotel. If hotel fails, cancel the flight."
>
> For thesis defense: "I used the compensation pattern because distributed transactions across PostgreSQL and MongoDB aren't possible. This approach provides eventual consistency with simple rollback logic."

---

## 7. Authentication and Security

### 7.1 Authentication Architecture

Rosetta uses **OpenID Connect (OIDC)** with **Microsoft Azure Active Directory** for authentication.

```
┌─────────┐       ┌─────────┐       ┌──────────────┐       ┌─────────┐
│  User   │       │   FE    │       │      BE      │       │ Azure AD│
└────┬────┘       └────┬────┘       └──────┬───────┘       └────┬────┘
     │                 │                    │                    │
     │  Access /       │                    │                    │
     ├────────────────►│                    │                    │
     │                 │                    │                    │
     │                 │  Check Auth        │                    │
     │                 ├───────────────────►│                    │
     │                 │  GET /auth/check   │                    │
     │                 │                    │                    │
     │                 │  No Cookie         │                    │
     │                 │◄───────────────────┤                    │
     │                 │  (401)             │                    │
     │                 │                    │                    │
     │  Redirect to    │                    │                    │
     │  /login         │                    │                    │
     │◄────────────────┤                    │                    │
     │                 │                    │                    │
     │                 │  GET /auth/login   │                    │
     │                 ├───────────────────►│                    │
     │                 │                    │                    │
     │                 │  Redirect to       │                    │
     │                 │  Azure AD          │                    │
     │◄────────────────┴────────────────────┤                    │
     │                 (302 Redirect)       │                    │
     │                                      │                    │
     │  Authorize                           │                    │
     │─────────────────────────────────────────────────────────►│
     │                                      │                    │
     │  Enter Credentials                   │                    │
     │─────────────────────────────────────────────────────────►│
     │                                      │                    │
     │  Consent                             │                    │
     │─────────────────────────────────────────────────────────►│
     │                                      │                    │
     │  Redirect to /callback with code     │                    │
     │◄─────────────────────────────────────────────────────────┤
     │                                      │                    │
     │                      GET /callback   │                    │
     ├─────────────────────────────────────►│                    │
     │                      ?code=xxx       │                    │
     │                                      │                    │
     │                                      │  Exchange Code     │
     │                                      │  for Tokens        │
     │                                      ├───────────────────►│
     │                                      │                    │
     │                                      │  Access Token      │
     │                                      │  ID Token          │
     │                                      │◄───────────────────┤
     │                                      │                    │
     │  Set Cookies                         │                    │
     │  Redirect to /                       │                    │
     │◄─────────────────────────────────────┤                    │
     │                                      │                    │
```

### 7.2 Authentication Flow Implementation

**Step 1: Login Handler**

Location: `BE/internal/handler/login.go:1-37`

```go
func Login(c *gin.Context) {
  clientID := os.Getenv("CLIENT_ID")
  tenantID := os.Getenv("TENANT_ID")
  rosettaDomain := os.Getenv("ROSETTA_DOMAIN")
  redirectURL := fmt.Sprintf("http://%s/callback", rosettaDomain)

  // Construct Azure AD OAuth URL
  loginURL := fmt.Sprintf(
    "https://login.microsoftonline.com/%s/oauth2/v2.0/authorize?"+
    "client_id=%s&"+
    "response_type=code&"+
    "redirect_uri=%s&"+
    "scope=api://academy-dev/GeneralAccess openid profile email offline_access",
    tenantID, clientID, redirectURL,
  )

  c.Redirect(http.StatusFound, loginURL)
}
```

**Step 2: Callback Handler**

Location: `BE/internal/handler/callback.go:1-96`

```go
func Callback(c *gin.Context) {
  code := c.Query("code")
  state := c.Query("state")

  // Exchange code for tokens
  tokenURL := fmt.Sprintf(
    "https://login.microsoftonline.com/%s/oauth2/v2.0/token",
    tenantID,
  )

  data := url.Values{
    "client_id":     {clientID},
    "client_secret": {clientSecret},
    "code":          {code},
    "redirect_uri":  {redirectURL},
    "grant_type":    {"authorization_code"},
  }

  resp, err := http.PostForm(tokenURL, data)

  var tokenResponse struct {
    AccessToken  string `json:"access_token"`
    IDToken      string `json:"id_token"`
    RefreshToken string `json:"refresh_token"`
    ExpiresIn    int    `json:"expires_in"`
  }

  json.NewDecoder(resp.Body).Decode(&tokenResponse)

  // Set cookies
  c.SetCookie(
    "access_token",
    tokenResponse.AccessToken,
    tokenResponse.ExpiresIn,
    "/",
    rosettaDomain,
    false,  // secure
    true,   // httpOnly
  )

  // Redirect to original URL or home
  redirectTo := state
  if redirectTo == "" {
    redirectTo = "/"
  }
  c.Redirect(http.StatusFound, redirectTo)
}
```

**Step 3: Authentication Middleware**

Location: `BE/internal/middleware/auth.go:32-88`

```go
func Auth() gin.HandlerFunc {
  clientID := os.Getenv("CLIENT_ID")
  tenantID := os.Getenv("TENANT_ID")

  ctx := context.Background()
  provider, _ := oidc.NewProvider(
    ctx,
    "https://login.microsoftonline.com/"+tenantID+"/v2.0",
  )

  verifier := provider.Verifier(&oidc.Config{ClientID: clientID})

  return func(c *gin.Context) {
    // Try to get token from Authorization header
    authHeader := c.GetHeader("Authorization")

    if authHeader == "" {
      // Try to get from cookie
      accessToken, err := c.Cookie("access_token")
      if err != nil {
        redirectToLogin(c, c.Request.URL.String())
        return
      }
      authHeader = "Bearer " + accessToken
    }

    // Extract token
    token := authHeader[7:] // Remove "Bearer "

    // Verify token with Azure AD
    idToken, err := verifier.Verify(ctx, token)
    if err != nil {
      redirectToLogin(c, c.Request.URL.String())
      return
    }

    // Extract claims
    claims := map[string]interface{}{}
    idToken.Claims(&claims)

    // Store claims in context
    c.Set("claims", claims)

    c.Next()
  }
}
```

**Step 4: Frontend Authentication Context**

Location: `FE/src/contexts/AuthContext.tsx:24-47`

```typescript
useEffect(() => {
  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/check', {
        method: 'GET',
        credentials: 'include',  // Include cookies
      });

      const data = await response.json() as { authenticated: boolean };
      setIsAuthenticated(data.authenticated);

    } catch (err) {
      console.error('Error checking authentication:', err);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  void checkAuth();
}, []);
```

**Step 5: Protected Routes**

Location: `FE/src/App.tsx:24-38`

```typescript
<Route
  path="/welcome"
  element={
    <RequireAuth>
      <WelcomePage />
    </RequireAuth>
  }
/>
```

Location: `FE/src/wrappers/RequireAuth.tsx`

```typescript
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

### 7.3 Security Considerations

#### Token Storage
- **Access Token**: Stored in HTTP-only cookies (XSS protection)
- **Refresh Token**: Also in HTTP-only cookies
- Tokens are never exposed to JavaScript

#### CORS Configuration

**Main Backend:**

Location: `BE/cmd/main.go:30-36`

```go
r.Use(cors.New(cors.Config{
  AllowOrigins:     []string{os.Getenv("ROSETTA_FE")},
  AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
  AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept"},
  AllowCredentials: true,  // Allow cookies
}))
```

**Editor Backend:**

Location: `be-editor/src/config/corsConfig.ts`

```typescript
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://127.0.0.1:5173',
  ],
  credentials: true,
};

export default cors(corsOptions);
```

#### Session Management

- Access tokens expire based on Azure AD configuration
- Refresh tokens allow seamless re-authentication
- Middleware automatically validates tokens on each request

### 7.4 Security Best Practices

1. **Environment Variables**: Sensitive credentials stored in `.env` files
2. **HTTPS in Production**: All communications encrypted (currently HTTP in dev)
3. **OIDC Standard**: Industry-standard authentication protocol
4. **Stateless Authentication**: JWT tokens enable horizontal scaling
5. **Claims-based Authorization**: User roles and permissions in JWT claims

---

## 8. Database Architecture

### 8.1 PostgreSQL Schema

**Purpose**: Store user data, learning paths, skills, and relationships

**Tables:**

#### users
```sql
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(100) UNIQUE NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  deleted_at  TIMESTAMP NULL
);
```

#### skills
```sql
CREATE TABLE skills (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  deleted_at  TIMESTAMP NULL
);
```

#### learning_paths
```sql
CREATE TABLE learning_paths (
  id          UUID PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  is_public   BOOLEAN NOT NULL,
  thumbnail   TEXT,
  diagram_id  VARCHAR(24) NOT NULL UNIQUE,  -- MongoDB ObjectID
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  deleted_at  TIMESTAMP NULL
);

CREATE UNIQUE INDEX idx_unique_diagram_id ON learning_paths(diagram_id);
```

#### user_skills (Join Table)
```sql
CREATE TABLE user_skills (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  skill_id    INTEGER NOT NULL REFERENCES skills(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  deleted_at  TIMESTAMP NULL,
  UNIQUE(user_id, skill_id)
);
```

#### roles
```sql
CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  deleted_at  TIMESTAMP NULL
);
```

#### user_lps (Join Table)
```sql
CREATE TABLE user_lps (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  lp_id       UUID NOT NULL REFERENCES learning_paths(id),
  role_id     INTEGER NOT NULL REFERENCES roles(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  deleted_at  TIMESTAMP NULL,
  UNIQUE(user_id, lp_id)
);
```

#### lp_skills (Join Table)
```sql
CREATE TABLE lp_skills (
  id          SERIAL PRIMARY KEY,
  lp_id       UUID NOT NULL REFERENCES learning_paths(id),
  skill_id    INTEGER NOT NULL REFERENCES skills(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  deleted_at  TIMESTAMP NULL,
  UNIQUE(lp_id, skill_id)
);
```

**Entity Relationships:**

```
┌─────────┐         ┌──────────────┐         ┌─────────────────┐
│  users  │◄───────►│ user_skills  │◄───────►│     skills      │
└─────────┘         └──────────────┘         └─────────────────┘
     ▲                                                ▲
     │                                                │
     │                                                │
     │              ┌──────────────┐         ┌───────┴────────┐
     └─────────────►│   user_lps   │         │   lp_skills    │
                    └──────┬───────┘         └───────┬────────┘
                           │                         │
                           │                         │
                           ▼                         ▼
                    ┌──────────────────────────────────┐
                    │      learning_paths              │
                    │  - diagram_id (FK to MongoDB)    │
                    └──────────────────────────────────┘
```

### 8.2 MongoDB Schema

**Purpose**: Store Yjs documents and diagram metadata

**Collections:**

#### diagrams (Metadata)
```javascript
{
  _id: ObjectId("..."),
  learningPathId: "uuid-string",  // Links to PostgreSQL
  name: "Learning Path Name",
  nodes: [
    {
      id: "topic-abc123",
      type: "topic",
      position: { x: 100, y: 200 },
      data: {
        label: "Topic Title",
        description: "...",
        resources: [...]
      },
      measured: { width: 150, height: 100 }
    }
  ],
  edges: [
    {
      id: "e-topic1-topic2",
      source: "topic-abc123",
      target: "topic-xyz789",
      sourceHandle: null,
      targetHandle: null
    }
  ],
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

**Indexes:**
```javascript
db.diagrams.createIndex({ learningPathId: 1 }, { unique: true });
db.diagrams.createIndex({ name: 1 }, { unique: true });
```

#### y-mongodb Collections (Yjs Persistence)

Yjs automatically creates collections to store document state:

**y-mongodb-documents**
```javascript
{
  _id: "learning-path-id",
  clock: 42,
  value: Binary(...),  // Encoded Yjs document state
}
```

**y-mongodb-transactions**
```javascript
{
  docId: "learning-path-id",
  clock: 42,
  transaction: Binary(...),  // Encoded Yjs update
}
```

### 8.3 Cross-Database Relationships

The `learning_paths.diagram_id` field creates a logical foreign key to MongoDB:

```
PostgreSQL                          MongoDB
┌───────────────────────┐          ┌──────────────────────┐
│   learning_paths      │          │     diagrams         │
├───────────────────────┤          ├──────────────────────┤
│ id: UUID              │          │ _id: ObjectId        │
│ title: "Learn React"  │          │ learningPathId: UUID │◄─┐
│ diagram_id: "507f..."─┼──────────┤ name: "Learn React"  │  │
│ ...                   │          │ nodes: [...]         │  │
└───────────────────────┘          │ edges: [...]         │  │
                                   └──────────────────────┘  │
                                                             │
                                   Linked by UUID ───────────┘
```

**Lookup Operations:**

```go
// Get diagram for a learning path
diagramID := learningPath.DiagramID
diagram := fetchFromMongoDB(diagramID)
```

```typescript
// Get diagram by learning path ID
const diagram = await DiagramModel.findOne({
  learningPathId: lpId
});
```

### 8.4 Data Consistency

**Eventual Consistency:**
- PostgreSQL and MongoDB are eventually consistent
- Yjs ensures real-time consistency within MongoDB
- Compensation patterns handle cross-database failures

**Transactional Boundaries:**
- Each database has its own transactions
- Cross-database operations use compensation (sagas)
- Idempotent operations allow retries

---

## 9. API Specifications

### 9.1 Main Backend API (Go)

**Base URL:** `http://localhost:8080`

#### Authentication Endpoints

##### GET /auth/login
Initiates OAuth flow with Azure AD

**Response:** 302 Redirect to Azure AD

---

##### GET /callback
OAuth callback endpoint

**Query Parameters:**
- `code`: Authorization code from Azure AD
- `state`: Original URL for redirect after auth

**Response:** 302 Redirect to original URL with cookies set

---

##### GET /auth/check
Check authentication status

**Response:**
```json
{
  "authenticated": true
}
```

---

##### GET /auth/logout
Logout user and clear cookies

**Response:** 302 Redirect to login page

---

#### Learning Path Endpoints

##### GET /api/learning-paths
Get all learning paths

**Response:**
```json
[
  {
    "ID": "uuid",
    "Title": "Learn React",
    "Description": "Master React fundamentals",
    "IsPublic": true,
    "Thumbnail": "https://...",
    "DiagramID": "507f1f77bcf86cd799439011",
    "Skills": [
      { "ID": 1, "Name": "React" },
      { "ID": 2, "Name": "JavaScript" }
    ],
    "CreatedAt": "2025-01-15T10:30:00Z",
    "UpdatedAt": "2025-01-15T10:30:00Z"
  }
]
```

---

##### POST /api/learning-paths
Create a new learning path

**Request:**
```json
{
  "pathName": "Learn React",
  "description": "Master React fundamentals",
  "skills": ["React", "JavaScript", "TypeScript"]
}
```

**Response:** 201 Created
```json
{
  "ID": "uuid",
  "Title": "Learn React",
  "Description": "Master React fundamentals",
  "IsPublic": true,
  "Thumbnail": "",
  "DiagramID": "507f1f77bcf86cd799439011",
  "Skills": [...],
  "CreatedAt": "2025-01-15T10:30:00Z",
  "UpdatedAt": "2025-01-15T10:30:00Z"
}
```

---

##### DELETE /api/learning-paths/:id
Delete a learning path

**Response:** 204 No Content

---

### 9.2 Editor Backend API (Node.js)

**Base URL:** `http://localhost:3001`

#### Diagram Endpoints

##### GET /api/diagrams
Get all diagrams (metadata only)

**Response:**
```json
[
  {
    "name": "Learn React",
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T10:30:00Z"
  }
]
```

---

##### GET /api/diagrams/:name
Get diagram by name

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "learningPathId": "uuid",
  "name": "Learn React",
  "nodes": [
    {
      "id": "topic-abc123",
      "type": "topic",
      "position": { "x": 100, "y": 200 },
      "data": {
        "label": "Start Here",
        "type": "start"
      }
    }
  ],
  "edges": [],
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

---

##### POST /api/diagrams/by-lp
Create diagram by learning path ID (idempotent)

**Request:**
```json
{
  "learningPathId": "uuid",
  "name": "Learn React"
}
```

**Response:** 201 Created or 200 OK (if exists)
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "learningPathId": "uuid",
  "name": "Learn React",
  "nodes": [...],
  "edges": [],
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

---

##### DELETE /api/diagrams/by-lp/:lpId
Delete diagram by learning path ID

**Response:** 204 No Content

---

##### DELETE /api/diagrams/:name
Delete diagram by name

**Response:** 204 No Content or 409 Conflict (if associated with LP)

---

#### WebSocket Endpoint

##### WS ws://localhost:3001
Yjs WebSocket connection

**Protocol:** y-websocket protocol

**Usage:**
```typescript
const provider = new WebsocketProvider(
  'ws://localhost:3001',
  'document-name',
  ydoc
);
```

**Events:**
- `sync`: Initial synchronization complete
- `status`: Connection status change

---

## 10. Deployment Architecture

### 10.1 Development Environment

**Docker Compose Setup:**

#### Editor Backend + MongoDB

Location: `be-editor/docker-compose.yml`

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/carbyte-editor
      - CORS_ORIGINS=http://localhost:5173
    depends_on:
      mongodb:
        condition: service_healthy
    networks:
      - carbyte-network
    restart: unless-stopped

  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    networks:
      - carbyte-network
    restart: unless-stopped
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 10s
      retries: 5

networks:
  carbyte-network:
    driver: bridge

volumes:
  mongodb_data:
    driver: local
```

#### Main Backend + PostgreSQL

Location: `BE/docker-compose.yaml`

```yaml
services:
  backend:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/rosetta
      - EDITOR_BASE_URL=http://be-editor:3001
    depends_on:
      - postgres
    networks:
      - rosetta-network

  postgres:
    image: postgres:latest
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=rosetta
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - rosetta-network

networks:
  rosetta-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
```

### 10.2 Service Dependencies

```
┌─────────────────────────────────────────────────────────┐
│                    Development Setup                    │
└─────────────────────────────────────────────────────────┘

FE (localhost:5173)
  │
  ├──► BE (localhost:8080)
  │     │
  │     └──► PostgreSQL (localhost:5432)
  │
  └──► fe-editor (localhost:5173)
        │
        └──► be-editor (localhost:3001)
              │
              └──► MongoDB (localhost:27017)
```

### 10.3 Environment Configuration

**Main Backend (.env):**
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/rosetta

# Azure AD OAuth
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
TENANT_ID=your-tenant-id

# CORS
ROSETTA_FE=http://localhost:5173
ROSETTA_DOMAIN=localhost:8080

# Editor Service
EDITOR_BASE_URL=http://localhost:3001
```

**Editor Backend (.env):**
```bash
# Server
PORT=3001

# Database
MONGODB_URI=mongodb://localhost:27017/carbyte-editor
MONGO_URL=mongodb://localhost:27017/yjs

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:8080
```

**Main Frontend (.env):**
```bash
VITE_BE_API_URL=http://localhost:8080
VITE_DEV_EDITOR_FE_URL=http://localhost:5173/
```

### 10.4 Production Considerations

**Scaling Strategies:**

1. **Horizontal Scaling:**
   - Main backend (Go): Stateless, can scale horizontally
   - Editor backend: Requires sticky sessions for WebSocket
   - Use Redis for shared session state

2. **Database Scaling:**
   - PostgreSQL: Read replicas for reporting
   - MongoDB: Sharding for large documents

3. **WebSocket Load Balancing:**
   - Use Nginx or HAProxy with IP hash for sticky sessions
   - Consider clustering Yjs servers with y-redis

**Security Enhancements:**

1. Enable HTTPS for all services
2. Use secure cookies with `Secure` and `SameSite` flags
3. Implement rate limiting
4. Use secrets management (AWS Secrets Manager, Azure Key Vault)
5. Enable database encryption at rest

**Monitoring:**

1. Application logs (structured logging)
2. Database query performance
3. WebSocket connection metrics
4. API response times
5. Error tracking (Sentry, Rollbar)

---

## Conclusion

Rosetta is a sophisticated collaborative learning path management system built on modern web technologies. The architecture balances real-time collaboration, data consistency, and scalability through:

- **Separation of Concerns**: Distinct services for user management and collaborative editing
- **CRDT-Based Synchronization**: Automatic conflict resolution with Yjs
- **Cross-Database Coordination**: Careful orchestration between PostgreSQL and MongoDB
- **OAuth Security**: Industry-standard authentication with Azure AD
- **Microservices Architecture**: Independent scaling and deployment

This documentation provides a comprehensive reference for developers working on Rosetta, covering architecture, data flow, collaboration mechanisms, and deployment strategies.

---

**Document End**
