# URL Configuration Guide

This document explains how URLs are configured across the Rosetta platform to avoid hardcoding.

## Overview

The Rosetta platform uses **nginx as a reverse proxy** to route all requests. This means:
- Frontend applications use **relative paths** (e.g., `/api/*`, `/auth/*`, `/editor/*`)
- Backend services use **environment variables** to communicate with each other
- No hardcoded URLs in production code (except fallbacks for local development)

## Nginx Routing

All requests go through nginx on port 80 (or 8080 in some configs):

```
/auth/*    → auth-service:3002
/api/*     → backend:8080  
/editor/*  → be-editor:3001
/studio/*  → fe-editor:5173 (served on port 80 in production)
/*         → frontend:3000 (served on port 80 in production)
```

## Frontend Applications

### FE (Main Frontend)
**Location:** `/FE/src/`

**Rule:** Use relative paths for all internal services

**Examples:**
```typescript
// ✅ CORRECT - Uses relative path
window.location.href = '/auth/logout?redirect=/login';

// ❌ WRONG - Hardcoded URL
window.location.href = 'http://localhost:3002/auth/logout';
```

**Files updated:**
- `FE/src/components/nav-user.tsx` - Uses `/auth/logout`

### fe-editor (Collaborative Editor Frontend)
**Location:** `/fe-editor/src/`

**Rule:** Use relative paths for all internal services

**Examples:**
```typescript
// ✅ CORRECT - Uses relative path (nginx routes / to FE)
window.location.href = '/hub/learning-path';
window.location.href = '/creator/path-design';

// ❌ WRONG - Hardcoded URL
window.location.href = 'http://localhost:3000/hub/learning-path';
```

**Files updated:**
- `fe-editor/src/components/DiagramEditor.tsx` - Uses relative paths for navigation

## Backend Services

Backend services run server-side and need to know actual service locations. They use **environment variables**.

### be-editor (Collaborative Editor Backend)
**Location:** `/be-editor/src/`

**Environment Variables:**
```bash
AUTH_SERVICE_URL=http://auth-service:3002  # In Docker
AUTH_SERVICE_URL=http://localhost:3002     # Local development
```

**Files using env vars:**
- `be-editor/src/services/authService.ts`

**Docker configuration:**
```yaml
# docker-compose.yml
be-editor:
  environment:
    - AUTH_SERVICE_URL=http://auth-service:3002  # Uses Docker service name
```

### BE (Main Backend)
**Location:** `/BE/`

**Environment Variables:**
```bash
EDITOR_BASE_URL=http://be-editor:3001  # In Docker
EDITOR_BASE_URL=http://localhost:3001  # Local development
```

**Files using env vars:**
- `BE/internal/service/learningPath.go`

**Docker configuration:**
```yaml
# docker-compose.yml
backend:
  environment:
    - EDITOR_BASE_URL=http://be-editor:3001  # Uses Docker service name
```

### auth-service (Authentication Service)
**Location:** `/auth-service/`

**Environment Variables:**
```bash
BE_URL=http://backend:8080           # In Docker
ROSETTA_DOMAIN=localhost             # Base domain WITHOUT port (nginx proxy)
OIDC_REDIRECT_URI=http://localhost/auth/callback  # Public URL
```

**Important:** `ROSETTA_DOMAIN` should be set to the nginx proxy domain **without any port number**. The auth-service uses this to redirect users after authentication, ignoring any port numbers from referer headers. This ensures users are redirected to the nginx proxy (port 80) rather than directly exposed service ports (like 3000, 5173, etc.).

**Docker configuration:**
```yaml
# docker-compose.yml
auth-service:
  environment:
    - BE_URL=http://backend:8080
    - ROSETTA_DOMAIN=localhost  # No port! Always use nginx proxy
    - OIDC_REDIRECT_URI=http://localhost/auth/callback
```

## CORS Configuration

CORS is configured to allow requests from nginx and direct access during development.

### be-editor CORS
**File:** `be-editor/src/config/corsConfig.ts`

```typescript
const CORS_ORIGINS = process.env.CORS_ORIGINS || 
  'http://localhost:5173,http://localhost:8080,...'
```

