# Load Testing Architecture

## Overview

This document describes the architecture and implementation of the load testing suite for the Rosetta collaborative diagramming application.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CI/CD Pipeline                            │
│                 (run-load-test.sh)                          │
└────────┬──────────────────────────────────┬─────────────────┘
         │                                  │
         │                                  │
    ┌────▼─────┐                      ┌────▼────────┐
    │  Backend │                      │  Frontend   │
    │  Server  │                      │  Dev Server │
    │ (port    │◄─────WebSocket──────►│ (port 5173) │
    │  3001)   │                      │             │
    └────▲─────┘                      └──────▲──────┘
         │                                   │
         │                                   │
         │                                   │
    ┌────┴────────────────┐           ┌─────┴──────────────────┐
    │   Swarm Bots (N)    │           │  PerformanceMonitor    │
    │                     │           │                        │
    │ ┌─────┐  ┌─────┐   │           │  ┌──────────────────┐  │
    │ │Bot 1│  │Bot 2│   │           │  │ FPS Monitoring   │  │
    │ └─────┘  └─────┘   │           │  │ Memory Tracking  │  │
    │    ...       ...    │           │  └──────────────────┘  │
    │ ┌─────┐  ┌─────┐   │           │  ┌──────────────────┐  │
    │ │Bot N│  │...  │   │           │  │ Yjs Metrics      │  │
    │ └─────┘  └─────┘   │           │  │ Rendering Perf   │  │
    │                     │           │  └──────────────────┘  │
    │ • Yjs CRDT          │           │  ┌──────────────────┐  │
    │ • WebSocket         │           │  │ Metrics API      │  │
    │ • Awareness         │           │  │   Reporting      │  │
    └─────────────────────┘           └────────────────────────┘
              │                                  │
              │                                  │
              │         ┌────────────┐           │
              └────────►│  MongoDB   │◄──────────┘
                       │  (Yjs Docs)│
                       └────────────┘
```

## Components

### 1. Swarm Bots (`scripts/load-test/swarm-bot.js`)

**Purpose**: Simulate multiple concurrent users editing the diagram

**Technology Stack**:
- `yjs` - CRDT library for collaborative editing
- `y-websocket` - WebSocket provider for Yjs
- `ws` - WebSocket client polyfill for Node.js

**Metrics Collection**:
- Backend API endpoint `/api/metrics/summary` provides aggregated metrics
- Connection count, message count, operation count, and error count
- Frontend metrics collected via `PerformanceMonitor` component and sent to `/api/metrics`

### 2. Frontend Performance Monitoring (`PerformanceMonitor` component)

**Purpose**: Collect real-time performance metrics in the browser during load tests

**Technology Stack**:
- React component (`apps/frontend-editor/src/components/PerformanceMonitor.tsx`)
- Browser Performance API (`performance.now()`, `requestAnimationFrame`)
- Custom hook (`usePerformanceMonitor`) for metric collection

**Metrics Collected**:

#### Rendering Performance
- **FPS**: Frame rate via `requestAnimationFrame` callbacks
- **Average Frame Time**: Time per frame in milliseconds

#### Memory Usage
- **Heap Used**: JavaScript heap memory consumption (MB)
- **Heap Total**: Total heap size (MB)

#### Yjs Metrics
- **Node Count**: Number of nodes in Yjs document
- **Edge Count**: Number of edges in Yjs document
- **Update Count**: Total Yjs update events

#### Collaboration Metrics
- **Connected Users**: Number of users in awareness states
- **Awareness States**: Active awareness entries

#### React Flow Metrics
- **Rendered Nodes**: Number of nodes rendered in DOM
- **Rendered Edges**: Number of edges rendered in DOM

#### Performance Timings
- **Yjs→React Latency**: Time from Yjs update to React state update (ms)
- **React→DOM Latency**: Time from React state to DOM render (ms)

**How It Works**:
1. Component automatically activates in test mode (test routes)
2. Displays real-time metrics in UI overlay (bottom-right corner)
3. Collects metrics every 5 seconds
4. Sends metrics to backend `/api/metrics` endpoint every 30 seconds or when 10+ samples collected
5. Backend aggregates metrics from all connected clients

**Usage**:
The component is automatically included in the DiagramEditor when using test routes:
- `/studio/test/editor/:community/:pathId`
- Metrics overlay appears automatically in test mode

**Behavior**:
- Each bot maintains its own Y.Doc instance
- Connects to WebSocket server with test mode authentication
- Performs random operations (CRDT mutations):
  - **Create new nodes** (25% probability) - Generates unique node IDs, tests CRDT insertions
  - **Create new edges** (10% probability) - Connects random nodes, tests relationship syncing
  - Move nodes (35% probability) - Updates positions, tests property updates
  - Update labels (20% probability) - Modifies node data, tests text syncing
  - Lock/unlock nodes (5% probability) - Tests locking mechanism
  - **Delete nodes** (5% probability) - Removes nodes and connected edges, tests CRDT deletions
- Sends awareness heartbeat every 15 seconds
- Gracefully disconnects and reports statistics

**Configuration**:
```javascript
// Environment variables
WS_URL              // WebSocket server URL
ROOM_NAME           // Yjs room name
CLIENT_COUNT        // Number of concurrent bots
UPDATE_INTERVAL_MS  // Milliseconds between updates
DURATION_MS         // Test duration (0 = indefinite)
RAMP_UP_MS          // Gradual connection ramp-up
```

**Output**:
- Connection status
- Message count per bot
- Error count per bot
- Aggregated statistics

### 3. Orchestration Script

**Location**: `scripts/load-test/run-load-test.sh` (with convenience wrapper at `run-load-test.sh`)

**Purpose**: Coordinate the entire load testing workflow

**Workflow**:

```
[1] Start Backend Server
    ├─ Check if already running (port 3001)
    ├─ Start if needed
    └─ Wait for /health endpoint

