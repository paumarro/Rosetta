#!/bin/bash

###############################################################################
# Install Load Testing Dependencies
#
# This script installs all necessary dependencies for running the load testing
# suite, including Node.js packages for Yjs bot swarm.
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Installing Load Testing Dependencies${NC}"
echo ""

# Get to script directory
cd "$(dirname "$0")"
PROJECT_ROOT="../.."

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo -e "${RED}Error: Node.js 20 or higher is required${NC}"
  echo "Current version: $(node -v)"
  exit 1
fi

echo -e "${GREEN}✓ Node.js version: $(node -v)${NC}"

# Install load testing dependencies (in scripts/load-test)
echo ""
echo "Installing load testing packages (yjs, y-websocket, ws)..."
npm install

# Verify installations
echo ""
echo -e "${BLUE}Verifying installations...${NC}"

# Check yjs
if node -e "require('yjs')" 2>/dev/null; then
  echo -e "${GREEN}✓ yjs installed${NC}"
else
  echo -e "${RED}✗ yjs not found${NC}"
  exit 1
fi

# Check y-websocket
if node -e "require('y-websocket')" 2>/dev/null; then
  echo -e "${GREEN}✓ y-websocket installed${NC}"
else
  echo -e "${RED}✗ y-websocket not found${NC}"
  exit 1
fi

# Check ws
if node -e "require('ws')" 2>/dev/null; then
  echo -e "${GREEN}✓ ws installed${NC}"
else
  echo -e "${RED}✗ ws not found${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✓ All dependencies installed successfully!${NC}"
echo ""
echo "You can now run load tests with:"
echo "  ./run-load-test.sh                    # Full load test"
echo ""
echo "Or run components individually:"
echo "  cd scripts/load-test && npm run bots  # Run bots only"
echo ""
