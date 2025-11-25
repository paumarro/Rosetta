# Rosetta - Learning Path Management Platform

A collaborative learning path management system with real-time diagram editing.

## 🏗️ Architecture

This is a **monorepo** containing all Rosetta services and applications.

### Services (Backend)
- **`services/backend`** - Main Go backend (learning paths, users, PostgreSQL)
- **`services/backend-editor`** - Node.js collaborative editor backend (Yjs, MongoDB)
- **`services/auth-service`** - Go authentication service (OAuth/OIDC)

### Applications (Frontend)
- **`apps/frontend`** - Main React application
- **`apps/frontend-editor`** - Collaborative diagram editor (React + Yjs)

### Infrastructure
- **`docker/`** - Docker Compose configurations and nginx
- **`docs/`** - Architecture and API documentation
- **`scripts/`** - Development and deployment scripts

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Go 1.21+
- Node.js 20+
- PostgreSQL 15+
- MongoDB 7+

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://dev.azure.com/carbyte/Carbyte-Academy/_git/Rosetta
   cd Rosetta
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start all services with Docker**
   ```bash
   docker-compose -f docker/docker-compose.dev.yml up
   ```

4. **Or run services individually**
   
   Terminal 1 - Backend:
   ```bash
   cd services/backend
   go run cmd/main.go
   ```
   
   Terminal 2 - Frontend:
   ```bash
   cd apps/frontend
   npm install
   npm run dev
   ```

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [API Documentation](docs/API.md)
- [Authentication Guide](docs/AUTH_SERVICE_MIGRATION_GUIDE.md)

## 🔧 Development Workflow

### Working with Services

Each service maintains its own dependencies:

- Go services: `go.mod` and `go.sum`
- Node.js services: `package.json` and `package-lock.json`

### Making Changes Across Services

Since this is a monorepo, you can make atomic changes across multiple services:

```bash
# Create a feature branch
git checkout -b feature/new-api-endpoint

# Make changes in multiple services
# Edit services/backend/...
# Edit apps/frontend/...

# Commit all changes together
git add .
git commit -m "Add new API endpoint with frontend integration"
git push origin feature/new-api-endpoint
```

## 🏗️ CI/CD

See Azure Pipelines configuration in `.azure-pipelines/`

## 📝 Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run tests: `./scripts/run-tests.sh`
4. Submit a pull request

## 📄 License

[Your License Here]
