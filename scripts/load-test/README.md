# Load Testing Suite

Comprehensive load testing suite for the Rosetta collaborative diagramming application. This suite uses headless Node.js bots to stress test the WebSocket/Yjs backend under realistic collaborative load, and includes frontend performance monitoring via the PerformanceMonitor component.

## Architecture

### Testing Approach

1. **Backend Load**: Headless Node.js bots using Yjs and y-websocket to simulate concurrent collaborative users
2. **Frontend Performance**: PerformanceMonitor component (React) that collects real-time performance metrics in the browser during load tests

### Components

```
scripts/load-test/
├── swarm-bot.js          # Yjs bot swarm for backend load testing
├── run-load-test.sh      # Orchestration script for CI/CD
└── README.md             # This file
```

## Quick Start

### Prerequisites

```bash
# Install dependencies
./scripts/load-test/install-deps.sh

# Ensure MongoDB is running
# Default: mongodb://localhost:27017/rosetta-editor

# Stop Docker containers if running (use local backend with new code)
docker compose down
```

### Run Complete Load Test

The load testing suite provides multiple pre-configured test scenarios via npm scripts:

```bash
cd scripts/load-test

# Default test (10 bots, 60s)
npm test

# Quick smoke test (5 bots, 30s, 3 initial nodes)
npm run test:quick

# Medium load test (20 bots, 60s, 10 initial nodes)
npm run test:medium

# Heavy load test (50 bots, 2 minutes, 20 initial nodes)
npm run test:heavy

# Stress test (100 bots, 60s, 30 initial nodes)
npm run test:stress

# Create-focused test (40% create, 30% move, 20% update)
npm run test:create

# Modify-only test (60% move, 40% update, no creates/deletes)
npm run test:modify

# Endurance test (30 bots, 10 minutes)
npm run test:endurance

# CI/CD optimized (assumes servers already running)
npm run test:ci
```

**What happens during a test:**
1. Kills any old bot processes
2. Cleans up MongoDB test data
3. Starts backend and frontend (unless using `test:ci`)
4. Runs bots for specified duration
5. Displays metrics in terminal
6. Cleans up test data

**When prompted, open browser to:**
`http://localhost:5173/studio/test/editor/TestCommunity/perf-test-room`

### Run Individual Components

#### 1. Swarm Bots Only (Advanced)

Use these when you need just the bots without the full orchestration (servers already running, no automatic cleanup):

```bash
cd scripts/load-test

# Run bots with defaults
npm run bots

# Quick bot test
npm run bots:quick

# Heavy bot load
npm run bots:heavy

# Custom configuration
CLIENT_COUNT=20 DURATION_MS=60000 npm run bots
```

**Note:** The `npm run bots:*` commands run **only** the bot swarm (no server startup, no cleanup). For most use cases, prefer the `npm run test:*` commands which provide full orchestration.


## Configuration

### Environment Variables

#### Bot Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BOT_COUNT` | `10` | Number of concurrent bot clients |
| `BOT_UPDATE_INTERVAL` | `2000` | Milliseconds between bot updates |
| `TEST_DURATION` | `60` | Test duration in seconds |
| `BOT_RAMP_UP` | `5000` | Ramp-up period for gradual connection |
| `INITIAL_NODE_COUNT` | `5` | Number of initial nodes created at start |
| `ROOM_NAME` | `TestCommunity/perf-test-room` | Yjs room name |
| `WS_URL` | `ws://localhost:3001` | WebSocket server URL |

#### Bot Behavior (Advanced)

Configure bot operation probabilities (values between 0.0 and 1.0):

| Variable | Default | Description |
|----------|---------|-------------|
| `CREATE_NODE_PROBABILITY` | `0.15` | Probability of creating a new node (15%) |
| `DELETE_NODE_PROBABILITY` | `0.12` | Probability of deleting a node (12%) |
| `MOVE_PROBABILITY` | `0.40` | Probability of moving a node (40%) |
| `LABEL_UPDATE_PROBABILITY` | `0.20` | Probability of updating a label (20%) |
| `CREATE_EDGE_PROBABILITY` | `0.08` | Probability of creating an edge (8%) |
| `LOCK_PROBABILITY` | `0.05` | Probability of locking/unlocking (5%) |

