# ADR-002: Internal Ingress for Backend Services

**Status:** Accepted
**Date:** 2025-12-19
**Decision Makers:** Platform Team

---

## Context

With the nginx reverse proxy (ADR-001) handling all external traffic, we need to configure how backend services communicate within the Azure Container Apps environment.

Azure Container Apps offers two ingress modes:

| Mode | Description | Use Case |
|------|-------------|----------|
| **External** | Publicly accessible via Azure-generated domain | User-facing services |
| **Internal** | Only accessible within the Container Apps environment | Backend services, APIs |

### Problem

When services use external ingress:

1. **Security Risk**: Backend APIs exposed to the internet
2. **HTTPS Overhead**: External ingress forces HTTPS, adding TLS termination overhead for internal calls
3. **Cost**: External ingress may incur additional costs
4. **Complexity**: Need to secure each service individually with authentication

---

## Decision

Configure all backend services with **internal-only ingress**. Only the nginx reverse proxy has external ingress.

| Service | Ingress Type | Internal FQDN |
|---------|--------------|---------------|
| nginx | External | N/A (public domain) |
| frontend | Internal | frontend.internal.purplebay-96c2df34.westeurope.azurecontainerapps.io |
| frontend-editor | Internal | frontend-editor.internal.purplebay-96c2df34.westeurope.azurecontainerapps.io |
| backend | Internal | backend.internal.purplebay-96c2df34.westeurope.azurecontainerapps.io |
| backend-editor | Internal | backend-editor.internal.purplebay-96c2df34.westeurope.azurecontainerapps.io |
| auth-service | Internal | auth-service.internal.purplebay-96c2df34.westeurope.azurecontainerapps.io |

---

## Implementation Details

### Switching to Internal Ingress

```bash
# For each service (except nginx)
az containerapp ingress update \
  --name <service-name> \
  --resource-group rg-rosetta \
  --type internal
```

### Critical: Allow Insecure Traffic

Azure Container Apps internal ingress defaults to requiring HTTPS (`allowInsecure: false`). Since nginx proxies via HTTP internally, this causes **426 Upgrade Required** errors.

**Solution**: Enable insecure (HTTP) traffic for internal services:

```bash
az containerapp ingress update \
  --name <service-name> \
  --resource-group rg-rosetta \
  --allow-insecure
```

### Internal Service Discovery

Azure provides automatic DNS resolution for internal services:

```
<app-name>.internal.<environment-unique-id>.<region>.azurecontainerapps.io
```

All internal traffic goes through **port 80** regardless of the container's target port. Azure's internal load balancer handles port mapping.

**nginx upstream configuration:**
```nginx
upstream be {
    server backend.internal.purplebay-96c2df34.westeurope.azurecontainerapps.io:80;
}
```

---

## Alternatives Considered

### 1. All Services External with Authentication
- **Pros**: Simpler initial setup
- **Cons**: Each service needs authentication, more attack surface
- **Verdict**: Rejected - unnecessary exposure

### 2. Virtual Network Integration
- **Pros**: Network-level isolation
- **Cons**: Additional cost (~$30+/month for VNet), complexity
- **Verdict**: Rejected - overkill for current needs

### 3. Internal Ingress Only (Chosen)
- **Pros**: Simple, secure, no additional cost
- **Cons**: None significant
- **Verdict**: Accepted

---

## Consequences

### Positive

1. **Security**: Backend services not exposed to internet
2. **Simplicity**: Single entry point for all traffic
3. **Performance**: HTTP internally (no TLS overhead for internal calls)
4. **Cost**: No external endpoints for backend services

### Negative

1. **Debugging**: Cannot directly access backend services from outside
   - Mitigation: Use `az containerapp logs show` for debugging
   - Mitigation: Temporarily enable external ingress for debugging

### Neutral

1. **Service Discovery**: Must use full internal FQDNs in nginx config

---

## Verification

Check ingress configuration for all services:

```bash
for app in frontend frontend-editor backend backend-editor auth-service; do
  echo "=== $app ==="
  az containerapp ingress show --name $app --resource-group rg-rosetta \
    --query "{type:type, allowInsecure:allowInsecure}" -o table
done
```

Expected output:
```
Type      AllowInsecure
--------  ---------------
internal  true
```

---

## Related ADRs

- ADR-001: Nginx Reverse Proxy for Single-Domain Architecture
- ADR-003: Cookie-Based Authentication Strategy
