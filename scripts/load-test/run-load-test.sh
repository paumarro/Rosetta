#!/bin/bash

###############################################################################
# Load Testing Orchestration Script
#
# This script orchestrates the complete load testing workflow:
# 1. Starts backend and frontend servers (if not running)
# 2. Launches Yjs swarm bots
# 3. Runs load test for specified duration
# 4. Cleans up and reports results
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT=${BACKEND_PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-5173}
MONGO_URL=${MONGO_URL:-"mongodb://localhost:27017/rosetta-editor"}

# Bot configuration
BOT_COUNT=${BOT_COUNT:-10}
BOT_UPDATE_INTERVAL=${BOT_UPDATE_INTERVAL:-2000}
BOT_RAMP_UP=${BOT_RAMP_UP:-5000}
ROOM_NAME=${ROOM_NAME:-"TestCommunity/perf-test-room"}
INITIAL_NODE_COUNT=${INITIAL_NODE_COUNT:-5}

# Bot behavior (probabilities 0.0 - 1.0)
CREATE_NODE_PROBABILITY=${CREATE_NODE_PROBABILITY:-0.15}
DELETE_NODE_PROBABILITY=${DELETE_NODE_PROBABILITY:-0.12}
MOVE_PROBABILITY=${MOVE_PROBABILITY:-0.40}
LABEL_UPDATE_PROBABILITY=${LABEL_UPDATE_PROBABILITY:-0.20}
CREATE_EDGE_PROBABILITY=${CREATE_EDGE_PROBABILITY:-0.08}
LOCK_PROBABILITY=${LOCK_PROBABILITY:-0.05}

# Test configuration
TEST_DURATION=${TEST_DURATION:-60}
BOT_DURATION=$((TEST_DURATION * 1000))  # Convert seconds to milliseconds for bots
SKIP_SERVER_START=${SKIP_SERVER_START:-false}

# PID tracking
BACKEND_PID=""
FRONTEND_PID=""
BOT_PID=""
MONGODB_STARTED=false