> **Note:** Probabilities should sum to ≤ 1.0. `BOT_DURATION` is automatically calculated from `TEST_DURATION`.

#### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_PORT` | `3001` | Backend WebSocket server port |
| `FRONTEND_PORT` | `5173` | Frontend dev server port |
| `MONGO_URL` | `mongodb://localhost:27017/rosetta-editor` | MongoDB connection string |
| `SKIP_SERVER_START` | `false` | Skip starting servers (use existing) |


### Test Configuration Reference

| npm Script | Bots | Duration | Initial Nodes | Purpose |
|------------|------|----------|---------------|---------|
| `npm test` | 10 | 60s | 5 | Default balanced test |
| `npm run test:quick` | 5 | 30s | 3 | Quick smoke test |
| `npm run test:medium` | 20 | 60s | 10 | Regular testing |
| `npm run test:heavy` | 50 | 120s | 20 | Heavy load testing |
| `npm run test:stress` | 100 | 60s | 30 | Extreme stress test |
| `npm run test:create` | 20 | 60s | 5 | Node creation focus (40% create) |
| `npm run test:modify` | 15 | 60s | 20 | Modification only (no create/delete) |
| `npm run test:endurance` | 30 | 600s (10m) | 15 | Long-running stability test |
| `npm run test:ci` | 20 | 60s | 5 | CI/CD (servers pre-started) |

### Example Configurations

All common configurations are available as npm scripts:

```bash
cd scripts/load-test

# Quick smoke test (5 bots, 30s)
npm run test:quick

# Medium test (20 bots, 60s) - good for regular testing
npm run test:medium

# Heavy load (50 bots, 2 min) - stress testing
npm run test:heavy

# Extreme stress (100 bots, 60s)
npm run test:stress

# Focus on creation operations
npm run test:create

# Focus on modification operations only
npm run test:modify

# Long-running endurance test (10 minutes)
npm run test:endurance

# CI/CD (assumes servers already running)
npm run test:ci
```

#### Custom Configuration (Advanced)

For custom scenarios not covered by npm scripts:

```bash
cd scripts/load-test

# Custom: Ultra-heavy load with custom probabilities
BOT_COUNT=150 \
TEST_DURATION=180 \
INITIAL_NODE_COUNT=50 \
CREATE_NODE_PROBABILITY=0.25 \
DELETE_NODE_PROBABILITY=0.15 \
MOVE_PROBABILITY=0.35 \
LABEL_UPDATE_PROBABILITY=0.25 \
./run-load-test.sh
```

## Bot Behavior

The swarm bots simulate realistic collaborative editing:

### Operations (Probabilistic)

The bot behavior is carefully balanced to prevent node accumulation while still creating realistic collaborative load:

- **15%** - **Create a new node** (topic or subtopic)
- **8%** - **Create an edge** between two random nodes
- **40%** - **Move a node** to a new position (most common operation)
- **20%** - **Update a node's label**
- **5%** - **Lock/unlock a node** (simulating modal editing)
- **12%** - **Delete a random node** (keeps minimum 3 nodes)

This configuration creates a near 1:1 balance between node creation (15%) and deletion (12%), with emphasis on modifying existing nodes (60% of operations) rather than creating new ones. This prevents unbounded node accumulation during long tests while maintaining realistic collaborative activity.

### Collaborative Features

- ✓ Awareness protocol (cursor position, user presence)
- ✓ Heartbeat mechanism (15-second intervals)
- ✓ Lock acquisition and release
- ✓ Random jitter to avoid synchronization

### Test Mode Authentication

Bots use the test endpoint authentication:
- Query params: `testUser`, `testName`, `testCommunity`
- No production auth required
- Works in `NODE_ENV=development` only

## Performance Metrics

### Frontend Performance Monitoring

The frontend includes a `PerformanceMonitor` component that automatically collects and displays performance metrics during load tests. The component:

- **Automatically activates** in test mode (when using test routes)
- **Displays real-time metrics** in a UI overlay (bottom-right corner)
- **Sends metrics to backend** via `/api/metrics` endpoint for aggregation
- **Tracks**: FPS, memory usage, Yjs metrics, rendering performance, and latencies