[2] Start Frontend Server
    ├─ Check if already running (port 5173)
    ├─ Start if needed
    └─ Wait for HTTP response

[3] Launch Swarm Bots
    ├─ Start bots in background
    ├─ Wait for ramp-up period
    └─ Verify bots are running

[4] Run Load Test
    ├─ Wait for specified duration
    ├─ Collect metrics from backend API
    └─ Generate reports

[5] Cleanup & Report
    ├─ Stop bots
    ├─ Stop servers (if started by script)
    ├─ Display statistics
    └─ Exit with status code
```

**Features**:
- Automatic service health checks
- Graceful shutdown on SIGINT/SIGTERM
- Comprehensive logging
- Colored output for readability
- Configurable via environment variables

## Data Flow

### Bot → Backend Flow

```
Bot Client                  WebSocket Server              MongoDB
    │                              │                          │
    │  1. Connect with test auth   │                          │
    ├─────────────────────────────►│                          │
    │                              │                          │
    │  2. Yjs sync request         │                          │
    ├─────────────────────────────►│                          │
    │                              │  3. Load existing doc    │
    │                              ├─────────────────────────►│
    │                              │◄─────────────────────────┤
    │  4. Initial state            │                          │
    │◄─────────────────────────────┤                          │
    │                              │                          │
    │  5. Apply transaction        │                          │
    │  (move node)                 │                          │
    ├─────────────────────────────►│                          │
    │                              │  6. Broadcast to all     │
    │                              │     connected clients    │
    │                              ├──────────┐               │
    │  7. Receive update from      │          │               │
    │     other bots               │          │               │
    │◄─────────────────────────────┤◄─────────┘               │
    │                              │                          │
    │  8. Awareness heartbeat      │                          │
    ├─────────────────────────────►│                          │
    │                              │  9. Persist state        │
    │                              ├─────────────────────────►│
```


## Yjs Data Structure

Based on codebase analysis, the Yjs document uses the following schema:

```typescript
Y.Doc
├─ nodes: Y.Map<string, Y.Map>
│  └─ [nodeId: string]: Y.Map {
│       id: string
│       type: 'topic' | 'subtopic'
│       position: { x: number, y: number }
│       data: {
│         label: string
│         side: 0 | 1 | 2 | 3
│         description?: string
│         resources?: Array<{title, type, url}>
│       }
│       isBeingEdited: boolean
│       editedBy: string | null
│     }
│
├─ edges: Y.Map<string, Y.Map>
│  └─ [edgeId: string]: Y.Map {
│       id: string
│       source: string
│       target: string
│       sourceHandle: string | null
│       targetHandle: string | null
│     }
│
├─ nodeLocks: Y.Map<string, NodeLock>
│  └─ [nodeId: string]: {
│       userId: string
│       userName: string
│       timestamp: number
│     }
│
└─ userColors: Y.Map<string, string>
   └─ [userId: string]: string (hex color)
