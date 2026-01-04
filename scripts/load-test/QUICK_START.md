# Load Testing Quick Start

## Installation

```bash
# Install dependencies
./scripts/load-test/install-deps.sh

# Ensure MongoDB is running
# Ensure Docker containers are stopped (if using local backend)
docker compose down
```

## Running Tests

All tests are run from the `scripts/load-test` directory:

```bash
cd scripts/load-test
```

### Quick Reference

| Command | Description |
|---------|-------------|
| `npm test` | Default test (10 bots, 60s) |
| `npm run test:quick` | Quick smoke test (5 bots, 30s) ✅ Recommended for development |
| `npm run test:medium` | Medium load (20 bots, 60s) ✅ Recommended for PR testing |
| `npm run test:heavy` | Heavy load (50 bots, 2 min) |
| `npm run test:stress` | Stress test (100 bots, 60s) |
| `npm run test:create` | Focus on node creation |
| `npm run test:modify` | Focus on modifications only |
| `npm run test:endurance` | Long-running test (30 bots, 10 min) |
| `npm run test:ci` | CI/CD optimized (assumes servers running) |

### Example Workflow

```bash
# 1. Quick smoke test during development
npm run test:quick

# 2. Medium test before creating PR
npm run test:medium

# 3. Heavy load test before merging
npm run test:heavy
```

## What to Expect

1. **Automatic Setup**: Script starts backend/frontend automatically
2. **Browser Prompt**: Open `http://localhost:5173/studio/test/editor/TestCommunity/perf-test-room`
3. **Performance Monitor**: UI overlay appears in bottom-right showing real-time metrics
4. **Terminal Output**: Comprehensive metrics displayed after test completes
5. **Automatic Cleanup**: Test data cleaned from MongoDB

## Interpreting Results

### Success Criteria ✅

- FPS ≥ 30
- Memory usage stable (not growing unbounded)
- No connection errors
- All bots connect successfully

### Warning Signs ⚠️

- FPS < 30 (performance degradation)
- Memory continuously increasing (memory leak)
- Connection errors in bot logs
- Latency > 100ms (Yjs→React or React→DOM)

## Troubleshooting

### Issue: Bots won't connect

```bash
# Check backend
curl http://localhost:3001/health

# Check MongoDB
mongosh --eval "db.adminCommand('ping')"

# Stop Docker backend if running
docker compose stop backend-editor
```

### Issue: Old nodes accumulating

```bash
# Close all browser tabs
# Clear the test room
curl -X DELETE "http://localhost:3001/api/metrics/cleanup-room?room=TestCommunity/perf-test-room"
# Open fresh browser tab
```

### Issue: Bot processes multiplying

```bash
# Kill all bots
pkill -9 -f "swarm-bot.js"

# Verify none running
pgrep -f "swarm-bot.js"
```

## Advanced Usage

### Custom Configuration

```bash
# Custom bot count and duration
BOT_COUNT=30 TEST_DURATION=90 npm test

# Custom bot behavior
CREATE_NODE_PROBABILITY=0.5 \
MOVE_PROBABILITY=0.3 \
npm test
```

### Bots Only (No Orchestration)

```bash
# Just run bots (servers must be running)
npm run bots

# Quick bot test
npm run bots:quick
```

## CI/CD Integration

```yaml
# GitHub Actions
- name: Run Load Tests
  run: |
    cd scripts/load-test
    npm run test:ci
```

## For More Information

- Full documentation: `scripts/load-test/README.md`
- Architecture: `docs/LOAD_TESTING_ARCHITECTURE.md`
- Production guide: `docs/LOAD_TESTING_PRODUCTION.md`