To view metrics during a load test:
1. Open the test page: `http://localhost:5173/studio/test/editor/TestCommunity/perf-test-room`
2. The PerformanceMonitor overlay will appear automatically in the bottom-right corner
3. Metrics are also sent to the backend for aggregation

> **Note:** React StrictMode has been disabled in `main.tsx` to prevent duplicate WebSocket connections during load testing. StrictMode's double-mounting behavior can cause connection race conditions with Yjs providers.

### Terminal Metrics Display

After the test completes, comprehensive metrics are displayed in the terminal:

```
════════════════════════════════════════════════════════════
                    Performance Metrics
════════════════════════════════════════════════════════════

Test Duration: 60s (12 samples)

FPS (Frames Per Second):
  Average: 58 | Min: 45 | Max: 60

Memory Usage:
  Average: 87.5 MB | Peak: 92.3 MB

Collaboration:
  Nodes: 48 (avg) | Edges: 12 (avg)
  Users: 11 (avg) | Peak Users: 11
  Total Yjs Updates: 342

Latency:
  Yjs → React: 12.5 ms
  React → DOM: 8.3 ms

════════════════════════════════════════════════════════════
```

Metrics are also saved to a timestamped JSON file: `load-test-metrics-YYYYMMDD-HHMMSS.json`

### Backend Metrics

The load test collects metrics via the backend API endpoint `/api/metrics/summary`:

- **FPS**: Frame rate performance (avg, min, max)
- **Memory**: Heap usage in MB (avg, peak)
- **Collaboration**: Node/edge counts, connected users
- **Yjs Updates**: Total CRDT operations
- **Latency**: Yjs→React and React→DOM propagation times

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Testing

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  load-test:
    runs-on: ubuntu-latest

    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Start Backend
        run: |
          cd services/backend-editor
          npm run dev &
          sleep 10

      - name: Start Frontend
        run: |
          npm run dev -w apps/frontend-editor &
          sleep 10

      - name: Run Load Tests
        run: |
          cd scripts/load-test
          npm run test:ci

      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: |
            test-results/
            bots.log
```

### Azure DevOps Example

```yaml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'

  - script: npm install
    displayName: 'Install dependencies'

  - script: |
      docker run -d -p 27017:27017 mongo:7
      sleep 5
    displayName: 'Start MongoDB'

  - script: |
      cd scripts/load-test
      npm run test:medium
    displayName: 'Run Load Tests'

  - task: PublishBuildArtifacts@1
    condition: always()
    inputs:
      pathToPublish: 'bots.log'
      artifactName: 'load-test-results'
```

## Interpreting Results

### Success Criteria

✓ Bots connect successfully
✓ No connection errors
✓ Operations complete without errors
✓ Backend remains responsive
✓ Frontend FPS ≥ 30 (visible in PerformanceMonitor overlay)
✓ Memory usage stays reasonable (visible in PerformanceMonitor overlay)

### Common Issues

#### Connection Failures
- MongoDB not running
- Port conflicts
- Firewall blocking WebSocket

## Data Cleanup

The load test automatically manages test data to ensure clean, reproducible results:

### Automatic Cleanup

The script performs cleanup at **both the beginning and end** of each test:

1. **Pre-test cleanup:**
   - Kills any orphaned bot processes from previous runs
   - Clears the test room from MongoDB
   - Clears accumulated performance metrics

2. **Post-test cleanup:**
   - Stops bot processes gracefully (or forcefully after timeout)
   - Clears the test room from MongoDB
   - Clears performance metrics

### Manual Cleanup

If needed, you can manually clean up test data:

```bash
# Kill all bot processes
pkill -9 -f "swarm-bot.js"

# Clear MongoDB test room
curl -X DELETE "http://localhost:3001/api/metrics/cleanup-room?room=TestCommunity/perf-test-room"

# Clear metrics
curl -X DELETE "http://localhost:3001/api/metrics"

