# ADR-001: Nginx Reverse Proxy for Single-Domain Architecture

**Status:** Accepted
**Date:** 2025-12-19
**Decision Makers:** Platform Team

---

## Context

The Rosetta platform consists of multiple services that need to be deployed to Azure Container Apps:

| Service | Technology | Purpose |
|---------|------------|---------|
| frontend | React/nginx | Main user interface |
| frontend-editor | React/nginx | Diagram editor SPA |
| backend | Go | Main API |
| backend-editor | Node.js | Collaborative editing API |
| auth-service | Go | OAuth authentication |

### Problem

When deploying with **separate external ingress** per service, each service gets a unique Azure-generated domain:

```
frontend.purplebay-xxx.westeurope.azurecontainerapps.io
frontend-editor.purplebay-xxx.westeurope.azurecontainerapps.io
backend.purplebay-xxx.westeurope.azurecontainerapps.io
auth-service.purplebay-xxx.westeurope.azurecontainerapps.io
```

This creates several issues:

1. **Cookie Sharing**: Authentication cookies set by `auth-service` cannot be read by `backend` (different domains)
2. **CORS Complexity**: Each service needs CORS configuration for every other service
3. **OAuth Redirect**: Microsoft Entra ID callback URL must match the cookie domain
4. **User Experience**: Multiple domains appear in browser, confusing for users

---

## Decision

Deploy an **nginx reverse proxy** as a dedicated Container App with external ingress. All other services use internal-only ingress.

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Azure Container Apps Environment                  │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    nginx (external)                          │   │
│   │                                                              │   │
│   │   /api/*     → backend                                       │   │
│   │   /editor/*  → backend-editor                                │   │
│   │   /studio/*  → frontend-editor                               │   │
│   │   /auth/*    → auth-service                                  │   │
│   │   /*         → frontend                                      │   │
│   └─────────────────────────────────────────────────────────────┘   │
│          │              │              │              │              │
│          ▼              ▼              ▼              ▼              │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│   │ frontend │   │ backend  │   │be-editor │   │   auth   │        │
│   │(internal)│   │(internal)│   │(internal)│   │(internal)│        │
│   └──────────┘   └──────────┘   └──────────┘   └──────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

**Single domain for all services:**
```
https://nginx.purplebay-xxx.westeurope.azurecontainerapps.io
```

---

## Alternatives Considered

### 1. Azure Front Door
- **Pros**: Enterprise-grade, DDoS protection, global CDN
- **Cons**: ~$35/month minimum, complex configuration, overkill for this use case
- **Verdict**: Rejected - too expensive for current scale

### 2. Azure Application Gateway
- **Pros**: Azure-native, WAF capabilities
- **Cons**: ~$20+/month, requires VNet integration, complex setup
- **Verdict**: Rejected - operational complexity not justified

### 3. Extend Frontend nginx
- **Pros**: No additional container, $0 cost
- **Cons**: Mixes concerns, complicates frontend deployment, single point of failure
- **Verdict**: Rejected - violates separation of concerns

### 4. Separate nginx Container App (Chosen)
- **Pros**: Clean separation, familiar technology, ~$10-15/month, flexible routing
- **Cons**: Additional container to manage
- **Verdict**: Accepted - best balance of cost, simplicity, and flexibility

---

## Consequences

### Positive

1. **Single Domain**: All services accessible via one domain
2. **Cookie Sharing**: Auth cookies work across all services automatically
3. **Simplified CORS**: Only nginx domain needs CORS configuration
4. **Security**: Backend services not directly exposed to internet
5. **Flexibility**: Can add rate limiting, caching, custom headers at nginx level
6. **Cost Control**: Only one external ingress (nginx), all others internal

### Negative

1. **Single Point of Failure**: nginx must be highly available (mitigated by replicas)
2. **Additional Container**: One more service to deploy and monitor
3. **Configuration Management**: nginx.conf must stay in sync with routing needs

### Neutral

1. **Performance**: Minimal latency added (~1-2ms per request)
2. **Logging**: Centralized access logs at nginx level

---

## Implementation Details

### nginx Configuration Location
```
docker/nginx/nginx.azure.conf
docker/nginx/Dockerfile.azure
```

### Key Configuration Elements

1. **Large Header Buffers** (for OAuth tokens):
   ```nginx
   client_header_buffer_size 4k;
   large_client_header_buffers 8 64k;
   ```

2. **Internal Service Discovery**:
   ```nginx
   upstream be {
       server backend.internal.purplebay-xxx.westeurope.azurecontainerapps.io:80;
   }
   ```

3. **Rate Limiting**:
   ```nginx
   limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
   ```

4. **WebSocket Support** (for collaborative editing):
   ```nginx
   map $http_upgrade $connection_upgrade {
       default upgrade;
       '' close;
   }
   ```

### Deployment Commands
```bash
# Build and push
docker build -f docker/nginx/Dockerfile.azure -t rosettaacr.azurecr.io/nginx:v1 docker/nginx
docker push rosettaacr.azurecr.io/nginx:v1

# Deploy
az containerapp create \
  --name nginx \
  --resource-group rg-rosetta \
  --environment cae-rosetta \
  --image rosettaacr.azurecr.io/nginx:v1 \
  --target-port 80 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3
```

---

## Related ADRs

- ADR-002: Internal Ingress for Backend Services
- ADR-003: Cookie-Based Authentication Strategy
