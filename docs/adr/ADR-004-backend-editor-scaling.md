# ADR-004: Backend-Editor Scaling Strategy

**Status:** Accepted
**Date:** 2025-12-20
**Decision Makers:** Platform Team

---

## Context

The backend-editor service handles collaborative diagram editing using Yjs CRDT and WebSocket connections. Unlike stateless REST APIs, collaborative editing requires:

1. **Session affinity**: All users editing the same diagram must connect to the same server
2. **In-memory state**: Yjs document state is held in memory for real-time sync
3. **WebSocket persistence**: Long-lived connections that can't be load-balanced per-request

### The Challenge with Azure Container Apps

ACA's built-in load balancer uses **round-robin** distribution with no support for:
- Sticky sessions
- Consistent hashing
- Custom routing algorithms

```
User A (diagram-123) ──► ACA LB ──► replica-1 ✓
User B (diagram-123) ──► ACA LB ──► replica-2 ✗ (can't see User A's changes!)
```

This breaks collaborative editing when multiple replicas exist.

---

## Decision

Implement a **phased scaling strategy**:

| Phase | Strategy | When to Use | Concurrent Editors |
|-------|----------|-------------|-------------------|
| **Current** | Single Instance | Testing, early production | 2-50 |
| **Growth** | Fixed Replicas with Nginx Sharding | Medium scale | 50-500 |
| **Scale** | Redis State Externalization | Large scale | 500+ |

### Current Implementation: Single Instance

For testing and early production, run backend-editor as a single instance:

```bash
az containerapp update --name backend-editor --resource-group rg-rosetta \
  --min-replicas 1 --max-replicas 1
```

**Characteristics:**
- All users connect to the same instance
- Yjs state works correctly in-memory
- No load balancing complexity
- Supports ~100-500 concurrent WebSocket connections

---

## Scaling Path: Fixed Replicas with Nginx Sharding

When you need more capacity (50+ concurrent editors), deploy 3 separate Container Apps with nginx consistent hashing.

### Step 1: Create Separate Container Apps

```bash
# Get current backend-editor image
IMAGE=$(az containerapp show --name backend-editor --resource-group rg-rosetta \
  --query "properties.template.containers[0].image" -o tsv)

# Get environment variables
ENV_VARS=$(az containerapp show --name backend-editor --resource-group rg-rosetta \
  --query "properties.template.containers[0].env" -o json)

# Create 3 separate instances
for i in 1 2 3; do
  az containerapp create \
    --name be-editor-$i \
    --resource-group rg-rosetta \
    --environment cae-rosetta \
    --image $IMAGE \
    --target-port 3001 \
    --ingress internal \
    --min-replicas 1 \
    --max-replicas 1 \
    --cpu 0.5 --memory 1Gi \
    --env-vars "INSTANCE_ID=be-editor-$i" # Plus other env vars

  # Enable HTTP traffic from nginx
  az containerapp ingress update --name be-editor-$i --resource-group rg-rosetta --allow-insecure
done

# Delete original backend-editor (optional, after testing)
# az containerapp delete --name backend-editor --resource-group rg-rosetta
```

### Step 2: Update nginx.azure.conf

Replace the single upstream with 3 explicit servers:

```nginx
upstream be-editor {
    # URI-based consistent hashing - all users on same diagram go to same server
    hash $request_uri consistent;

    server be-editor-1.internal.purplebay-96c2df34.westeurope.azurecontainerapps.io:80;
    server be-editor-2.internal.purplebay-96c2df34.westeurope.azurecontainerapps.io:80;
    server be-editor-3.internal.purplebay-96c2df34.westeurope.azurecontainerapps.io:80;
}
```

### Step 3: Rebuild and Deploy nginx

```bash
docker build -f docker/nginx/Dockerfile.azure -t rosettaacr.azurecr.io/nginx:v15 docker/nginx
docker push rosettaacr.azurecr.io/nginx:v15
az containerapp update --name nginx --resource-group rg-rosetta --image rosettaacr.azurecr.io/nginx:v15
```

### How Fixed Replicas Works

```
                         nginx (hash $request_uri consistent)
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
      ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
      │ be-editor-1  │        │ be-editor-2  │        │ be-editor-3  │
      │              │        │              │        │              │
      │ diagram-abc  │        │ diagram-def  │        │ diagram-ghi  │
      │ diagram-jkl  │        │ diagram-mno  │        │ diagram-pqr  │
      └──────────────┘        └──────────────┘        └──────────────┘
```

- Nginx hashes the request URI (contains diagram ID)
- All requests for the same diagram go to the same server
- `consistent` keyword minimizes redistribution if a server fails