# Or use MongoDB directly
mongosh mongodb://localhost:27017/rosetta-editor
db.getCollection('yjs-documents').deleteOne({ _id: 'TestCommunity/perf-test-room' })
```

### Important: Browser Cache

When testing, always **close browser tabs** before running cleanup. The browser caches the Yjs document in memory, so you need a **fresh tab** to see the cleaned state:

1. Close all tabs with the test room
2. Run cleanup (manual or via test script)
3. Open a **new tab** to the test URL

## Troubleshooting

### Seeing Old/Accumulated Nodes

**Problem:** Canvas shows 1000+ nodes even after cleanup

**Cause:** Browser has the old document cached in memory

**Solution:**
1. Close the browser tab completely
2. Run: `curl -X DELETE "http://localhost:3001/api/metrics/cleanup-room?room=TestCommunity/perf-test-room"`
3. Open a fresh browser tab
4. Should start with 0 nodes

### Bots Multiplying During Test

**Problem:** Bot count grows exponentially (10 → 20 → 30+) during a single test

**Causes:**
1. React StrictMode causing duplicate WebSocket connections (fixed - StrictMode now disabled)
2. Old bot processes from previous tests still running
3. Multiple terminal sessions running the test

**Solution:**
```bash
# Kill all bots before starting
pkill -9 -f "swarm-bot.js"

# Verify none are running
pgrep -f "swarm-bot.js"
# (should return nothing)

# Run the test
./scripts/load-test/run-load-test.sh
```

### Bots Won't Connect

```bash
# Check backend is running
curl http://localhost:3001/health

# Check if Docker backend is interfering
docker compose ps
# If backend is running in Docker, stop it:
docker compose stop backend-editor

# Check MongoDB
mongosh --eval "db.adminCommand('ping')"

# Verify NODE_ENV is set (required for test mode auth)
# The script sets this automatically, but if running manually:
NODE_ENV=development npm run dev
```

### Performance Degradation

```bash
# Reduce bot count
BOT_COUNT=5 ./scripts/load-test/run-load-test.sh

# Reduce update frequency
BOT_UPDATE_INTERVAL=5000 ./scripts/load-test/run-load-test.sh

# Check system resources
htop
```

### Metrics Not Showing in Terminal

**Problem:** No metrics displayed after test completes

**Causes:**
1. Browser wasn't opened during the test
2. PerformanceMonitor didn't activate (check console)
3. Metrics endpoint not responding

**Solution:**
```bash
# Verify jq is installed (required for formatted output)
brew install jq

# Check if metrics were collected
curl "http://localhost:3001/api/metrics/summary?room=perf-test-room"

# Check browser console for PerformanceMonitor logs
# Should see: [PerformanceMonitor] Collected metrics:
```

## Advanced Usage

### Custom Bot Behaviors

Edit `swarm-bot.js` to implement custom scenarios:

```javascript
// Example: Focus on node creation (stress test CRDT inserts)
const CREATE_NODE_PROBABILITY = 0.60;  // 60% create nodes
const CREATE_EDGE_PROBABILITY = 0.20;  // 20% create edges
const MOVE_PROBABILITY = 0.15;
const LABEL_UPDATE_PROBABILITY = 0.05;

// Example: Focus on modifications only (no creates/deletes)
const CREATE_NODE_PROBABILITY = 0.0;
const DELETE_NODE_PROBABILITY = 0.0;
const MOVE_PROBABILITY = 0.70;
const LABEL_UPDATE_PROBABILITY = 0.30;
```

### Stress Testing Specific Features

```javascript
// Test lock contention
performRandomUpdate() {
  // Always try to lock the same node
  const targetNode = 'topic-0';
  // ... lock logic
}
```


## Dependencies

The load testing suite is **self-contained** with its own `package.json` in `scripts/load-test/`:

### Load Testing Dependencies (scripts/load-test/)
- `yjs` - CRDT library
- `y-websocket` - WebSocket provider for Yjs
- `ws` - WebSocket client for Node.js

Install all with one command:
```bash
./scripts/load-test/install-deps.sh
```

Or manually:
```bash
# Install bot dependencies
cd scripts/load-test
npm install
```

## Metrics Dashboard (Future)

Consider integrating with:
- **Grafana** - Visualize metrics over time
- **Prometheus** - Metrics collection
- **k6** - Additional load testing scenarios

## License

Part of the Rosetta project.
