# Auth-Service Migration Guide

## Overview
This migration completes the refactoring to make `auth-service` the single source of truth for all OAuth/authentication operations. The BE no longer handles OAuth flows directly.

## What Changed

### ✅ Completed

#### auth-service (Port 3002)
- **New OAuth Endpoints:**
  - `GET /auth/login` - Initiates Microsoft OAuth login
  - `GET /auth/callback` - Handles OAuth callback from Microsoft
  - `GET /auth/logout` - Clears authentication cookies
- **Updated:**
  - `POST /api/auth/refresh` - Now sets cookies (not just returns JSON)
- **New Files:**
  - `internal/handler/oauth_handler.go` - OAuth flow handlers
  - `internal/handler/cookie_utils.go` - Cookie management utilities
- **Configuration:** Updated `.env` with `BE_URL` and `ROSETTA_DOMAIN`

#### BE (Port 8080)
- **New Endpoint:**
  - `POST /api/internal/user/sync` - Called by auth-service to create/update users
- **Updated Endpoints (now redirect to auth-service):**
  - `GET /auth/login` → Redirects to `auth-service:3002/auth/login`
  - `GET /callback` → Redirects to `auth-service:3002/auth/callback`
- **Simplified:**
  - `internal/middleware/auth.go` - Removed token refresh logic (only validates now)
- **New File:**
  - `internal/handler/internal_user.go` - User sync endpoint

#### be-editor (Port 3001)
- **No changes needed** - Already uses auth-service correctly ✅

---

## ⚠️ Required Manual Steps

### 1. Update Azure AD Redirect URI

**Current (OLD):**
```
http://localhost:8080/callback
```

**New (REQUIRED):**
```
http://localhost:3002/auth/callback
```

**How to update:**
1. Go to Azure Portal → Azure Active Directory → App Registrations
2. Find your application (Client ID: `55689c46-8192-4982-9c8d-468d2f686322`)
3. Click "Authentication" in the left menu
4. Under "Redirect URIs", **update** the existing URI to:
   ```
   http://localhost:3002/auth/callback
   ```
5. Click "Save"

**Production:** When deploying, update to:
```
https://yourdomain.com/auth/callback
```

### 2. Restart All Services

**Start services in this order:**

```bash
# Terminal 1: Auth Service (MUST start first)
cd auth-service
go run cmd/main.go

# Terminal 2: Main Backend
cd BE
go run cmd/main.go

# Terminal 3: Editor Backend
cd be-editor
npm run dev

# Terminal 4: Editor Frontend
cd fe-editor
npm run dev

# Terminal 5: Main Frontend
cd FE
npm run dev
```

---

## New Architecture Flow

### Login Flow

```
User clicks login
    ↓
FE redirects to BE:8080/auth/login
    ↓
BE redirects to auth-service:3002/auth/login
    ↓
auth-service redirects to Microsoft OAuth
    ↓
User authenticates with Microsoft
    ↓
Microsoft redirects to auth-service:3002/auth/callback
    ↓
auth-service exchanges code for tokens
    ↓
auth-service calls BE:8080/api/internal/user/sync (creates user in DB)
    ↓
auth-service sets HTTP-only cookies
    ↓
auth-service redirects user back to FE
    ↓
✅ User logged in with cookies set
```

### Token Validation (WebSocket)

```
fe-editor opens WebSocket connection
    ↓
Cookies automatically sent in upgrade request
    ↓
be-editor extracts access_token cookie
    ↓
be-editor calls auth-service:3002/api/auth/validate
    ↓
auth-service validates token with Microsoft
    ↓
If valid: WebSocket opens ✅
If invalid: Connection rejected with 4401
```

### Token Refresh

**Frontend handles refresh transparently:**

```javascript
// collaborativeStore.ts handles this automatically
provider.on('connection-error', async (error) => {
  if (error.includes('4401')) {
    // Trigger refresh by calling BE endpoint
    await fetch('http://localhost:8080/api/auth/check', {
      credentials: 'include',
    });
    // BE middleware detects expired token → redirects to auth-service
    // y-websocket automatically reconnects with new cookies
  }
});
```

---

## Environment Variables