**Pros:**
- No code changes required
- Predictable routing
- Supports ~1500 concurrent editors (500 per instance)

**Cons:**
- No auto-scaling (fixed at 3 instances)
- Higher base cost (~$15-20/month always running)
- Manual scaling (add be-editor-4, be-editor-5, etc.)

---

## Future Scaling: Redis State Externalization

For 500+ concurrent editors, externalize Yjs state to Redis for true horizontal scaling.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  be-editor replicas (stateless)                             │
│       │         │         │                                  │
│       └────────┬┴─────────┘                                  │
│                │                                              │
│                ▼                                              │
│        ┌──────────────┐                                      │
│        │    Redis     │  ◄── Yjs document state              │
│        │   (Pub/Sub)  │  ◄── Cross-replica sync              │
│        └──────────────┘                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Overview

1. **Add y-redis dependency** to backend-editor:
   ```bash
   npm install y-redis
   ```

2. **Modify Yjs provider** to use Redis persistence:
   ```typescript
   import { RedisPersistence } from 'y-redis'

   const persistence = new RedisPersistence({
     redisOpts: { host: process.env.REDIS_HOST }
   })

   // Instead of in-memory Yjs docs
   const ydoc = persistence.getYDoc(diagramId)
   ```

3. **Configure Redis pub/sub** for cross-replica sync:
   ```typescript
   // When user A makes change on replica-1
   // Redis broadcasts to replica-2, replica-3
   // All connected clients see the change
   ```

4. **Revert to ACA auto-scaling**:
   ```bash
   az containerapp update --name backend-editor --resource-group rg-rosetta \
     --min-replicas 1 --max-replicas 10
   ```

### Redis Requirements

| Tier | Cost/month | Connections | Use Case |
|------|------------|-------------|----------|
| Basic C0 | ~$16 | 256 | Development |
| Standard C1 | ~$50 | 1000 | Production |
| Premium P1 | ~$200 | 7500 | High scale |

### Pros/Cons of Redis State Externalization

**Pros:**
- True horizontal auto-scaling
- Survives replica restarts (state in Redis)
- ACA native scaling works correctly

**Cons:**
- Code changes required
- Redis latency (~1-5ms per operation)
- Additional infrastructure cost
- More complex debugging

---

## Current Configuration

### Load Balancing Strategy

| Service | Strategy | Reason |
|---------|----------|--------|
| backend | ACA round-robin | Stateless REST API |
| backend-editor | Single instance | Stateful WebSocket |
| frontend/frontend-editor | ACA round-robin | Static file serving |
| auth-service | ACA round-robin | Stateless OAuth |

### Why We Removed `least_conn` from nginx

ACA already load-balances internally. Adding nginx `least_conn` creates double load-balancing:

```
# Before (redundant)
Request → nginx (least_conn) → ACA LB (round-robin) → replicas

# After (simplified)
Request → nginx (pass-through) → ACA LB (round-robin) → replicas
```

For single-hostname upstreams (ACA), let ACA handle distribution.

---

## Rate Limiting Configuration

| Endpoint | Zone | Rate | Burst | Purpose |
|----------|------|------|-------|---------|
| `/api/*` | api_limit | 10r/s | 50 | REST API protection |
| `/editor/*` | editor_limit | 10r/s | 30 | Editor API protection |
| `/auth/*` | auth_limit | 5r/s | 10 | OAuth brute-force prevention |
| `/studio/*` | api_limit | 10r/s | 50 | SPA asset protection |

---

## Migration Checklist

### Single Instance → Fixed Replicas (when needed)

- [ ] Create be-editor-1, be-editor-2, be-editor-3 Container Apps
- [ ] Configure environment variables on each
- [ ] Enable `--allow-insecure` on each
- [ ] Update nginx.azure.conf with 3-server upstream
- [ ] Rebuild and deploy nginx
- [ ] Test WebSocket connections to each instance
- [ ] Delete original backend-editor Container App
- [ ] Monitor connection distribution

### Fixed Replicas → Redis State (when needed)

- [ ] Provision Azure Redis Cache (Standard tier minimum)
- [ ] Add y-redis to backend-editor dependencies
- [ ] Implement Redis persistence layer
- [ ] Add Redis connection string to environment
- [ ] Test multi-replica sync locally
- [ ] Deploy updated backend-editor
- [ ] Revert to ACA auto-scaling
- [ ] Remove fixed be-editor-1/2/3 instances
- [ ] Simplify nginx to single upstream

---

## Related ADRs

- ADR-001: Nginx Reverse Proxy for Single-Domain Architecture
- ADR-002: Internal Ingress for Backend Services
- ADR-003: Cookie-Based Authentication Strategy