**Docker configuration:**
```yaml
be-editor:
  environment:
    - CORS_ORIGINS=http://localhost:5173,http://localhost:8080
```

### auth-service CORS
**File:** `auth-service/cmd/main.go`

```go
corsConfig.AllowOrigins = []string{
  "http://localhost",      // nginx reverse proxy
  "http://localhost:3000", // FE direct (dev)
  "http://localhost:5173", // fe-editor direct (dev)
  // ... other origins
}
```

## Development vs Production

### Local Development (without Docker)
Services run directly on your machine:
```bash
FE:           http://localhost:3000
fe-editor:    http://localhost:5173
BE:           http://localhost:8080
be-editor:    http://localhost:3001
auth-service: http://localhost:3002
```

**Backend services use:** `http://localhost:PORT`
**Frontend uses:** Relative paths (if accessed via nginx) or direct URLs

### Docker Development (with docker-compose)
All services run in Docker, nginx on port 80:

**Access via:** `http://localhost/` (nginx)
**Backend services use:** Docker service names (`http://auth-service:3002`)
**Frontend uses:** Relative paths

### Production
Similar to Docker setup but with proper domain:

**Access via:** `https://yourdomain.com/`
**Backend services use:** Docker service names
**Frontend uses:** Relative paths
**Environment variables:** Set for production URLs and secrets

## Key Principles

1. **Frontend = Relative Paths**: Browser-based code uses relative paths (e.g., `/api/*`, `/auth/*`)
2. **Backend = Environment Variables**: Server-side code uses env vars for service-to-service communication
3. **No Hardcoded URLs**: All URLs are either relative or from environment variables
4. **Docker Service Names**: In Docker, services communicate using service names (e.g., `http://backend:8080`)
5. **Localhost Fallbacks**: Development fallbacks use `http://localhost:PORT` but should be overridden by env vars
6. **ROSETTA_DOMAIN Without Port**: The auth-service always redirects to ROSETTA_DOMAIN (nginx proxy) without ports, preventing redirects to directly-exposed service ports

## Common Issues

### Issue: Users Redirected to `localhost:3000/login` Instead of `localhost/login`

**Cause:** In development mode, services expose ports directly (e.g., FE on 3000, fe-editor on 5173) for debugging. If a user accesses a service directly via its port and then authenticates, the auth-service might redirect to the wrong port.

**Solution:** The auth-service now **ignores port numbers** from referer headers and always uses `ROSETTA_DOMAIN` without a port. This ensures all redirects go through the nginx proxy.

**Configuration:**
```yaml
auth-service:
  environment:
    - ROSETTA_DOMAIN=localhost  # ✅ Correct - no port
    # ❌ Wrong: localhost:8080, localhost:3000
```

## Checklist for Adding New URLs

When adding a new URL to the codebase:

- [ ] Is this frontend code (runs in browser)?
  - ✅ Use relative path (e.g., `/api/endpoint`)
  - ❌ Don't use `http://localhost:PORT`

- [ ] Is this backend code (runs on server)?
  - ✅ Use environment variable
  - ✅ Provide localhost fallback for development
  - ✅ Add to docker-compose.yml
  - ❌ Don't hardcode service URLs

- [ ] Does this cross service boundaries?
  - ✅ Use Docker service names in docker-compose
  - ✅ Document required environment variable
  - ✅ Update nginx config if needed

## Environment Variable Summary

| Service | Variable | Docker Value | Local Value |
|---------|----------|--------------|-------------|
| be-editor | `AUTH_SERVICE_URL` | `http://auth-service:3002` | `http://localhost:3002` |
| be-editor | `MONGODB_URI` | `mongodb://mongodb:27017/rosetta-editor` | `mongodb://localhost:27017/rosetta-editor` |
| BE | `EDITOR_BASE_URL` | `http://be-editor:3001` | `http://localhost:3001` |
| auth-service | `BE_URL` | `http://backend:8080` | `http://localhost:8080` |
| auth-service | `OIDC_REDIRECT_URI` | `http://localhost/auth/callback` | `http://localhost:3002/auth/callback` |

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [docker/nginx/nginx.docker.conf](../docker/nginx/nginx.docker.conf) - Nginx routing configuration
- [docker-compose.yml](../docker/docker-compose.yml) - Production Docker configuration

