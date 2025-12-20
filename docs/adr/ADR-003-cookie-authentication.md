# ADR-003: Cookie-Based Authentication Strategy

**Status:** Accepted
**Date:** 2025-12-19
**Decision Makers:** Platform Team

---

## Context

The Rosetta platform uses Microsoft Entra ID (Azure AD) for authentication via OAuth 2.0/OIDC. After successful authentication, we need to maintain user sessions across multiple frontend applications (frontend, frontend-editor) and backend APIs.

### Authentication Flow

```
User → Microsoft Entra ID → auth-service → Set Cookie → Frontend
                                                ↓
                                    Subsequent requests with cookie
                                                ↓
                              Backend validates cookie → Returns data
```

### Problem

With multiple services on different domains (before ADR-001), cookies set by `auth-service` could not be read by other services due to browser same-origin policy.

```
auth-service.purplebay-xxx.azurecontainerapps.io  → Sets cookie
frontend.purplebay-xxx.azurecontainerapps.io      → Cannot read cookie (different subdomain)
```

---

## Decision

Use **HTTP-only cookies** for authentication tokens, enabled by the single-domain architecture (ADR-001).

### Cookie Configuration

| Attribute | Value | Reason |
|-----------|-------|--------|
| `HttpOnly` | true | Prevents XSS attacks from reading token |
| `Secure` | true | Only sent over HTTPS |
| `SameSite` | Lax | CSRF protection while allowing navigation |
| `Path` | / | Available to all routes |
| `Domain` | (not set) | Defaults to nginx domain |

### Microsoft OAuth Tokens

Microsoft Entra ID tokens (JWT) are large (~2-4KB). This requires special nginx configuration:

```nginx
# In all nginx configs (reverse proxy and SPAs)
client_header_buffer_size 4k;
large_client_header_buffers 8 64k;

# Additionally in reverse proxy for upstream responses
proxy_buffer_size 128k;
proxy_buffers 4 256k;
proxy_busy_buffers_size 256k;
```

**Without these buffers**, nginx returns `400 Bad Request: Request Header Or Cookie Too Large`.

---

## Implementation Details

### auth-service Cookie Setting

The auth-service sets the authentication cookie after successful OAuth callback:

```go
http.SetCookie(w, &http.Cookie{
    Name:     "auth_token",
    Value:    token,
    Path:     "/",
    HttpOnly: true,
    Secure:   true,  // Requires HTTPS
    SameSite: http.SameSiteLaxMode,
    MaxAge:   3600 * 24, // 24 hours
})
```

### Frontend Cookie Reading

Frontends don't read the cookie directly (HttpOnly). Instead, they:
1. Make API requests with `credentials: 'include'`
2. Browser automatically attaches cookies
3. Backend validates the cookie

```typescript
fetch('/api/user', {
    credentials: 'include'  // Send cookies with request
})
```

### Backend Cookie Validation

Backend services validate the cookie on each request:

```go
func validateAuth(r *http.Request) (*User, error) {
    cookie, err := r.Cookie("auth_token")
    if err != nil {
        return nil, ErrUnauthorized
    }
    return validateToken(cookie.Value)
}
```

---

## OAuth Redirect URL Configuration

Microsoft Entra ID must be configured with the callback URL matching the nginx domain:

```
https://nginx.purplebay-96c2df34.westeurope.azurecontainerapps.io/auth/callback
```

### Environment Variables

```bash
# auth-service
OIDC_REDIRECT_URI=https://nginx.purplebay-96c2df34.westeurope.azurecontainerapps.io/auth/callback

# backend (for CORS)
ROSETTA_FE=https://nginx.purplebay-96c2df34.westeurope.azurecontainerapps.io

# frontend/frontend-editor (public domain)
ROSETTA_DOMAIN=nginx.purplebay-96c2df34.westeurope.azurecontainerapps.io
```

---

## Alternatives Considered

### 1. JWT in Authorization Header
- **Pros**: Stateless, standard approach for APIs
- **Cons**: Requires frontend to store token (localStorage vulnerable to XSS), must manually attach to every request
- **Verdict**: Rejected - HttpOnly cookies are more secure

### 2. Session-Based Auth (Server-Side Sessions)
- **Pros**: Easy to invalidate, small cookie size
- **Cons**: Requires session store (Redis), adds complexity and cost
- **Verdict**: Rejected - unnecessary complexity

### 3. Cookie-Based JWT (Chosen)
- **Pros**: Secure (HttpOnly), automatic attachment, works with single domain
- **Cons**: Large cookies (mitigated with nginx buffers)
- **Verdict**: Accepted

---

## Consequences

### Positive

1. **Security**: HttpOnly cookies prevent XSS token theft
2. **Simplicity**: Browser handles cookie attachment automatically
3. **Single Domain**: Cookie works across all services (ADR-001)
4. **CSRF Protection**: SameSite=Lax provides baseline protection

### Negative

1. **Large Headers**: Microsoft tokens require nginx buffer configuration
   - Mitigation: Buffer settings documented and applied
2. **Cookie Size Limits**: ~4KB practical limit per cookie
   - Mitigation: Token compression if needed in future

### Neutral

1. **Token Refresh**: Handled by auth-service, transparent to frontends

---

## Troubleshooting

### 400 Bad Request: Header Too Large

**Symptom**: After login, nginx returns 400 error.

**Cause**: Missing large header buffer configuration.

**Solution**: Add to all nginx configs:
```nginx
client_header_buffer_size 4k;
large_client_header_buffers 8 64k;
```

### Cookie Not Sent Cross-Origin

**Symptom**: API calls don't include auth cookie.

**Cause**: Missing `credentials: 'include'` in fetch calls.

**Solution**: Ensure all API calls include credentials:
```typescript
fetch('/api/endpoint', { credentials: 'include' })
```

### 403 CORS Error

**Symptom**: POST/PUT requests fail with CORS error.

**Cause**: Backend's `ROSETTA_FE` doesn't match nginx domain.

**Solution**: Update backend environment variable:
```bash
az containerapp update --name backend --resource-group rg-rosetta \
  --set-env-vars "ROSETTA_FE=https://nginx.purplebay-96c2df34.westeurope.azurecontainerapps.io"
```

---

## Related ADRs

- ADR-001: Nginx Reverse Proxy for Single-Domain Architecture
- ADR-002: Internal Ingress for Backend Services
