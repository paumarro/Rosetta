#!/bin/bash
# Run all tests across the monorepo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
FAILED=0
PASSED=0
TOTAL=0

# Function to run tests and track results
run_test() {
    local service_name=$1
    local test_command=$2
    local directory=$3
    
    TOTAL=$((TOTAL + 1))
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🧪 Running tests for: ${YELLOW}${service_name}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ -d "$directory" ]; then
        cd "$directory"
        if eval "$test_command"; then
            echo ""
            echo "${GREEN}✅ ${service_name} tests passed${NC}"
            PASSED=$((PASSED + 1))
            cd - > /dev/null
            return 0
        else
            echo ""
            echo "${RED}❌ ${service_name} tests failed${NC}"
            FAILED=$((FAILED + 1))
            cd - > /dev/null
            return 1
        fi
    else
        echo "${YELLOW}⚠️  Directory ${directory} not found, skipping${NC}"
        FAILED=$((FAILED + 1))
        cd - > /dev/null
        return 1
    fi
}

# Get the root directory of the monorepo
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$ROOT_DIR"

echo "🚀 Running all tests in the monorepo..."
echo ""

# Run Node.js/TypeScript tests
run_test "Frontend Editor" "npm test" "apps/frontend-editor"
run_test "Backend Editor" "npm test" "services/backend-editor"

# Run Go tests
run_test "Backend (Go)" "go test ./..." "services/backend"
run_test "Auth Service (Go)" "go test ./..." "services/auth-service"

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total test suites: $TOTAL"
echo "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo "${RED}Failed: $FAILED${NC}"
    echo ""
    echo "${RED}❌ Some tests failed${NC}"
    exit 1
else
    echo "${GREEN}Failed: $FAILED${NC}"
    echo ""
    echo "${GREEN}✅ All tests passed!${NC}"
    exit 0
fi