# Cleanup function
cleanup() {
  echo -e "\n${YELLOW}Cleaning up...${NC}"

  if [ ! -z "$BOT_PID" ]; then
    echo "Stopping bots (PID: $BOT_PID)..."
    kill $BOT_PID 2>/dev/null || true
    wait $BOT_PID 2>/dev/null || true
  fi

  if [ "$SKIP_SERVER_START" = "false" ]; then
    if [ ! -z "$FRONTEND_PID" ]; then
      echo "Stopping frontend (PID: $FRONTEND_PID)..."
      kill $FRONTEND_PID 2>/dev/null || true
      wait $FRONTEND_PID 2>/dev/null || true
    fi

    if [ ! -z "$BACKEND_PID" ]; then
      echo "Stopping backend (PID: $BACKEND_PID)..."
      kill $BACKEND_PID 2>/dev/null || true
      wait $BACKEND_PID 2>/dev/null || true
    fi
  fi

  # Note: We don't stop MongoDB as it might be used by other services
  if [ "$MONGODB_STARTED" = "true" ]; then
    echo -e "${YELLOW}Note: MongoDB container was started and is still running${NC}"
    echo "Stop it manually with: docker stop docker-mongodb-1"
  fi

  echo -e "${GREEN}Cleanup complete${NC}"
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Helper function to check if port is in use
check_port() {
  local port=$1
  lsof -i :$port -sTCP:LISTEN -t >/dev/null 2>&1
}

# Helper function to wait for service
wait_for_service() {
  local url=$1
  local max_attempts=$2
  local attempt=1

  echo -n "Waiting for $url "
  while [ $attempt -le $max_attempts ]; do
    if curl -s "$url" >/dev/null 2>&1; then
      echo -e " ${GREEN}✓${NC}"
      return 0
    fi
    echo -n "."
    sleep 1
    attempt=$((attempt + 1))
  done

  echo -e " ${RED}✗${NC}"
  return 1
}

# Helper function to check and start MongoDB
ensure_mongodb_running() {
  echo -e "\n${BLUE}[0/4] Checking MongoDB${NC}"

  # Check if MongoDB is running on port 27017
  if lsof -i :27017 -sTCP:LISTEN >/dev/null 2>&1; then
    echo -e "${GREEN}✓ MongoDB is already running${NC}"
    return 0
  fi

  echo -e "${YELLOW}MongoDB not running, attempting to start...${NC}"

  # Try to start existing Docker container
  if docker ps -a --filter "name=docker-mongodb-1" --format "{{.Names}}" | grep -q "docker-mongodb-1"; then
    echo "Starting MongoDB Docker container (docker-mongodb-1)..."
    if docker start docker-mongodb-1 >/dev/null 2>&1; then
      MONGODB_STARTED=true
      sleep 2
      if lsof -i :27017 -sTCP:LISTEN >/dev/null 2>&1; then
        echo -e "${GREEN}✓ MongoDB started successfully${NC}"
        return 0
      fi
    fi
  fi

  # Try alternative container name
  if docker ps -a --filter "name=loadtest-mongodb" --format "{{.Names}}" | grep -q "loadtest-mongodb"; then
    echo "Starting MongoDB Docker container (loadtest-mongodb)..."
    if docker start loadtest-mongodb >/dev/null 2>&1; then
      MONGODB_STARTED=true
      sleep 2
      if lsof -i :27017 -sTCP:LISTEN >/dev/null 2>&1; then
        echo -e "${GREEN}✓ MongoDB started successfully${NC}"
        return 0
      fi
    fi
  fi

  # If no container found, try to create one
  echo "No existing MongoDB container found, creating new one..."
  if docker run -d --name docker-mongodb-1 -p 27017:27017 mongo:7 >/dev/null 2>&1; then
    MONGODB_STARTED=true
    echo "Waiting for MongoDB to be ready..."
    sleep 5
    if lsof -i :27017 -sTCP:LISTEN >/dev/null 2>&1; then
      echo -e "${GREEN}✓ MongoDB started successfully${NC}"
      return 0
    fi
  fi

  echo -e "${RED}✗ Failed to start MongoDB${NC}"
  echo -e "${YELLOW}Please start MongoDB manually:${NC}"
  echo "  - Docker: docker start docker-mongodb-1"
  echo "  - Or use Docker Compose: docker-compose -f docker-compose.loadtest.yml up"
  return 1
}

###############################################################################
# Main Script
###############################################################################

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Load Testing Suite - Rosetta Diagram Editor       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get to project root
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Check if load testing dependencies are installed
if [ ! -d "scripts/load-test/node_modules" ]; then
  echo -e "${YELLOW}Load testing dependencies not found. Installing...${NC}"
  ./scripts/load-test/install-deps.sh
fi

###############################################################################
# Step 0: Ensure MongoDB is Running
###############################################################################

if [ "$SKIP_SERVER_START" = "false" ]; then
  if ! ensure_mongodb_running; then
    exit 1
  fi
fi

###############################################################################
# Step 1: Start Backend (if not running)
###############################################################################

if [ "$SKIP_SERVER_START" = "false" ]; then
  echo -e "\n${BLUE}[1/4] Starting Backend Server${NC}"

  if check_port $BACKEND_PORT; then
    echo -e "${YELLOW}Backend already running on port $BACKEND_PORT${NC}"
  else
    echo "Starting backend-editor on port $BACKEND_PORT..."

    # Set backend environment
    export NODE_ENV=development
    export PORT=$BACKEND_PORT
    export MONGO_URL=$MONGO_URL

    # Start backend in background
    cd services/backend-editor
    npm run dev > ../../backend.log 2>&1 &
    BACKEND_PID=$!
    cd ../..

    echo "Backend PID: $BACKEND_PID"

    # Wait for backend to be ready
    if ! wait_for_service "http://localhost:$BACKEND_PORT/health" 30; then
      echo -e "${RED}Failed to start backend server${NC}"
      echo "Check backend.log for details"
      exit 1
    fi
  fi

  ###############################################################################
  # Step 2: Start Frontend (if not running)
  ###############################################################################

  echo -e "\n${BLUE}[2/4] Starting Frontend Server${NC}"

  if check_port $FRONTEND_PORT; then
    echo -e "${YELLOW}Frontend already running on port $FRONTEND_PORT${NC}"
  else
    echo "Starting frontend-editor on port $FRONTEND_PORT..."

    # Start frontend in background
    (cd apps/frontend-editor && npm run dev) > frontend.log 2>&1 &
    FRONTEND_PID=$!

    echo "Frontend PID: $FRONTEND_PID"

    # Wait for frontend to be ready
    if ! wait_for_service "http://localhost:$FRONTEND_PORT" 60; then
      echo -e "${RED}Failed to start frontend server${NC}"
      echo "Check frontend.log for details"
      exit 1
    fi
  fi
else
  echo -e "\n${YELLOW}Skipping server startup (SKIP_SERVER_START=true)${NC}"
  echo "Assuming servers are already running..."
fi

###############################################################################
# Step 3: Cleanup Previous Test Data
###############################################################################

echo -e "\n${BLUE}[3/6] Cleaning Up Previous Test Data${NC}"

# Kill any existing swarm-bot processes from previous runs
echo "Checking for existing bot processes..."
BOT_COUNT_BEFORE=$(pgrep -f "swarm-bot.js" | wc -l)
echo "Found $BOT_COUNT_BEFORE bot process(es) running"

if [ "$BOT_COUNT_BEFORE" -gt 0 ]; then
  echo "Killing old bot processes..."
  pkill -9 -f "swarm-bot.js" 2>/dev/null || true
  sleep 2

  BOT_COUNT_AFTER=$(pgrep -f "swarm-bot.js" | wc -l)
  if [ "$BOT_COUNT_AFTER" -gt 0 ]; then
    echo -e "${RED}⚠ Warning: Failed to kill all bot processes ($BOT_COUNT_AFTER still running)${NC}"
  else
    echo -e "${GREEN}✓ All old bot processes killed${NC}"
  fi
else
  echo "No old bot processes found"
fi

# Clear MongoDB document for test room
echo "Clearing Yjs document for test room..."
curl -s -X DELETE "http://localhost:$BACKEND_PORT/api/metrics/cleanup-room?room=$ROOM_NAME" | jq '.' || echo "Failed to clear room document"

# Clear performance metrics
echo "Clearing performance metrics..."
curl -s -X DELETE "http://localhost:$BACKEND_PORT/api/metrics" | jq '.' || echo "Failed to clear metrics"

echo -e "${GREEN}✓ Cleanup complete${NC}"

###############################################################################
# Step 4: Launch Swarm Bots
###############################################################################

echo -e "\n${BLUE}[4/6] Launching Swarm Bots${NC}"
echo "Configuration:"
echo "  - Bot Count: $BOT_COUNT"
echo "  - Update Interval: ${BOT_UPDATE_INTERVAL}ms"
echo "  - Ramp-up Period: ${BOT_RAMP_UP}ms"
echo "  - Initial Nodes: $INITIAL_NODE_COUNT"
echo "  - Room: $ROOM_NAME"
echo ""
echo "Bot Behavior:"
echo "  - Create Node: $(echo "$CREATE_NODE_PROBABILITY * 100" | bc)%"
echo "  - Delete Node: $(echo "$DELETE_NODE_PROBABILITY * 100" | bc)%"
echo "  - Move Node: $(echo "$MOVE_PROBABILITY * 100" | bc)%"
echo ""

# Export bot configuration
export WS_URL="ws://localhost:$BACKEND_PORT"
export ROOM_NAME=$ROOM_NAME
export CLIENT_COUNT=$BOT_COUNT
export UPDATE_INTERVAL_MS=$BOT_UPDATE_INTERVAL
export DURATION_MS=$BOT_DURATION
export RAMP_UP_MS=$BOT_RAMP_UP
export INITIAL_NODE_COUNT=$INITIAL_NODE_COUNT
export CREATE_NODE_PROBABILITY=$CREATE_NODE_PROBABILITY
export DELETE_NODE_PROBABILITY=$DELETE_NODE_PROBABILITY
export MOVE_PROBABILITY=$MOVE_PROBABILITY
export LABEL_UPDATE_PROBABILITY=$LABEL_UPDATE_PROBABILITY
export CREATE_EDGE_PROBABILITY=$CREATE_EDGE_PROBABILITY
export LOCK_PROBABILITY=$LOCK_PROBABILITY

# Start bots in background
node scripts/load-test/swarm-bot.js > bots.log 2>&1 &
BOT_PID=$!

echo "Bots PID: $BOT_PID"

# Wait for bots to ramp up
RAMP_UP_SECONDS=$((BOT_RAMP_UP / 1000 + 5))
echo "Waiting ${RAMP_UP_SECONDS}s for bots to connect and stabilize..."
sleep $RAMP_UP_SECONDS

# Check if bots are still running
if ! kill -0 $BOT_PID 2>/dev/null; then
  echo -e "${RED}Bots failed to start!${NC}"
  echo "Check bots.log for details:"
  tail -20 bots.log
  exit 1
fi

# Verify only one bot process is running
RUNNING_PROCESSES=$(pgrep -f "swarm-bot.js" | wc -l)
echo "Bot processes running: $RUNNING_PROCESSES (should be 1)"

if [ "$RUNNING_PROCESSES" -ne 1 ]; then
  echo -e "${YELLOW}⚠ Warning: Expected 1 bot process, found $RUNNING_PROCESSES${NC}"
fi

echo -e "${GREEN}Bots are active and generating load (PID: $BOT_PID)${NC}"

###############################################################################
# Step 5: Run Load Test
###############################################################################

echo -e "\n${BLUE}[5/6] Running Load Test${NC}"
echo ""
echo "Running load test for ${TEST_DURATION} seconds..."
echo ""
echo -e "${YELLOW}=== IMPORTANT: Open browser NOW ===${NC}"
echo ""
echo -e "1. Open: ${GREEN}http://localhost:$FRONTEND_PORT/studio/test/editor/TestCommunity/perf-test-room${NC}"
echo ""
echo "2. Verify in browser console:"
echo "   - sessionStorage.getItem('rosetta_test_mode') should return 'true'"
echo "   - Look for [TestUserProvider] and [PerformanceMonitor] console logs"
echo "   - Check that PerformanceMonitor overlay appears in bottom-right"
echo ""
echo "3. The test will run for ${TEST_DURATION} seconds"
echo "   - Bots will automatically stop after ${TEST_DURATION}s"
echo "   - Keep browser open during entire test"
echo ""
echo -e "${YELLOW}Waiting for test duration...${NC}"

# Wait for test duration
sleep $TEST_DURATION

echo -e "${GREEN}✓ Load test duration complete${NC}"

# Verify bots have stopped
echo ""
echo "Checking bot status..."
sleep 3  # Give bots time to shutdown gracefully

# Check if the tracked PID is still running
if kill -0 $BOT_PID 2>/dev/null; then
  echo -e "${YELLOW}⚠ Bot process (PID: $BOT_PID) still running - forcing shutdown${NC}"
  kill -9 $BOT_PID 2>/dev/null || true
  wait $BOT_PID 2>/dev/null || true
else
  echo -e "${GREEN}✓ Bot process (PID: $BOT_PID) stopped automatically${NC}"
fi

# Check for any lingering swarm-bot processes
LINGERING_BOTS=$(pgrep -f "swarm-bot.js" | wc -l)
if [ "$LINGERING_BOTS" -gt 0 ]; then
  echo -e "${RED}⚠ Found $LINGERING_BOTS lingering bot process(es) - cleaning up${NC}"
  pkill -9 -f "swarm-bot.js" 2>/dev/null || true
  sleep 1
fi

BOT_PID=""
echo -e "${GREEN}✓ All bot processes stopped${NC}"

###############################################################################
# Step 6: Collect and Report Results
###############################################################################

echo -e "\n${BLUE}[6/6] Collecting Performance Metrics${NC}"
echo ""

# Fetch metrics from backend API
METRICS_FILE="load-test-metrics-$(date +%Y%m%d-%H%M%S).json"
if curl -s "http://localhost:$BACKEND_PORT/api/metrics/summary?room=perf-test-room" > "$METRICS_FILE" 2>/dev/null; then
  echo -e "${GREEN}✓ Metrics collected successfully${NC}"
  echo ""

  # Display formatted summary in terminal
  if command -v jq &> /dev/null; then
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                    Performance Metrics                     ${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo ""

    # Extract metrics using jq
    SAMPLE_COUNT=$(cat "$METRICS_FILE" | jq -r '.summary.count // 0')
    DURATION_MS=$(cat "$METRICS_FILE" | jq -r '.summary.duration // 0')
    DURATION_SEC=$((DURATION_MS / 1000))

    FPS_AVG=$(cat "$METRICS_FILE" | jq -r '.summary.fps.avg // 0')
    FPS_MIN=$(cat "$METRICS_FILE" | jq -r '.summary.fps.min // 0')
    FPS_MAX=$(cat "$METRICS_FILE" | jq -r '.summary.fps.max // 0')

    MEM_AVG=$(cat "$METRICS_FILE" | jq -r '.summary.memory.avgUsedMB // 0')
    MEM_MAX=$(cat "$METRICS_FILE" | jq -r '.summary.memory.maxUsedMB // 0')

    NODES_AVG=$(cat "$METRICS_FILE" | jq -r '.summary.yjs.avgNodeCount // 0')
    EDGES_AVG=$(cat "$METRICS_FILE" | jq -r '.summary.yjs.avgEdgeCount // 0')
    UPDATES_TOTAL=$(cat "$METRICS_FILE" | jq -r '.summary.yjs.totalUpdates // 0')

    USERS_AVG=$(cat "$METRICS_FILE" | jq -r '.summary.collaboration.avgConnectedUsers // 0')
    USERS_MAX=$(cat "$METRICS_FILE" | jq -r '.summary.collaboration.maxConnectedUsers // 0')

    LATENCY_YJS=$(cat "$METRICS_FILE" | jq -r '.summary.latency.avgYjsToReact // 0')
    LATENCY_DOM=$(cat "$METRICS_FILE" | jq -r '.summary.latency.avgReactToDom // 0')

    echo -e "${GREEN}Test Duration:${NC} ${DURATION_SEC}s (${SAMPLE_COUNT} samples)"
    echo ""
    echo -e "${GREEN}FPS (Frames Per Second):${NC}"
    echo "  Average: $FPS_AVG | Min: $FPS_MIN | Max: $FPS_MAX"
    echo ""
    echo -e "${GREEN}Memory Usage:${NC}"
    echo "  Average: ${MEM_AVG} MB | Peak: ${MEM_MAX} MB"
    echo ""
    echo -e "${GREEN}Collaboration:${NC}"
    echo "  Nodes: $NODES_AVG (avg) | Edges: $EDGES_AVG (avg)"
    echo "  Users: $USERS_AVG (avg) | Peak Users: $USERS_MAX"
    echo "  Total Yjs Updates: $UPDATES_TOTAL"
    echo ""
    echo -e "${GREEN}Latency:${NC}"
    echo "  Yjs → React: ${LATENCY_YJS} ms"
    echo "  React → DOM: ${LATENCY_DOM} ms"
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Full metrics saved to: $METRICS_FILE"
  else
    echo "Full metrics saved to: $METRICS_FILE"
    echo "(Install 'jq' for formatted output: brew install jq)"
  fi
else
  echo -e "${YELLOW}⚠ No metrics available${NC}"
  echo "Make sure to open the test page in a browser during the load test"
fi

TEST_EXIT_CODE=0

# Display bot statistics
echo ""
echo -e "${BLUE}Bot Activity Summary:${NC}"
if [ -f "bots.log" ]; then
  tail -20 bots.log | grep -E "(Total|Messages|Errors|Bots)" || echo "No bot statistics available"
fi

# Display test report location
echo ""
echo -e "${BLUE}Detailed Reports:${NC}"
echo "  - Bot Logs: bots.log"
if [ "$SKIP_SERVER_START" = "false" ]; then
  echo "  - Backend Logs: backend.log"
  echo "  - Frontend Logs: frontend.log"
fi

###############################################################################
# Final Cleanup: Delete all test data
###############################################################################

echo ""
echo -e "${BLUE}Cleaning up test data...${NC}"

# Clear the test room document from MongoDB
echo "Deleting test room from MongoDB..."
curl -s -X DELETE "http://localhost:$BACKEND_PORT/api/metrics/cleanup-room?room=$ROOM_NAME" > /dev/null 2>&1

# Clear metrics
curl -s -X DELETE "http://localhost:$BACKEND_PORT/api/metrics" > /dev/null 2>&1

echo -e "${GREEN}✓ Test data cleaned up${NC}"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${BLUE}║                 ${GREEN}✓ Load Test Complete${BLUE}                      ║${NC}"
else
  echo -e "${BLUE}║                 ${RED}✗ Load Test Failed${BLUE}                        ║${NC}"
fi
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

exit $TEST_EXIT_CODE