```

### Awareness State

```typescript
{
  userId: string
  userName: string
  color: string
  cursor: { x: number, y: number }
  selection: string[]  // Selected node IDs
  mode: 'edit' | 'view'
  lastHeartbeat: number
}
```

## Test Mode Authentication

The system uses a dedicated test mode for load testing that bypasses production authentication:

**Backend** (`services/backend-editor/src/middleware/wsAuth.ts`):
```typescript
if (NODE_ENV === 'development') {
  // Accept query parameters:
  // - testUser: User ID
  // - testName: Display name
  // - testCommunity: Community name
}
```

**Frontend** (`apps/frontend-editor/src/routes/TestRoutes.tsx`):
```
/test/editor/:community/:pathId
/test/view/:community/:pathId
```

**Bot Connection**:
```javascript
const params = {
  testUser: 'bot-1',
  testName: 'LoadBot1',
  testCommunity: 'TestCommunity'
};

const provider = new WebsocketProvider(
  wsUrl,
  roomName,
  doc,
  { params }
);
```

## Performance Considerations

### Bottlenecks to Monitor

1. **Script Duration**: High values indicate expensive React re-renders or Yjs observer operations
2. **Layout Count**: Many layouts suggest DOM thrashing
3. **Heap Growth**: Unbounded growth indicates memory leaks
4. **FPS Degradation**: Low FPS indicates rendering bottlenecks

### Optimization Strategies

1. **React Optimization**:
   - Use `React.memo` for expensive components
   - Implement `useMemo` for derived state
   - Debounce/throttle frequent updates

2. **Yjs Optimization**:
   - Batch transactions
   - Use `doc.transact()` for multiple operations
   - Limit observer depth with `observeDeep`

3. **React Flow Optimization**:
   - Use `nodesDraggable={false}` during high load
   - Implement viewport-based rendering
   - Reduce edge complexity

4. **WebSocket Optimization**:
   - Implement compression
   - Use binary encoding
   - Adjust awareness heartbeat interval

## CI/CD Integration

### Recommended Triggers

- **Push to main**: Quick test (5 bots, 30s)
- **Pull requests**: Medium test (20 bots, 60s)
- **Nightly**: Heavy test (100 bots, 120s)
- **Release**: Full suite with multiple scenarios

### Performance Budgets

Define and enforce performance budgets:

```json
{
  "maxScriptDuration": 5000,
  "maxLayoutCount": 100,
  "maxHeapSizeMB": 500,
  "minFPS": 30,
  "maxInitialLoadTime": 10000
}
```

### Metrics Tracking

Consider integrating with:
- **Grafana**: Time-series visualization
- **Prometheus**: Metrics storage
- **Datadog**: APM and monitoring
- **Lighthouse CI**: Performance budgets

## Troubleshooting Guide

### Issue: Bots fail to connect

**Symptoms**: "Connection timeout" errors

**Solutions**:
1. Verify backend is running: `curl http://localhost:3001/health`
2. Check MongoDB: `mongosh --eval "db.adminCommand('ping')"`
3. Ensure NODE_ENV=development
4. Check firewall settings

### Issue: Performance degradation

**Symptoms**: High latency, connection errors

**Solutions**:
1. Reduce bot update frequency
2. Check for memory leaks in backend
3. Monitor MongoDB performance
4. Review WebSocket connection handling

### Issue: Memory leaks

**Symptoms**: Heap size grows unbounded

**Solutions**:
1. Ensure observers are cleaned up
2. Check for detached DOM nodes
3. Verify WebSocket connections close
4. Use Chrome DevTools Memory profiler

## Future Enhancements

### Planned Features

1. **Multi-room testing**: Test across multiple rooms simultaneously
2. **Distributed load**: Run bots from multiple machines
3. **Custom scenarios**: User-defined editing patterns
4. **Real-time dashboard**: Live metrics visualization
5. **Historical trends**: Track performance over time
6. **Chaos testing**: Inject random failures
7. **Network conditions**: Simulate latency, packet loss

### Integration Opportunities

1. **k6**: HTTP and WebSocket load testing
2. **Artillery**: Alternative load testing framework
3. **Jest**: Unit test coverage for bot logic
4. **Grafana**: Metrics visualization
5. **PagerDuty**: Alerting for performance regressions

## References

- [Yjs Documentation](https://docs.yjs.dev/)
- [React Flow Performance](https://reactflow.dev/learn/troubleshooting/performance)
- Project docs: `docs/diagram-data-flow.md`, `docs/NODE_MODAL_LOCKING.md`