### auth-service/.env
```env
PORT=3002
OIDC_ISSUER=1f6e9eec-eeb0-492e-9326-ea74eac39abc
OIDC_CLIENT_ID=55689c46-8192-4982-9c8d-468d2f686322
OIDC_CLIENT_SECRET=_ko8Q~s6Drc6LGWDTv1Lt6bK-SEP7u33Ww5bFadY
OIDC_REDIRECT_URI=http://localhost:3002/auth/callback  # ← Changed!
BE_URL=http://localhost:8080                           # ← New!
ROSETTA_DOMAIN=localhost                               # ← New!
```

### BE/.env
```env
# Existing variables...
AUTH_SERVICE_URL=http://localhost:3002  # ← Should already exist
```

### be-editor/.env
```env
# Existing variables...
AUTH_SERVICE_URL=http://localhost:3002  # ← Should already exist
```

---

## Testing Checklist

### Manual Testing

- [ ] **Login Flow**
  1. Clear all cookies
  2. Visit `http://localhost:5173`
  3. Click login button
  4. Should redirect to Microsoft login
  5. After authenticating, should redirect back to FE
  6. Check cookies in browser DevTools:
     - `access_token` should exist (domain: localhost)
     - `refresh_token` should exist (domain: localhost)

- [ ] **API Requests**
  1. Navigate to learning paths page
  2. Should see learning paths (authenticated)
  3. Check Network tab - requests should have cookies

- [ ] **WebSocket Authentication**
  1. Open collaborative editor
  2. Check Network tab → WS filter
  3. WebSocket connection should show status `101 Switching Protocols`
  4. Should see your name in the avatar list

- [ ] **Token Expiry Handling**
  1. Manually clear `access_token` cookie (keep `refresh_token`)
  2. Try to make an API request
  3. Should automatically refresh and work

- [ ] **Logout**
  1. Visit `http://localhost:3002/auth/logout`
  2. Cookies should be cleared
  3. Redirect to home page

### Automated Testing (Optional)

```bash
# Health checks
curl http://localhost:3002/health  # Should return {"status":"healthy"}
curl http://localhost:8080/        # Should redirect or return HTML
curl http://localhost:3001/health  # (if health endpoint exists)
```

---

## Troubleshooting

### "Authorization code not found"
- **Cause:** Azure AD redirect URI not updated
- **Fix:** Update Azure AD redirect URI to `http://localhost:3002/auth/callback`

### "WebSocket connection fails with 4401"
- **Cause:** Cookies not set or expired
- **Fix:** Login again via `http://localhost:3002/auth/login`

### "Failed to sync user with BE"
- **Cause:** BE not running or internal endpoint not accessible
- **Fix:** Ensure BE is running and `BE_URL` is correct in auth-service `.env`

### "Token validation failed"
- **Cause:** Client ID mismatch or issuer incorrect
- **Fix:** Verify `OIDC_CLIENT_ID` and `OIDC_ISSUER` in auth-service `.env`

---

## Rollback Plan

If something goes wrong, you can rollback to the old architecture:

1. **Revert Azure AD redirect URI** to `http://localhost:8080/callback`
2. **Revert auth-service/.env** `OIDC_REDIRECT_URI` to `http://localhost:8080/callback`
3. **Stop using auth-service** for OAuth flow (keep using for validation only)
4. **Restart BE** - it will handle OAuth flow directly again

---

## Future Improvements

- [ ] Add API key authentication for internal endpoints (user sync)
- [ ] Implement rate limiting on OAuth endpoints
- [ ] Add metrics/logging for auth-service
- [ ] Consider removing legacy BE OAuth handlers entirely
- [ ] Add automated tests for OAuth flow
- [ ] Implement session management in auth-service

---

## Architecture Benefits

### Before (Inconsistent)
- ❌ BE handled OAuth login/callback
- ❌ auth-service only handled validation/refresh
- ❌ Split brain architecture
- ❌ Duplicate OAuth code

### After (Clean)
- ✅ auth-service handles ALL OAuth operations
- ✅ BE only validates tokens (simplified middleware)
- ✅ Single source of truth for authentication
- ✅ Clear separation of concerns
- ✅ Easier to maintain and debug

---

## Support

For issues:
1. Check auth-service logs: `cd auth-service && go run cmd/main.go`
2. Check BE logs for user sync issues
3. Check browser DevTools → Application → Cookies
4. Verify Azure AD redirect URI is correct
