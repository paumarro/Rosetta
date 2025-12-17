# Understanding Collaborative Technologies: Redis, WebSockets, Yjs, and CRDTs

## Table of Contents
1. [Introduction](#introduction)
2. [The Problem: Real-Time Collaboration](#the-problem-real-time-collaboration)
3. [WebSockets: Real-Time Communication](#websockets-real-time-communication)
4. [CRDTs: Conflict-Free Data Types](#crdts-conflict-free-data-types)
5. [Yjs: A Practical CRDT Library](#yjs-a-practical-crdt-library)
6. [Redis: Distributed Coordination](#redis-distributed-coordination)
7. [How Everything Works Together](#how-everything-works-together)
8. [Key Concepts Summary](#key-concepts-summary)

---

## Introduction

This guide explains the core technologies that power real-time collaborative editing systems like Google Docs, Figma, or in your case, Rosetta's diagram editor. These technologies solve one of the hardest problems in distributed systems: **allowing multiple users to edit the same document simultaneously without conflicts or data loss**.

---

## The Problem: Real-Time Collaboration

### What Makes This Hard?

Imagine two people editing the same sentence simultaneously:

```
Initial: "The cat is sleeping"

User A: Changes to "The big cat is sleeping"
User B: Changes to "The cat is sleeping peacefully"

Final: ???
```

Without a smart system, you might end up with:
- Data loss (one user's changes disappear)
- Conflicts requiring manual resolution
- Unpredictable results

Traditional approaches like **locking** (only one person can edit at a time) don't work well for modern collaborative apps because they create poor user experience.

### The Solution Stack

To solve this, we need four key technologies:

1. **WebSockets** - For instant bidirectional communication
2. **CRDTs** - For automatic conflict resolution
3. **Yjs** - A practical CRDT implementation
4. **Redis** - For coordinating multiple server instances

Let's explore each one.

---

## WebSockets: Real-Time Communication

### What Are WebSockets?

**WebSocket** is a protocol that creates a persistent, bidirectional connection between a client (browser) and server. Unlike traditional HTTP where the client must request data, WebSockets allow the server to push data to clients instantly.

### HTTP vs WebSocket

**Traditional HTTP:**
```
Client: "Hey server, any updates?" [Request]
Server: "Nope, nothing new" [Response]
--- wait ---
Client: "How about now?" [Request]
Server: "Still nothing" [Response]
--- wait ---
Client: "Anything yet?" [Request]
Server: "Yes! Here's an update" [Response]
```

This is called **polling** and it's inefficient.

**WebSocket:**
```
Client: "Hey server, open a connection" [Handshake]
Server: "Connected!" [Handshake]
--- connection stays open ---
Server: "Update available!" [Push data instantly]
Client: "Got it!"
--- still open ---
Client: "I have a change" [Send data]
Server: "Received and broadcasting to others"
```

### WebSocket Lifecycle

```
1. HTTP Upgrade Request
   Client: "Upgrade: websocket"
   Server: "101 Switching Protocols"

2. Connection Established
   - Persistent TCP connection opens
   - Both sides can send messages anytime

3. Message Exchange
   Client ←→ Server (bidirectional)
   - JSON, binary, or text messages
   - No request/response pattern

4. Connection Closed
   Either side can close gracefully
```

### Key Benefits for Collaboration

1. **Low Latency**: Changes appear in milliseconds, not seconds
2. **Real-Time Push**: Server sends updates without client polling
3. **Bidirectional**: Both client and server can initiate communication
4. **Efficient**: One persistent connection instead of many HTTP requests

### Example Use in Collaboration

```javascript
// Client connects to WebSocket server
const ws = new WebSocket('ws://localhost:3001/document-123');

// Send changes to server
ws.send(JSON.stringify({
  type: 'edit',
  nodeId: 'node-1',
  position: { x: 150, y: 200 }
}));

// Receive changes from other users
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  applyUpdateToUI(update);
};
```

**Problem Solved**: Users now communicate in real-time.

**Problem Remaining**: What happens when two users edit the same node simultaneously?

This is where CRDTs come in.

---

## CRDTs: Conflict-Free Data Types

### What Are CRDTs?

**CRDT** stands for **Conflict-free Replicated Data Type**. It's a special data structure that can be modified independently by multiple users and will always converge to the same final state, without requiring a central authority to resolve conflicts.

### The Magic Properties

CRDTs have three crucial properties:

#### 1. Commutative (Order Doesn't Matter)

Mathematical example:
```
5 + 3 + 7 = 15
3 + 7 + 5 = 15
7 + 5 + 3 = 15
```

Addition is commutative - order doesn't affect the result.

CRDT example:
```
Operations arrive in different order at different clients

Client A receives: [Set color blue, Set size large]
Client B receives: [Set size large, Set color blue]

Both end with: color=blue, size=large ✓
```

#### 2. Associative (Grouping Doesn't Matter)

Mathematical example:
```
(5 + 3) + 7 = 15
5 + (3 + 7) = 15
```

CRDT example:
```
Client A processes operations in batches:
Batch 1: [Op1, Op2] then Batch 2: [Op3]

Client B processes differently:
Op1, then [Op2, Op3]

Both converge to same state ✓
```

#### 3. Idempotent (Applying Twice = Applying Once)

```
If you receive the same operation twice,
applying it again has no additional effect.

Operation: "Set node X position to (100, 200)"
Apply once: position becomes (100, 200)
Apply again: position stays (100, 200) ✓
```

### Why These Properties Matter

With these three properties, CRDTs guarantee:
- **Eventual Consistency**: All replicas eventually converge to same state
- **No Coordination Needed**: No central server to resolve conflicts
- **Offline-First**: Users can work offline and sync later
- **No Lost Updates**: All changes are preserved

### CRDT Conflict Resolution Strategy

CRDTs resolve conflicts using **deterministic rules** that all clients agree on.

#### Last-Write-Wins (LWW)

The most common strategy uses **Lamport timestamps**:

```
Operation = {
  value: "new data",
  timestamp: logical_clock,
  clientId: unique_id
}
```

**Conflict Resolution Rule**:
1. Higher timestamp wins
2. If timestamps equal, higher clientId wins (deterministic tiebreaker)

**Example:**

```
Initial state: node.x = 0

Client A (timestamp 10): node.x = 100
Client B (timestamp 12): node.x = 200

Both clients receive both operations:
  - Apply operation with timestamp 10: x = 100
  - Apply operation with timestamp 12: x = 200

Final state: node.x = 200 ✓
```

Both clients independently arrive at the same conclusion: timestamp 12 wins.

#### Add-Wins Strategy

For sets and arrays, CRDTs use an "add-wins" strategy:

```
Client A: Adds item "X"
Client B: Removes item "X"

Result: Item "X" exists (additions win over deletions)
```

This prevents accidental data loss.

### Types of CRDTs

#### 1. **LWW-Register** (Last-Write-Wins Register)
- Holds a single value
- Last write wins based on timestamp
- Used for: node positions, colors, single values

```javascript
register.set("blue");  // timestamp 10
register.set("red");   // timestamp 12
// Result: "red" (timestamp 12 > 10)
```

#### 2. **CRDT Map**
- Key-value store where each key is a CRDT
- Operations: set(key, value), delete(key)
- Used for: objects with properties

```javascript
map.set("name", "Node 1");      // timestamp 10
map.set("position", {x: 100});  // timestamp 11
map.set("name", "Node 2");      // timestamp 12

// Result: {name: "Node 2", position: {x: 100}}
```

#### 3. **CRDT Array**
- Ordered list with unique position identifiers
- Operations: insert(position, value), delete(position)
- Used for: lists, ordered content

```javascript
array.insert(0, "A");  // [A]
array.insert(1, "C");  // [A, C]
array.insert(1, "B");  // [A, B, C]
```

Each item gets a unique position ID (like "1.5" between "1" and "2"), so concurrent inserts don't conflict.

#### 4. **CRDT Text**
- Specialized for collaborative text editing
- Each character has unique identifier
- Used for: document editors, text fields

```javascript
Initial: "cat"

User A inserts at position 1: "big " → "cbigat"?
User B inserts at position 3: "s" → "cats"?

CRDT resolves to: "big cats" ✓
```

### Real-World CRDT Example

```
Document State (shared Y.Map):

{
  nodes: Y.Map({
    "node-1": Y.Map({
      type: "topic",
      position: {x: 100, y: 200},  ← LWW-Register
      label: "Introduction"        ← LWW-Register
    }),
    "node-2": Y.Map({...})
  }),
  edges: Y.Map({...})
}

User A: Changes node-1 position to {x: 150, y: 200} [timestamp 42]
User B: Changes node-1 label to "Overview" [timestamp 43]

Both operations preserved! ✓
- position = {x: 150, y: 200} (from User A)
- label = "Overview" (from User B)

If both changed position:
User A: {x: 150, y: 200} [timestamp 42]
User B: {x: 180, y: 220} [timestamp 45]

Result: position = {x: 180, y: 220} ✓
(timestamp 45 > 42, so User B wins)
```

### The Catch: Complexity

Implementing CRDTs from scratch is extremely complex:
- Need to track causal relationships between operations
- Implement vector clocks or logical clocks
- Handle garbage collection of old operations
- Optimize for network efficiency

This is why we use **Yjs**.

---

## Yjs: A Practical CRDT Library

### What Is Yjs?

**Yjs** (pronounced "why-js") is a high-performance CRDT library that implements all the complex CRDT logic for you. It's specifically optimized for real-time collaborative applications.

### Core Yjs Concepts

#### 1. **Y.Doc** (Yjs Document)

The root container for all shared data.

```javascript
import * as Y from 'yjs';

const doc = new Y.Doc();
```

Think of `Y.Doc` as a "magic object" that:
- Tracks all changes
- Manages timestamps automatically
- Encodes/decodes updates efficiently
- Handles conflict resolution

#### 2. **Shared Types**

Yjs provides CRDT data structures:

```javascript
const doc = new Y.Doc();

// Get shared types from the document
const yMap = doc.getMap('myMap');      // Shared Map
const yArray = doc.getArray('myArray'); // Shared Array
const yText = doc.getText('myText');    // Shared Text
```

**Important**: These are NOT regular JavaScript objects. They're special CRDT types.

#### 3. **Observing Changes**

Listen for changes from remote users:

```javascript
const yMap = doc.getMap('nodes');

yMap.observe((event) => {
  console.log('Map changed!', event);
  // Update your UI here
});

// For nested structures, use observeDeep
yMap.observeDeep((events) => {
  console.log('Deep changes detected', events);
  updateUI();
});
```

#### 4. **Transactions**

Group multiple changes into atomic batches:

```javascript
doc.transact(() => {
  yMap.set('key1', 'value1');
  yMap.set('key2', 'value2');
  yMap.set('key3', 'value3');
});
// All three changes sent as one update
```

**Benefits**:
- Single network message instead of three
- All-or-nothing application
- Better performance

### Yjs Update Flow

```
User A's Browser                    User B's Browser
─────────────────                   ─────────────────
Y.Doc (local)                       Y.Doc (local)

1. User A makes change:
   yMap.set('color', 'blue')

2. Yjs generates update:
   update = encodeUpdate(doc)
   [binary blob with the change]

3. Send to server/peers:
   websocket.send(update)
                    ↓
                [Network]
                    ↓
4. User B receives:
   websocket.onmessage = (update)

5. Apply update:
   Y.applyUpdate(doc, update)

6. Yjs merges changes:
   - Checks timestamps
   - Resolves conflicts
   - Updates local state

7. Triggers observer:
   yMap.observe(() => {
     // Update UI with new color
   })
```

### Yjs Encoding Efficiency

Yjs uses a highly efficient binary encoding:

```
Traditional JSON:
{
  "id": "node-123",
  "position": {"x": 150, "y": 200},
  "timestamp": 1234567890
}
// Size: ~80 bytes

Yjs binary update:
[0x01, 0x05, 0x96, 0x01, ...]
// Size: ~15-25 bytes
```

Yjs updates are typically **3-5x smaller** than JSON.

### Key Yjs Features

#### Conflict Resolution
```javascript
// Both clients edit simultaneously:
Client A: yMap.set('title', 'Version A')  [clock: 10]
Client B: yMap.set('title', 'Version B')  [clock: 11]

// After sync, both converge to:
yMap.get('title') === 'Version B'  // clock 11 wins
```

#### Undo/Redo Support
```javascript
import { UndoManager } from 'yjs';

const undoManager = new UndoManager(yMap);

yMap.set('key', 'value1');
yMap.set('key', 'value2');

undoManager.undo();  // back to 'value1'
undoManager.redo();  // forward to 'value2'
```

#### Sub-Documents
```javascript
// For large applications with multiple documents
const mainDoc = new Y.Doc();
const subDoc = new Y.Doc();

mainDoc.getMap('subdocs').set('child', subDoc);
```

### Yjs Providers

Yjs is transport-agnostic. You choose how to sync:

#### 1. **y-websocket** (Real-time)
```javascript
import { WebsocketProvider } from 'y-websocket';

const provider = new WebsocketProvider(
  'ws://localhost:3001',  // server URL
  'document-123',         // document name
  doc                     // Y.Doc instance
);

provider.on('status', (event) => {
  console.log(event.status); // 'connected', 'disconnected'
});
```

#### 2. **y-webrtc** (Peer-to-peer)
```javascript
import { WebrtcProvider } from 'y-webrtc';

// Direct browser-to-browser connection
const provider = new WebrtcProvider('room-name', doc);
```

#### 3. **y-indexeddb** (Local storage)
```javascript
import { IndexeddbPersistence } from 'y-indexeddb';

// Persist to browser's IndexedDB
const persistence = new IndexeddbPersistence('doc-name', doc);
```

### Awareness Protocol

**Awareness** is Yjs's solution for ephemeral user presence (cursors, selections, names).

```javascript
const awareness = provider.awareness;

// Set your local state
awareness.setLocalState({
  user: {
    name: 'Alice',
    color: '#ff0000'
  },
  cursor: { x: 100, y: 200 },
  selection: ['node-1', 'node-2']
});

// Listen for other users
awareness.on('change', (changes) => {
  const states = awareness.getStates();
  states.forEach((state, clientId) => {
    renderCursor(state.user, state.cursor);
  });
});
```

**Key Difference**: Awareness data is NOT persisted to the Y.Doc. It's ephemeral and disappears when a user disconnects.

### Complete Yjs Example

```javascript
// 1. Create document
const doc = new Y.Doc();

// 2. Get shared types
const yNodes = doc.getMap('nodes');

// 3. Connect to server
const provider = new WebsocketProvider(
  'ws://localhost:3001',
  'my-document',
  doc
);

// 4. Wait for initial sync
provider.on('sync', (isSynced) => {
  if (!isSynced) return;

  // 5. Listen for changes
  yNodes.observeDeep(() => {
    const nodes = Array.from(yNodes.entries());
    renderNodes(nodes);
  });

  // 6. Make changes
  const nodeData = new Y.Map();
  nodeData.set('type', 'topic');
  nodeData.set('position', { x: 100, y: 200 });

  yNodes.set('node-1', nodeData);
  // ↑ Automatically syncs to all connected clients
});

// 7. Awareness for user presence
const awareness = provider.awareness;
awareness.setLocalState({
  user: { name: 'Alice', color: '#ff0000' }
});

awareness.on('change', () => {
  const users = Array.from(awareness.getStates().values());
  renderConnectedUsers(users);
});
```

---

## Redis: Distributed Coordination

### The Scaling Problem

Yjs + WebSockets work great with one server:

```
Users → Server (Y.Doc in memory) → Database
```

But what about multiple servers for high availability?

```
Users A,B → Server 1 (Y.Doc copy 1)
                                        → Database
Users C,D → Server 2 (Y.Doc copy 2)
```

**Problem**: Server 1 and Server 2 have separate Y.Doc instances. Changes on Server 1 don't reach users on Server 2!

### Redis to the Rescue

**Redis** is an in-memory data store that provides a **Pub/Sub** (Publish/Subscribe) system for real-time messaging between servers.

### Redis Pub/Sub Pattern

```
Publisher                Subscriber 1
   ↓                          ↑
   ↓                          ↑
   └→ Redis Channel "updates" ←┘
              ↑
              ↑
         Subscriber 2
```

**Flow**:
1. Server 1 publishes message to channel
2. Redis broadcasts to all subscribed servers
3. Server 2 receives message
4. Server 2 applies update to its local Y.Doc

### Redis Commands

```bash
# Subscribe to a channel
SUBSCRIBE yjs:updates

# Publish a message
PUBLISH yjs:updates "binary_yjs_update_data"

# Result: All subscribers receive the message instantly
```

### How y-redis Works

The `y-redis` library integrates Yjs with Redis:

```javascript
import { RedisAdapter } from 'y-redis';
import Redis from 'ioredis';

// Create two Redis clients (pub and sub)
const pubClient = new Redis({ host: 'localhost', port: 6379 });
const subClient = new Redis({ host: 'localhost', port: 6379 });

// Create y-redis adapter
const redisAdapter = new RedisAdapter({
  pub: pubClient,
  sub: subClient,
  prefix: 'yjs',  // Channel prefix
});
```

**What y-redis Does**:
1. Listens for local Yjs updates
2. Publishes them to Redis
3. Subscribes to Redis channel
4. Applies received updates to local Y.Doc

### Multi-Server Flow with Redis

```
User A → Server 1                           Server 2 ← User C
         │                                      │
         │ User A moves node                    │
         │                                      │
         ├─ Yjs updates local Y.Doc            │
         │                                      │
         ├─ y-redis publishes to Redis ─────→ Redis
         │  PUBLISH yjs:document-123 <data>    │
         │                                      │
         │                              Redis broadcasts
         │                                      │
         │                              y-redis receives
         │                                      │
         │                              Yjs applies update
         │                                      │
         │                              WebSocket sends to User C
         │                                      │
         Server 1 ← User B              User C sees change! ✓
```

### Redis Data Structures

For Yjs coordination, Redis primarily uses:

#### 1. **Pub/Sub Channels**
```
Channel: yjs:document-123
Message: [binary Yjs update]
```

#### 2. **Strings** (for snapshots)
```
Key: yjs:document-123:state
Value: [binary Yjs document snapshot]
TTL: 3600 seconds (optional)
```

### Redis Persistence (Optional)

Redis can persist data to disk:

```bash
# Append-Only File (AOF)
appendonly yes
appendfsync everysec

# Redis Database (RDB)
save 900 1      # Save if 1 key changed in 900 seconds
save 300 10     # Save if 10 keys changed in 300 seconds
```

**For Yjs**: AOF is preferred because it logs every publish operation.

### Redis Memory Management

```bash
# Set max memory
maxmemory 512mb

# Eviction policy
maxmemory-policy allkeys-lru  # Remove least recently used keys
```

**For Yjs**: Use `allkeys-lru` to prevent memory overflow while keeping active documents in memory.

### Redis Clustering (Advanced)

For very large scale:

```
Redis Cluster
├─ Node 1 (slots 0-5460)
├─ Node 2 (slots 5461-10922)
└─ Node 3 (slots 10923-16383)
```

Each document hashes to a slot, distributed across nodes.

### Why Redis Over Alternatives?

| Feature | Redis | Database | Message Queue |
|---------|-------|----------|---------------|
| Latency | <1ms | 10-50ms | 5-20ms |
| Pub/Sub | Native | Polling | Native |
| In-Memory | Yes | No | Varies |
| Simple Setup | Yes | Complex | Medium |
| Persistence | Optional | Always | Optional |

For real-time Yjs coordination, Redis is ideal because:
1. **Ultra-low latency** (<1ms)
2. **Native Pub/Sub** without polling
3. **In-memory** for maximum speed
4. **Simple** to set up and operate

---

## How Everything Works Together

### The Complete Stack

```
┌─────────────────────────────────────────────────────────┐
│                 Browser (Client)                        │
│                                                         │
│  ┌───────────────────────────────────────────────┐    │
│  │ React UI (Diagram Editor)                     │    │
│  │ - ReactFlow for diagram rendering             │    │
│  │ - Zustand for local UI state                  │    │
│  └───────────┬────────────────────────────────────┘   │
│              │                                          │
│  ┌───────────▼────────────────────────────────────┐    │
│  │ Yjs Layer (Y.Doc)                             │    │
│  │ - Y.Map('nodes') - Stores all nodes           │    │
│  │ - Y.Map('edges') - Stores all edges           │    │
│  │ - Observes changes and updates UI             │    │
│  └───────────┬────────────────────────────────────┘   │
│              │                                          │
│  ┌───────────▼────────────────────────────────────┐    │
│  │ y-websocket Provider                          │    │
│  │ - Manages WebSocket connection                │    │
│  │ - Sends/receives Yjs updates                  │    │
│  │ - Handles reconnection logic                  │    │
│  └───────────┬────────────────────────────────────┘   │
└──────────────┼──────────────────────────────────────┘
               │ WebSocket Connection
               │ (ws:// or wss://)
               │
┌──────────────▼──────────────────────────────────────┐
│            Load Balancer (Nginx)                    │
│            - IP hash (sticky sessions)              │
│            - WebSocket upgrade support              │
└──────────────┬──────────────────────────────────────┘
               │ Distributes to backend instances
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼───┐  ┌───▼───┐  ┌───▼───┐
│Server1│  │Server2│  │Server3│
└───┬───┘  └───┬───┘  └───┬───┘
    │          │          │
    │  ┌───────┴───────┐  │
    │  │               │  │
    └──▶  Redis Pub/Sub ◄──┘
       │ (y-redis)     │
       └───────┬───────┘
               │
       ┌───────▼───────┐
       │   MongoDB     │
       │ (y-mongodb)   │
       │ Persistence   │
       └───────────────┘
```

### Step-by-Step Flow: User Edits a Node

Let's trace what happens when **User A** (connected to Server 1) moves a node, and **User B** (connected to Server 2) sees the change.

#### Step 1: User A Moves Node

```javascript
// React component
const onNodeDrag = (nodeId, position) => {
  updateNodePosition(nodeId, position);
};

// Zustand store
updateNodePosition: (nodeId, position) => {
  const { ydoc } = get();

  // Get the Y.Map
  const yNodes = ydoc.getMap('nodes');
  const yNode = yNodes.get(nodeId);

  // Update position (CRDT operation)
  yNode.set('position', position);

  // ↑ This automatically triggers everything below
};
```

#### Step 2: Yjs Generates Update

```javascript
// Internally, Yjs:
1. Creates a "struct" (change description):
   {
     clock: 42,           // Logical timestamp
     clientId: 'abc123',  // User A's client ID
     value: {x: 150, y: 200}
   }

2. Encodes to compact binary format:
   [0x01, 0x2A, 0x05, ...] (~20 bytes)

3. Triggers update event
```

#### Step 3: y-websocket Sends to Server

```javascript
// y-websocket provider
provider.on('update', (update, origin) => {
  if (origin !== provider) {
    // Send to server via WebSocket
    websocket.send(update);
  }
});
```

#### Step 4: Server 1 Receives Update

```javascript
// Server (backend-editor)
wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req, {
    docName: 'document-123',
    persistence: yPersistence,  // MongoDB
    redis: yRedisAdapter        // Redis
  });
});

// y-websocket/bin/utils handles the update:
1. Applies update to Server 1's Y.Doc
2. Forwards to persistence (MongoDB)
3. Forwards to y-redis adapter
```

#### Step 5: y-redis Publishes to Redis

```javascript
// y-redis adapter
redisAdapter.on('update', (update) => {
  // Publish to Redis channel
  pubClient.publish(
    'yjs:document-123',
    Buffer.from(update)
  );
});
```

#### Step 6: Redis Broadcasts

```
Redis receives: PUBLISH yjs:document-123 <update>

Redis broadcasts to subscribers:
  - Server 1 (self, ignored)
  - Server 2 ✓
  - Server 3 ✓
```

#### Step 7: Server 2 Receives from Redis

```javascript
// y-redis adapter on Server 2
subClient.on('message', (channel, message) => {
  if (channel === 'yjs:document-123') {
    // Apply update to Server 2's Y.Doc
    Y.applyUpdate(ydoc, message);
  }
});
```

#### Step 8: Server 2 Broadcasts to Clients

```javascript
// y-websocket on Server 2
ydoc.on('update', (update, origin) => {
  // Send to all WebSocket clients on Server 2
  connections.forEach((conn) => {
    conn.send(update);
  });
});
```

#### Step 9: User B Receives Update

```javascript
// User B's browser
websocket.onmessage = (event) => {
  const update = event.data;

  // y-websocket applies to local Y.Doc
  Y.applyUpdate(ydoc, update);
};
```

#### Step 10: Yjs Fires Observer

```javascript
// User B's Zustand store
yNodes.observeDeep(() => {
  const nodes = Array.from(yNodes.entries()).map(
    ([id, yNode]) => ({
      id,
      position: yNode.get('position'),
      // ... other properties
    })
  );

  // Update React state
  set({ nodes });
});
```

#### Step 11: React Re-renders

```javascript
// React component re-renders with new position
<Node
  id="node-1"
  position={{ x: 150, y: 200 }}  // ← Updated!
/>
```

**Total Time**: Typically 50-150ms from User A's action to User B seeing the change!

### Conflict Resolution Example

What if User A and User B both move the same node simultaneously?

```
Time  User A (Server 1)              User B (Server 2)
────────────────────────────────────────────────────────
t0    Node at (100, 100)             Node at (100, 100)

t1    Drags to (150, 120)
      [clock: 42, client: A]

t2                                   Drags to (180, 140)
                                     [clock: 43, client: B]

t3    Receives B's update            Receives A's update
      clock 43 > 42 → Apply          clock 43 > 42 → Apply

t4    Node at (180, 140) ✓           Node at (180, 140) ✓
```

**Result**: Both users converge to User B's position because timestamp 43 > 42. No conflicts, no manual resolution needed!

### Persistence Flow (MongoDB)

```
1. Update arrives at Server 1
   ↓
2. y-mongodb intercepts
   ↓
3. Stores in MongoDB:
   Collection: y-mongodb-documents
   {
     _id: "document-123",
     clock: 43,
     value: Binary(...)  // Encoded Y.Doc state
   }
   ↓
4. If server restarts:
   - New client connects
   - Server loads from MongoDB
   - Client receives full document state
   - Collaboration resumes
```

### Offline Support (Future)

Yjs can work offline with y-indexeddb:

```javascript
// Store locally in browser
const localPersistence = new IndexeddbPersistence(
  'document-123',
  doc
);

// Works offline
yNodes.set('node-1', nodeData);

// When back online, y-websocket syncs:
provider.on('status', ({ status }) => {
  if (status === 'connected') {
    // Automatic sync of offline changes
  }
});
```

---

## Key Concepts Summary

### 1. WebSockets
- **Purpose**: Real-time bidirectional communication
- **Benefit**: Low latency (<100ms), push notifications
- **Use Case**: Send/receive Yjs updates instantly

### 2. CRDTs
- **Purpose**: Automatic conflict resolution
- **Benefit**: No central coordination, eventual consistency
- **Properties**: Commutative, Associative, Idempotent
- **Strategy**: Last-Write-Wins with logical timestamps

### 3. Yjs
- **Purpose**: Production-ready CRDT implementation
- **Benefit**: Handles all CRDT complexity, highly optimized
- **Features**:
  - Shared data types (Map, Array, Text)
  - Efficient binary encoding
  - Undo/Redo support
  - Awareness protocol for presence

### 4. Redis
- **Purpose**: Coordinate multiple server instances
- **Benefit**: Ultra-low latency (<1ms), scales horizontally
- **Pattern**: Pub/Sub for broadcasting updates
- **Use Case**: Keep Y.Doc instances synchronized across servers

### The Power of the Stack

When combined, these technologies provide:

1. **Real-time collaboration**: Changes appear in milliseconds
2. **Automatic conflict resolution**: No manual merging needed
3. **Horizontal scalability**: Add more servers as needed
4. **High availability**: Servers can fail, collaboration continues
5. **Eventual consistency**: All users converge to same state
6. **Persistence**: Work survives server restarts
7. **Offline support**: Work offline, sync when reconnected

### Mental Model

Think of it like this:

- **Y.Doc** = The shared document (like a Google Doc)
- **WebSocket** = The phone line connecting users
- **CRDT** = The automatic conflict resolver
- **Redis** = The switchboard connecting multiple offices
- **MongoDB** = The filing cabinet storing history

When User A types, the change goes through the phone line (WebSocket), gets automatically merged (CRDT) into the shared document (Y.Doc), broadcasted through the switchboard (Redis) to all offices, and filed away (MongoDB) for safekeeping.

---

## Further Learning

### Recommended Resources

**CRDTs**:
- [CRDT.tech](https://crdt.tech/) - Comprehensive CRDT resource
- "Conflict-free Replicated Data Types" paper by Shapiro et al.

**Yjs**:
- [Yjs Documentation](https://docs.yjs.dev/)
- [Yjs Demos](https://github.com/yjs/yjs-demos)

**WebSockets**:
- [MDN WebSocket Guide](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- RFC 6455 (WebSocket Protocol)

**Redis**:
- [Redis Documentation](https://redis.io/documentation)
- "Redis in Action" book by Josiah Carlson

---

## Conclusion

You now understand:

1. **Why** these technologies are needed (real-time collaboration problem)
2. **What** each technology does (WebSocket, CRDT, Yjs, Redis)
3. **How** they work individually
4. **How** they work together as a complete system

This stack represents the state-of-the-art in building collaborative applications, used by companies like Figma, Notion, and Linear. Understanding these concepts will help you work effectively with Rosetta's collaborative diagram editor and potentially build your own collaborative features.
