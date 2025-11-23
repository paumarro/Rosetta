# Auth Service

Centralized authentication and token validation microservice for Rosetta.

## Table of Contents
- [Why This Service Exists](#why-this-service-exists)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)
- [Running](#running)
- [Integration Examples](#integration-examples)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)
- [Design Decisions](#design-decisions)
- [Production Deployment](#production-deployment)
- [Dependencies](#dependencies)
- [Security Notes](#security-notes)
- [Further Reading](#further-reading)

## Why This Service Exists

### The Problem
Before this service, Rosetta had:
- **Duplicate OIDC logic** in BE and potentially be-editor
- **No WebSocket authentication** - anyone could connect to the collaborative editor
- **Guest users** instead of real authenticated identities
- **Hard logouts** after token expiry (60 minutes)
- **Security vulnerability** - no audit trail of who edited what

### The Solution
auth-service provides:
- **Single source of truth** for Microsoft Azure AD / Entra ID authentication
- **Token validation** - verify OIDC ID tokens from Microsoft
- **Token refresh** - exchange refresh tokens for new access tokens
- **Shared by all services** - BE, be-editor, and future services

### Benefits
✅ **No code duplication** - OIDC logic in one place
✅ **Consistent authentication** - all services use the same validation
✅ **Secure WebSockets** - real user authentication for collaborative editing
✅ **Automatic token refresh** - seamless user experience
✅ **Real user identities** - audit trail with actual email addresses
✅ **Easier to maintain** - update OAuth logic once, affects all services

> **See Also**: [Complete Authentication Setup Guide](../AUTHENTICATION_SETUP.md)

## Architecture

### Service Communication
```
┌──────────────────────────────────────────────────────────────┐
│                         Rosetta                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐         ┌──────────────┐         ┌──────────┐ │
│  │   BE    │────1───>│ auth-service │────2───>│Microsoft │ │
│  │ (8080)  │<───4────│   (3002)     │<───3────│  OAuth   │ │
│  └─────────┘         └──────────────┘         └──────────┘ │
│       │ 5. Continue                    ^                    │
│       │    with request                │                    │
│       v                                │                    │
│  ┌─────────┐                    ┌──────┴──────┐            │
│  │   FE    │                    │  be-editor  │            │
│  │ (5173)  │                    │   (3001)    │            │
│  └─────────┘                    └─────────────┘            │
│                                          │                  │
│                                          │ WebSocket        │
│                                          │ with cookies     │
│                                          v                  │
│                                  ┌──────────────┐           │
│                                  │  fe-editor   │           │
│                                  │   (5174)     │           │
│                                  └──────────────┘           │
└──────────────────────────────────────────────────────────────┘
```

**Flow:**
1. BE receives request with access_token cookie
2. BE calls auth-service to validate/refresh token
3. auth-service verifies with Microsoft OIDC provider
4. auth-service returns user info (entra_id, email, name)
5. BE continues processing request with authenticated user

### Complete Rosetta Stack
- **FE** (5173) - Main frontend (React)
- **fe-editor** (5174) - Collaborative editor frontend (React + Yjs)
- **BE** (8080) - Main backend (Go + Gin + PostgreSQL)
- **be-editor** (3001) - Editor backend (Node.js + TypeScript + MongoDB + Yjs)
- **auth-service** (3002) - Authentication service (Go + OIDC)
- **PostgreSQL** - User data, learning paths
- **MongoDB** - Yjs document persistence

## How It Works

### Token Validation Flow
```
User Request → Extract Token → Validate with OIDC → Return User Info
```

**Detailed Steps:**
1. **Extract token** from request (cookie, header, or body)
2. **Verify signature** using Microsoft's public keys (JWKS)
3. **Check expiration** (exp claim)
4. **Validate issuer** (iss claim matches tenant)
5. **Extract claims** (oid=Entra ID, email, name)
6. **Return result** with user information

### Token Refresh Flow
```
Refresh Token → Exchange with Microsoft → New Access Token → Return All Tokens
```

**Detailed Steps:**
1. **Receive refresh token** from request
2. **Call Microsoft token endpoint** with client credentials
3. **Exchange refresh token** for new access token + ID token
4. **Return all tokens** to caller
5. **Caller updates cookies** with new tokens

### Automatic Refresh Integration
The **BE middleware** automatically refreshes tokens:

```
1. Request arrives at BE
2. Extract and verify access token
3. Check expiry: < 5 minutes remaining?
4. If yes:
   a. Get refresh token from cookie
   b. Call auth-service /api/auth/refresh
   c. Update cookies with new tokens
   d. Continue with request
5. If no: Continue with current token
```

**Result**: Users stay logged in seamlessly during long editing sessions (no 60-minute logout!)

## API Endpoints

### POST /api/auth/validate
Validates an OIDC ID token.

**Request (Option 1: JSON Body):**
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Request (Option 2: Authorization Header):**
```http
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request (Option 3: Cookie):**
```http
Cookie: access_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (Success - 200 OK):**
```json
{
  "valid": true,
  "claims": {
    "aud": "your-client-id",
    "iss": "https://login.microsoftonline.com/{tenant}/v2.0",
    "iat": 1699564800,
    "exp": 1699568400,
    "oid": "abc-123-def-456",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "entra_id": "abc-123-def-456",
  "email": "user@example.com",
  "name": "John Doe"
}
```

**Response (Failure - 401 Unauthorized):**
```json
{
  "valid": false,
  "error": "Token verification failed: token is expired"
}
```

### POST /api/auth/refresh
Exchanges a refresh token for new access/ID tokens.

**Request (Option 1: JSON Body):**
```json
{
  "refresh_token": "0.AXgA..."
}
```

**Request (Option 2: Cookie):**
```http
Cookie: refresh_token=0.AXgA...
```

**Response (Success - 200 OK):**
```json
{
  "success": true,
  "access_token": "eyJhbG...",
  "refresh_token": "0.AXgA...",
  "id_token": "eyJhbGci...",
  "expires_in": 3600
}
```

**Response (Failure - 401 Unauthorized):**
```json
{
  "success": false,
  "error": "Token refresh failed with status 400: invalid_grant"
}
```

**Common Failure Reasons:**
- Refresh token expired (24 hours of inactivity)
- Refresh token revoked by user or admin
- Invalid client credentials
- Network error connecting to Microsoft

### GET /health
Health check endpoint for monitoring and load balancers.

**Response (200 OK):**
```json
{
  "status": "healthy"
}
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Server Configuration
PORT=3002                              # Port to listen on

# Microsoft Azure AD / Entra ID Configuration
OIDC_ISSUER=your-tenant-id-here       # Tenant ID or full issuer URL
OIDC_CLIENT_ID=your-client-id-here    # Application (client) ID
OIDC_CLIENT_SECRET=your-secret-here   # Client secret value
OIDC_REDIRECT_URI=http://localhost:8080/callback  # Must match Azure AD config
```

### Getting Azure AD Credentials

1. **Navigate to Azure Portal** → Azure Active Directory → App registrations
2. **Your application** → Overview:
   - Copy **Application (client) ID** → `OIDC_CLIENT_ID`
   - Copy **Directory (tenant) ID** → `OIDC_ISSUER`
3. **Certificates & secrets** → Client secrets → New client secret:
   - Copy the **Value** → `OIDC_CLIENT_SECRET` (⚠️ only shown once!)
4. **Authentication** → Platform configurations:
   - Ensure redirect URI is configured: `http://localhost:8080/callback`

### Configuration Details

| Variable | Purpose | Format | Example |
|----------|---------|--------|---------|
| `PORT` | HTTP server port | Number | `3002` |
| `OIDC_ISSUER` | Microsoft tenant ID | GUID or URL | `12345678-1234-...` or `https://login.microsoftonline.com/{tenant}/v2.0` |
| `OIDC_CLIENT_ID` | Azure AD application ID | GUID | `87654321-4321-...` |
| `OIDC_CLIENT_SECRET` | Azure AD client secret | String | `abc123~def456...` |
| `OIDC_REDIRECT_URI` | OAuth callback URL | URL | `http://localhost:8080/callback` |

**Note**: The service automatically normalizes `OIDC_ISSUER` to the full URL format if you provide just the tenant ID.

## Running

### Development

**Prerequisites:**
- Go 1.21 or higher
- Azure AD application configured (see Configuration)

**Start the service:**
```bash
# Install dependencies
go mod download

# Run with hot reload (using go run)
go run cmd/main.go

# You should see:
# Auth service starting on port 3002
```

**Verify it's running:**
```bash
curl http://localhost:3002/health
# {"status":"healthy"}
```

### Testing Endpoints

**Test validation (with a real token from Microsoft):**
```bash
# Get a token by logging in via BE first, then extract from cookie
curl -X POST http://localhost:3002/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_ID_TOKEN_HERE"}'
```

**Test refresh (with a real refresh token):**
```bash
curl -X POST http://localhost:3002/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "YOUR_REFRESH_TOKEN_HERE"}'
```

### Production Build

**Build binary:**
```bash
# Build for current platform
go build -o auth-service cmd/main.go

# Build for Linux (if on Mac/Windows)
GOOS=linux GOARCH=amd64 go build -o auth-service cmd/main.go

# Run
./auth-service
```

**Build and run with Docker:**
```bash
# Build image
docker build -t rosetta/auth-service:latest .

# Run container
docker run -p 3002:3002 \
  -e OIDC_ISSUER=your-tenant-id \
  -e OIDC_CLIENT_ID=your-client-id \
  -e OIDC_CLIENT_SECRET=your-secret \
  -e OIDC_REDIRECT_URI=http://localhost:8080/callback \
  rosetta/auth-service:latest

# Or with .env file
docker run -p 3002:3002 --env-file .env rosetta/auth-service:latest
```

## Integration Examples

### Backend (Go) - Automatic Token Refresh

**In `BE/internal/middleware/auth.go`:**

```go
// Call auth-service to refresh token
func refreshTokenViaAuthService(refreshToken string) (*TokenRefreshResponse, error) {
    authServiceURL := os.Getenv("AUTH_SERVICE_URL")
    if authServiceURL == "" {
        authServiceURL = "http://localhost:3002"
    }

    reqBody := map[string]string{"refresh_token": refreshToken}
    jsonBody, _ := json.Marshal(reqBody)

    resp, err := http.Post(
        authServiceURL+"/api/auth/refresh",
        "application/json",
        bytes.NewBuffer(jsonBody),
    )
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result TokenRefreshResponse
    json.NewDecoder(resp.Body).Decode(&result)

    if !result.Success {
        return nil, fmt.Errorf("refresh failed: %s", result.Error)
    }

    return &result, nil
}

// In Auth middleware
if shouldRefreshToken(idToken) {
    refreshToken, _ := c.Cookie("refresh_token")
    newTokens, err := refreshTokenViaAuthService(refreshToken)
    if err == nil {
        // Update cookies
        c.SetCookie("access_token", newTokens.AccessToken, 3600, "/", "localhost", true, true)
        c.SetCookie("refresh_token", newTokens.RefreshToken, 86400, "/", "localhost", true, true)
    }
}
```

### be-editor (TypeScript) - WebSocket Authentication

**In `be-editor/src/middleware/wsAuth.ts`:**

```typescript
import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

export async function authenticateWebSocket(
  conn: WebSocket,
  req: IncomingMessage
): Promise<AuthenticatedUser | null> {
  // Extract token from cookies
  const cookies = parseCookies(req.headers.cookie);
  const accessToken = cookies['access_token'];

  if (!accessToken) {
    conn.close(4401, 'Unauthorized: No access token');
    return null;
  }

  // Validate with auth-service
  const response = await fetch('http://localhost:3002/api/auth/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: accessToken }),
  });

  const result = await response.json();

  if (!result.valid) {
    conn.close(4401, 'Unauthorized: Invalid token');
    return null;
  }

  // Return authenticated user
  return {
    entraId: result.entra_id,
    email: result.email,
    name: result.name,
  };
}
```

### Testing with curl

**Get a real token for testing:**

1. Start BE and login via browser
2. Open DevTools → Application → Cookies
3. Copy `access_token` value

**Test validation:**
```bash
TOKEN="eyJhbGc..."

curl -X POST http://localhost:3002/api/auth/validate \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$TOKEN\"}" \
  | jq
```

**Test with Authorization header:**
```bash
curl -X POST http://localhost:3002/api/auth/validate \
  -H "Authorization: Bearer $TOKEN" \
  | jq
```

**Test refresh:**
```bash
REFRESH_TOKEN="0.AXgA..."

curl -X POST http://localhost:3002/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\": \"$REFRESH_TOKEN\"}" \
  | jq
```

## Development Workflow

### Local Development Setup

1. **Clone and setup:**
   ```bash
   cd /path/to/rosetta/auth-service
   cp .env.example .env
   # Edit .env with your Azure AD credentials
   ```

2. **Install dependencies:**
   ```bash
   go mod download
   ```

3. **Run with auto-reload (using air):**
   ```bash
   # Install air
   go install github.com/cosmtrek/air@latest

   # Run
   air
   ```

4. **Or run directly:**
   ```bash
   go run cmd/main.go
   ```

### Debugging

**Enable verbose logging:**
```go
// In cmd/main.go
gin.SetMode(gin.DebugMode)  // Shows all HTTP requests
```

**Check OIDC provider connectivity:**
```bash
# Test if you can reach Microsoft OIDC endpoint
curl https://login.microsoftonline.com/{your-tenant-id}/v2.0/.well-known/openid-configuration
```

**Test with invalid token:**
```bash
curl -X POST http://localhost:3002/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"token": "invalid.token.here"}'

# Should return: {"valid":false,"error":"..."}
```

### Code Structure

```
auth-service/
├── cmd/
│   └── main.go              # Entry point, server setup
├── internal/
│   ├── handler/
│   │   └── auth_handler.go  # HTTP endpoint handlers
│   └── service/
│       └── auth_service.go  # OIDC validation logic
├── .env.example              # Environment template
├── Dockerfile               # Multi-stage Docker build
├── go.mod                   # Go dependencies
├── go.sum                   # Dependency checksums
└── README.md                # This file
```

## Troubleshooting

### Issue: Service won't start - "Failed to initialize OIDC provider"

**Symptoms:**
```
panic: Failed to initialize OIDC provider: ...
```

**Causes & Solutions:**
1. **Invalid `OIDC_ISSUER`**: Check your tenant ID is correct
   ```bash
   # Test the endpoint
   curl https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0/.well-known/openid-configuration
   ```

2. **No internet connection**: Service needs to reach `login.microsoftonline.com`

3. **Firewall blocking outbound HTTPS**: Check corporate firewall rules

### Issue: Token validation always fails

**Symptoms:**
```json
{"valid":false,"error":"Token verification failed: ..."}
```

**Causes & Solutions:**
1. **Wrong `OIDC_CLIENT_ID`**: Token's `aud` claim must match your client ID
   - Decode your token at [jwt.io](https://jwt.io) and check `aud` claim
   - Compare with `OIDC_CLIENT_ID` in your .env

2. **Token expired**: Check the `exp` claim
   - Tokens expire after 60 minutes
   - Get a fresh token

3. **Token from wrong tenant**: Check the `iss` claim
   - Should be `https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0`

### Issue: Token refresh fails with "invalid_grant"

**Symptoms:**
```json
{"success":false,"error":"Token refresh failed with status 400: invalid_grant"}
```

**Causes & Solutions:**
1. **Refresh token expired**: Refresh tokens expire after 24 hours of inactivity
   - Solution: User must log in again

2. **User changed password**: Invalidates all tokens
   - Solution: User must log in again

3. **Token revoked by admin**: Organization policy
   - Solution: User must log in again

### Issue: "Failed to communicate with auth service"

**Symptoms (from BE or be-editor logs):**
```
Failed to communicate with auth service: connection refused
```

**Causes & Solutions:**
1. **auth-service not running**:
   ```bash
   # Check if running
   curl http://localhost:3002/health

   # Start it
   cd auth-service && go run cmd/main.go
   ```

2. **Wrong `AUTH_SERVICE_URL`**: Check BE and be-editor .env files
   ```env
   AUTH_SERVICE_URL=http://localhost:3002  # Should be this
   ```

3. **Docker networking**: Services can't reach each other
   ```bash
   # Use service name instead of localhost in docker-compose
   AUTH_SERVICE_URL=http://auth-service:3002
   ```

### Issue: CORS errors in browser

**Symptoms:**
```
Access to fetch at 'http://localhost:3002/api/auth/validate' from origin
'http://localhost:5173' has been blocked by CORS policy
```

**Solution:**
The service already configures CORS for common origins:
- `http://localhost:5173` (FE)
- `http://localhost:5174` (fe-editor)
- `http://localhost:8080` (BE)
- `http://localhost:3001` (be-editor)

If you need additional origins, modify `cmd/main.go`:
```go
corsConfig.AllowOrigins = []string{
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:8080",
    "http://localhost:3001",
    "http://your-additional-origin:1234",  // Add here
}
```

## Design Decisions

### Why Go Instead of TypeScript?

**Reasons:**
1. **Code reuse**: BE already has working OIDC validation in Go
2. **Performance**: Token validation is CPU-intensive (crypto operations)
3. **Concurrency**: Go's goroutines better for handling many simultaneous validations
4. **Single binary**: Easier deployment than Node.js (no runtime needed)
5. **Type safety**: Go's strict typing catches errors at compile time

**Tradeoff**: be-editor team needs to understand Go, but integration is via REST API so impact is minimal.

### Why Microservice Instead of Shared Library?

**Reasons:**
1. **Language independence**: BE (Go) and be-editor (TypeScript) can both use it
2. **Single deployment**: Update OAuth logic without redeploying all services
3. **Scalability**: Can scale authentication independently of other services
4. **Separation of concerns**: Clear boundary of responsibility

**Tradeoff**: Adds network latency (~5-10ms per validation), but acceptable for auth operations.

### Why Cookie Authentication for WebSockets?

**Reasons:**
1. **Security**: HTTP-only cookies prevent XSS token theft
2. **Automatic**: Browsers send cookies with WebSocket upgrade requests
3. **Consistency**: Same mechanism as REST API authentication

**Tradeoffs**:
- **Can't use custom headers** (WebSocket API limitation)
- **CORS complexity** (but handled by our CORS config)

**Alternatives considered:**
- Query parameters: ❌ Tokens visible in logs
- First message auth: ❌ Connection starts unauthenticated
- Custom protocol: ❌ Too complex, breaks y-websocket library

### Why Automatic Token Refresh in Backend?

**Reasons:**
1. **Simpler frontend**: No JavaScript timers or refresh logic
2. **More secure**: Refresh tokens never exposed to JavaScript
3. **No clock skew**: Server time is authoritative
4. **Transparent**: User doesn't notice refresh happening

**Tradeoff**: Slightly increased latency on first request after expiry (~200ms), but only once per hour.

## Production Deployment

### Docker Deployment

**Build optimized image:**
```bash
docker build -t rosetta/auth-service:v1.0.0 .

# Image size: ~15MB (multi-stage build)
```

**Run in production:**
```bash
docker run -d \
  --name auth-service \
  --restart unless-stopped \
  -p 3002:3002 \
  -e OIDC_ISSUER=${TENANT_ID} \
  -e OIDC_CLIENT_ID=${CLIENT_ID} \
  -e OIDC_CLIENT_SECRET=${CLIENT_SECRET} \
  -e OIDC_REDIRECT_URI=https://yourdomain.com/callback \
  rosetta/auth-service:v1.0.0
```

### Health Checks

**Docker health check:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1
```

**Kubernetes liveness/readiness:**
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3002
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /health
    port: 3002
  initialDelaySeconds: 5
  periodSeconds: 10
```

### Logging and Monitoring

**Structured logging** (add to `cmd/main.go`):
```go
import "github.com/sirupsen/logrus"

log := logrus.New()
log.SetFormatter(&logrus.JSONFormatter{})
log.SetLevel(logrus.InfoLevel)
```

**Metrics to monitor:**
- `/health` endpoint uptime
- Request count per endpoint
- Token validation success rate
- Token refresh success rate
- Response time (p50, p95, p99)
- Error rates by type

**Example Prometheus metrics** (optional):
```go
// Add prometheus metrics
import "github.com/prometheus/client_golang/prometheus"

var (
    validationTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{Name: "auth_validation_total"},
        []string{"status"},
    )
    refreshTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{Name: "auth_refresh_total"},
        []string{"status"},
    )
)
```

### Scaling Considerations

**Stateless design**: Service has no local state, can scale horizontally
```bash
# Run multiple instances
docker run -d -p 3002:3002 --name auth-service-1 ...
docker run -d -p 3003:3002 --name auth-service-2 ...
docker run -d -p 3004:3002 --name auth-service-3 ...

# Use load balancer
nginx → [auth-service-1, auth-service-2, auth-service-3]
```

**Performance**: Each instance can handle ~1000 req/sec on modest hardware

**Caching** (optional optimization):
```go
// Cache OIDC public keys (JWKS) to reduce Microsoft API calls
// Already done by go-oidc library internally
```

### Security Hardening

**Production checklist:**
- [ ] Use HTTPS reverse proxy (Nginx/Traefik)
- [ ] Set `Secure` flag on cookies (requires HTTPS)
- [ ] Rate limiting on endpoints (prevent brute force)
- [ ] Network isolation (auth-service in private subnet)
- [ ] Secrets in vault (not environment variables)
- [ ] Regular dependency updates (`go get -u`)
- [ ] Enable CORS only for known origins
- [ ] Log all authentication failures
- [ ] Set up alerting for high error rates

**Example rate limiting** (using Gin middleware):
```go
import "github.com/gin-contrib/limiter"

// Limit to 100 requests per minute per IP
limiter.NewRateLimiter(time.Minute, 100)
```

## Dependencies

### Core Libraries
- **`gin-gonic/gin`** (v1.9+) - High-performance HTTP web framework
- **`gin-contrib/cors`** (v1.7+) - CORS middleware for cross-origin requests
- **`coreos/go-oidc/v3`** (v3.16+) - Official OIDC client library
- **`joho/godotenv`** (v1.5+) - Load environment variables from .env file

### Transitive Dependencies
- `go-jose/go-jose/v4` - JSON Web Token handling (via go-oidc)
- `golang.org/x/oauth2` - OAuth2 client (via go-oidc)

### Dependency Management

**Update dependencies:**
```bash
go get -u ./...
go mod tidy
```

**Audit for vulnerabilities:**
```bash
go list -m -json all | nancy sleuth
# or
govulncheck ./...
```

## Security Notes

### Token Security
- ✅ All tokens validated against Microsoft's OIDC provider
- ✅ Signature verification using Microsoft's public keys (JWKS)
- ✅ Expiration checked (exp claim)
- ✅ Issuer validated (iss claim)
- ✅ Audience validated (aud claim matches client ID)

### Logging Security
- ✅ Tokens never logged (only their length for debugging)
- ✅ Client secrets never logged
- ✅ Refresh tokens never logged
- ⚠️ User emails logged (for audit trail)

### Network Security
- ✅ CORS configured to allow only specific origins
- ✅ Supports both cookie and header authentication
- ✅ HTTP-only cookies prevent XSS theft
- ⚠️ Use HTTPS in production (set `Secure` cookie flag)

### Input Validation
- ✅ All inputs validated before processing
- ✅ Malformed tokens rejected immediately
- ✅ Empty/missing required fields return 400 Bad Request

### Best Practices Applied
- ✅ Principle of least privilege (service only needs client credentials)
- ✅ Defense in depth (multiple validation layers)
- ✅ Fail securely (defaults to deny on errors)
- ✅ Audit logging (all authentication events logged)

## Further Reading

### Internal Documentation
- [Complete Authentication Setup Guide](../AUTHENTICATION_SETUP.md) - Full architecture explanation
- [BE Integration](../BE/internal/middleware/auth.go) - How BE uses this service
- [be-editor Integration](../be-editor/src/middleware/wsAuth.ts) - WebSocket auth implementation

### External Resources
- [Microsoft Identity Platform Documentation](https://learn.microsoft.com/en-us/azure/active-directory/develop/)
- [OpenID Connect Core Specification](https://openid.net/specs/openid-connect-core-1_0.html)
- [OAuth 2.0 RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [go-oidc Library](https://github.com/coreos/go-oidc)
- [Gin Framework Documentation](https://gin-gonic.com/docs/)

### Security Resources
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [HTTP-Only Cookies](https://owasp.org/www-community/HttpOnly)
- [SameSite Cookie Attribute](https://web.dev/samesite-cookies-explained/)

---

**Questions or Issues?** See the [Troubleshooting](#troubleshooting) section or check the [main authentication documentation](../AUTHENTICATION_SETUP.md).
