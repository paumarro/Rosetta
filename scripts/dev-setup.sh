#!/bin/bash
# Development environment setup

echo "🔧 Setting up development environment..."

# Install Go dependencies
echo "📦 Installing Go dependencies..."
cd services/backend && go mod download && cd ../..
cd services/auth-service && go mod download && cd ../..

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
cd services/backend-editor && npm install && cd ../..
cd apps/frontend && npm install && cd ../..
cd apps/frontend-editor && npm install && cd ../..

echo "✅ Development environment ready!"
echo ""
echo "To start all services:"
echo "  docker-compose -f docker/docker-compose.dev.yml up"
