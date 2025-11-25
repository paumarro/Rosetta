# Bug Fix: Auth Redirect to Wrong Port

## Problem

When users accessed the editor at `http://localhost/studio/editor/...` through nginx and clicked "Back to Learning Paths", they were redirected to `localhost:3000/login` instead of `localhost/login`.

## Root Cause

### Architecture Context
In development mode (`docker-compose.dev.yml`), services expose their ports directly for debugging:
- FE (frontend): port 3000
- fe-editor: port 5173  
- BE: port 8081
- be-editor: port 3001
- auth-service: port 3002

Users should access everything through **nginx on port 80**, which routes:
- `/` → FE
- `/studio/*` → fe-editor
- `/api/*` → BE
- `/editor/*` → be-editor
- `/auth/*` → auth-service

### The Bug
The auth-service OAuth handler was using the **Referer header** to determine where to redirect users after authentication. This included the port number:

```go
// OLD CODE (BUGGY)
referer := c.GetHeader("Referer")
if parsedReferer, err := url.Parse(referer); err == nil {
    redirectDomain = fmt.Sprintf("%s://%s", parsedReferer.Scheme, parsedReferer.Host)
    // ↑ This preserves the port! If referer is localhost:3000, it stays localhost:3000
}
```

### The Flow
1. User at `http://localhost/studio/editor/test5` (fe-editor via nginx)
2. Clicks "Back to Learning Paths" → navigates to `/hub/learning-path`
3. Browser goes to `http://localhost/hub/learning-path` (FE via nginx)
4. FE checks auth → not authenticated → redirects to `/login`
5. User at `http://localhost/login`
6. **BUT** if the user had previously visited `localhost:3000` directly (FE dev port), or if any cached redirect contained `:3000`, the Referer header would include the port
7. User clicks "Login with SSO" → auth-service captures Referer with `:3000`
8. After OAuth callback, auth-service redirects to `localhost:3000/login` ❌

## The Fix

Modified the auth-service to **always use `ROSETTA_DOMAIN`** without trusting the port from the Referer header:

```go
// NEW CODE (FIXED)
// Use ROSETTA_DOMAIN as the redirect target (don't trust Referer port)
rosettaDomain := os.Getenv("ROSETTA_DOMAIN")
if rosettaDomain == "" {
    rosettaDomain = "localhost"
}

// Determine scheme from referer, default to http
scheme := "http"
referer := c.GetHeader("Referer")
if referer != "" {
    if parsedReferer, err := url.Parse(referer); err == nil && parsedReferer.Scheme != "" {
        scheme = parsedReferer.Scheme
    }
}

redirectDomain := fmt.Sprintf("%s://%s", scheme, rosettaDomain)
// ↑ Port is NOT included! Always redirects to nginx proxy
```

### What Changed
1. **Login handler** (`/auth/login`) - Ignores port from Referer, uses only ROSETTA_DOMAIN
2. **Callback handler** (`/auth/callback`) - Ignores port from state parameter, uses only ROSETTA_DOMAIN  
3. **Logout handler** (`/auth/logout`) - Already correct, no changes needed

## Configuration

Ensure `ROSETTA_DOMAIN` is set **without a port number**:

### ✅ Correct Configuration
```yaml
# docker-compose.yml
auth-service:
  environment:
    - ROSETTA_DOMAIN=localhost  # No port!
```

```bash
# Production
ROSETTA_DOMAIN=yourdomain.com  # No port!
```

### ❌ Wrong Configuration
```yaml
# ❌ DON'T DO THIS
auth-service:
  environment:
    - ROSETTA_DOMAIN=localhost:8080  # Wrong!
    - ROSETTA_DOMAIN=localhost:3000  # Wrong!
```

## Testing

### Before Fix
1. Access `http://localhost/studio/editor/test5`
2. Click "Back to Learning Paths"
3. Navigate to login
4. Click "Login with SSO"
5. After OAuth → Redirected to `localhost:3000/login` ❌

### After Fix
1. Access `http://localhost/studio/editor/test5`
2. Click "Back to Learning Paths"
3. Navigate to login
4. Click "Login with SSO"
5. After OAuth → Redirected to `localhost/login` ✅

## Related Files Modified

1. `auth-service/internal/handler/oauth_handler.go` - Fixed redirect logic
2. `docs/URL_CONFIGURATION.md` - Added documentation about ROSETTA_DOMAIN
3. `fe-editor/src/components/DiagramEditor.tsx` - Already using relative paths ✅
4. `FE/src/components/nav-user.tsx` - Already using relative paths ✅

## Why This Matters

This fix ensures that:
- Users are **always** redirected through the nginx proxy
- Direct port access (3000, 5173, etc.) is only for debugging
- Production deployments work correctly with proper domains
- Cookie sharing works correctly (cookies are set for the domain, not specific ports)
- SSL/TLS works correctly in production (one certificate for the domain, not multiple ports)

## Prevention

To prevent similar issues:
1. Always use `ROSETTA_DOMAIN` for user-facing redirects (without port)
2. Use relative paths in frontend code (e.g., `/auth/login`, not `http://localhost:3000/auth/login`)
3. Only use ports in service-to-service communication (e.g., `http://backend:8080`)
4. Document which environment variables should/shouldn't include ports

## Related Documentation

- [URL_CONFIGURATION.md](./URL_CONFIGURATION.md) - Complete URL configuration guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview

