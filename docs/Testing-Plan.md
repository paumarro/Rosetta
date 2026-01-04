# Rosetta Testing Plan

## Executive Summary

This document outlines a comprehensive testing strategy for the Rosetta monorepo, a collaborative learning path management platform. The plan follows the **testing pyramid** approach, prioritizing unit tests at the base, integration tests in the middle, and end-to-end tests at the top.

**Current State**: No automated tests implemented (placeholder scripts only).

**Target State**: 80%+ code coverage on critical business logic, comprehensive integration tests for API contracts, and E2E tests for critical user flows.

---

## Table of Contents

1. [Critical Components Analysis](#1-critical-components-analysis)
2. [Testing Strategy by Service](#2-testing-strategy-by-service)
3. [Test Categories & Priorities](#3-test-categories--priorities)
4. [Implementation Roadmap](#4-implementation-roadmap)
5. [Testing Tools & Infrastructure](#5-testing-tools--infrastructure)
6. [Test Data Management](#6-test-data-management)
7. [CI/CD Integration](#7-cicd-integration)

---

## 1. Critical Components Analysis

### Priority 1: Security & Authentication (CRITICAL)

| Component | Location | Risk Level | Why Critical |
|-----------|----------|------------|--------------|
| OIDC Token Validation | `backend/middleware/auth.go`, `backend-editor/middleware/authMiddleware.ts` | **CRITICAL** | Security breach if bypassed |
| CBAC Authorization | `backend/middleware/cbac.go`, `backend-editor/services/cbacService.ts` | **CRITICAL** | Data leakage across communities |
| OAuth Flow | `auth-service/internal/server/handlers.go` | **CRITICAL** | Authentication bypass |
| Token Refresh | `auth-service/internal/server/handlers.go` | HIGH | Session hijacking |
| Service-to-Service Auth | Inter-service REST calls | HIGH | Privilege escalation |

### Priority 2: Core Business Logic (HIGH)

| Component | Location | Risk Level | Why Critical |
|-----------|----------|------------|--------------|
| Learning Path CRUD | `backend/internal/service/learningPath.go` | HIGH | Core functionality |
| User Provisioning | `backend/internal/service/user.go` | HIGH | User data integrity |
| Diagram Orchestration | Backend → Backend-Editor communication | HIGH | Data consistency |
| Community Filtering | Multiple services | HIGH | Access control |
| Favorites Management | `backend/internal/service/learningPath.go` | MEDIUM | User experience |

### Priority 3: Real-Time Collaboration (HIGH)

| Component | Location | Risk Level | Why Critical |
|-----------|----------|------------|--------------|
| WebSocket Connection | `backend-editor/services/yjs.ts` | HIGH | Core editor functionality |
| Yjs Document Sync | `backend-editor/services/yjs.ts` | HIGH | Data loss prevention |
| MongoDB Persistence | `backend-editor/services/diagram.ts` | HIGH | Document durability |
| Conflict Resolution | Yjs CRDT layer | MEDIUM | Data consistency |
| User Presence | `backend-editor` awareness | MEDIUM | UX feature |

### Priority 4: Data Layer (HIGH)

| Component | Location | Risk Level | Why Critical |
|-----------|----------|------------|--------------|
| PostgreSQL Models | `backend/internal/model/*` | HIGH | Data integrity |
| MongoDB Schemas | `backend-editor/models/*` | HIGH | Document structure |
| Database Migrations | GORM auto-migrate | MEDIUM | Schema consistency |
| Cross-Service Data | LP ↔ Diagram relationship | HIGH | Orphaned records |

### Priority 5: Frontend (MEDIUM)

| Component | Location | Risk Level | Why Critical |
|-----------|----------|------------|--------------|
| RequireAuth Wrapper | `frontend/src/wrappers/RequireAuth.tsx` | HIGH | Auth UX |
| Zustand Stores | `frontend/src/store/*` | MEDIUM | State management |
| ReactFlow Editor | `frontend-editor/src/components/*` | MEDIUM | Editor functionality |
| API Client | `frontend/src/api/*` | MEDIUM | Data fetching |

---

## 2. Testing Strategy by Service

### 2.1 Backend (Go)

#### Unit Tests
**Tool**: Go's built-in `testing` package + `testify`

```
services/backend/
├── internal/
│   ├── service/
│   │   ├── user_test.go           # User service tests
│   │   ├── learningPath_test.go   # LP service tests
│   │   ├── community_test.go      # Community service tests
│   │   └── graph_test.go          # Graph API client tests
│   ├── model/
│   │   └── model_test.go          # GORM model validation
│   └── middleware/
│       ├── auth_test.go           # Auth middleware tests
│       └── cbac_test.go           # CBAC middleware tests
└── tests/
    └── integration/
        └── api_test.go            # API integration tests
```

**Test Cases - Authentication Middleware (`auth_test.go`)**:
```go
// Priority: CRITICAL
func TestAuthMiddleware_ValidToken(t *testing.T)
func TestAuthMiddleware_ExpiredToken(t *testing.T)
func TestAuthMiddleware_MalformedToken(t *testing.T)
func TestAuthMiddleware_MissingToken(t *testing.T)
func TestAuthMiddleware_InvalidSignature(t *testing.T)
func TestAuthMiddleware_WrongAudience(t *testing.T)
func TestAuthMiddleware_WrongIssuer(t *testing.T)
```

**Test Cases - CBAC Middleware (`cbac_test.go`)**:
```go
// Priority: CRITICAL
func TestCBAC_AdminAccessAllCommunities(t *testing.T)
func TestCBAC_UserAccessOwnCommunity(t *testing.T)
func TestCBAC_UserDeniedOtherCommunity(t *testing.T)
func TestCBAC_GroupToCommunityMapping(t *testing.T)
func TestCBAC_MissingCommunityHeader(t *testing.T)
func TestCBAC_InvalidCommunityFormat(t *testing.T)
```

**Test Cases - User Service (`user_test.go`)**:
```go
// Priority: HIGH
func TestUserService_GetOrCreateUser_NewUser(t *testing.T)
func TestUserService_GetOrCreateUser_ExistingUser(t *testing.T)
func TestUserService_UpdateUser(t *testing.T)
func TestUserService_AssignCommunity(t *testing.T)
func TestUserService_SyncFromGraph_StaleCache(t *testing.T)
func TestUserService_SyncFromGraph_FreshCache(t *testing.T)
```

**Test Cases - Learning Path Service (`learningPath_test.go`)**:
```go
// Priority: HIGH
func TestLPService_Create_WithSkills(t *testing.T)
func TestLPService_Create_CreatesDiagramInEditor(t *testing.T)
func TestLPService_GetByCommunity_FiltersCorrectly(t *testing.T)
func TestLPService_Delete_DeletesDiagram(t *testing.T)
func TestLPService_AddFavorite(t *testing.T)
func TestLPService_RemoveFavorite(t *testing.T)
func TestLPService_GetFavorites(t *testing.T)
```

#### Integration Tests
**Tool**: `httptest` + test database

```go
// API endpoint integration tests
func TestAPI_GetUser_Authenticated(t *testing.T)
func TestAPI_GetUser_Unauthenticated(t *testing.T)
func TestAPI_CreateLearningPath_Success(t *testing.T)
func TestAPI_CreateLearningPath_CrossCommunityDenied(t *testing.T)
func TestAPI_ListLearningPaths_FiltersByCommunity(t *testing.T)
func TestAPI_DeleteLearningPath_CascadesToDiagram(t *testing.T)
```

### 2.2 Backend-Editor (Node.js/TypeScript)

#### Unit Tests
**Tool**: Vitest (fast, ESM-native, TypeScript-first)

```
services/backend-editor/
├── src/
│   ├── services/
│   │   ├── __tests__/
│   │   │   ├── authService.test.ts      # Auth service tests
│   │   │   ├── cbacService.test.ts      # CBAC tests
│   │   │   ├── diagramService.test.ts   # Diagram CRUD tests
│   │   │   └── yjsService.test.ts       # Yjs persistence tests
│   ├── middleware/
│   │   └── __tests__/
│   │       └── authMiddleware.test.ts   # Auth middleware tests
│   └── models/
│       └── __tests__/
│           └── diagram.test.ts          # Mongoose model tests
└── tests/
    ├── integration/
    │   ├── api.test.ts                  # REST API tests
    │   └── websocket.test.ts            # WebSocket tests
    └── e2e/
        └── collaboration.test.ts        # Multi-user editing
```

**Test Cases - Auth Service (`authService.test.ts`)**:
```typescript
// Priority: CRITICAL
describe('AuthService', () => {
  it('validates token with correct JWKS')
  it('rejects expired token')
  it('rejects token with wrong audience')
  it('extracts user claims correctly')
  it('handles JWKS fetch failure gracefully')
})
```

**Test Cases - CBAC Service (`cbacService.test.ts`)**:
```typescript
// Priority: CRITICAL
describe('CbacService', () => {
  it('maps Azure AD groups to communities')
  it('identifies admin users from ADMIN_EMAILS')
  it('allows admin access to any community')
  it('restricts user to own community')
  it('handles missing community mapping')
  it('handles malformed COMMUNITY_GROUP_MAPPINGS')
})
```

**Test Cases - Diagram Service (`diagramService.test.ts`)**:
```typescript
// Priority: HIGH
describe('DiagramService', () => {
  it('creates diagram with valid structure')
  it('prevents duplicate diagram names')
  it('updates nodes and edges atomically')
  it('deletes diagram by learning path ID')
  it('filters diagrams by community prefix')
})
```

**Test Cases - Yjs Service (`yjsService.test.ts`)**:
```typescript
// Priority: HIGH
describe('YjsService', () => {
  it('persists Yjs updates to MongoDB')
  it('loads existing document from MongoDB')
  it('handles concurrent document edits')
  it('broadcasts updates to connected clients')
  it('cleans up connections on disconnect')
})
```

#### Integration Tests

**WebSocket Integration (`websocket.test.ts`)**:
```typescript
// Priority: HIGH
describe('WebSocket Collaboration', () => {
  it('authenticates WebSocket upgrade request')
  it('rejects unauthorized WebSocket connection')
  it('syncs document state on connection')
  it('broadcasts node addition to all clients')
  it('persists changes after disconnect')
  it('handles server restart recovery')
})
```

### 2.3 Auth Service (Go)

#### Unit Tests

```
services/auth-service/
├── internal/
│   └── server/
│       └── handlers_test.go
└── tests/
    └── integration/
        └── oauth_flow_test.go
```

**Test Cases - OAuth Handlers (`handlers_test.go`)**:
```go
// Priority: CRITICAL
func TestLoginHandler_RedirectsToMicrosoft(t *testing.T)
func TestLoginHandler_IncludesStateParameter(t *testing.T)
func TestCallbackHandler_ExchangesCodeForToken(t *testing.T)
func TestCallbackHandler_SetsSecureCookies(t *testing.T)
func TestCallbackHandler_RejectsInvalidState(t *testing.T)
func TestRefreshHandler_RefreshesExpiredToken(t *testing.T)
func TestRefreshHandler_RejectsInvalidRefreshToken(t *testing.T)
func TestLogoutHandler_ClearsCookies(t *testing.T)
func TestValidateHandler_ValidatesToken(t *testing.T)
```

### 2.4 Frontend (React)

#### Unit Tests
**Tool**: Vitest + React Testing Library

```
apps/frontend/
├── src/
│   ├── components/
│   │   └── __tests__/
│   │       ├── user.test.tsx
│   │       ├── learningPathCard.test.tsx
│   │       └── dashboard.test.tsx
│   ├── store/
│   │   └── __tests__/
│   │       ├── userStore.test.ts
│   │       └── learningPathStore.test.ts
│   ├── wrappers/
│   │   └── __tests__/
│   │       └── RequireAuth.test.tsx
│   └── api/
│       └── __tests__/
│           └── api.test.ts
```

**Test Cases - RequireAuth Wrapper**:
```typescript
// Priority: HIGH
describe('RequireAuth', () => {
  it('renders children when authenticated')
  it('redirects to login when unauthenticated')
  it('shows loading state during auth check')
  it('handles auth check failure gracefully')
})
```

**Test Cases - Zustand Stores**:
```typescript
// Priority: MEDIUM
describe('userStore', () => {
  it('fetches and stores current user')
  it('clears user on logout')
  it('handles fetch error')
})

describe('learningPathStore', () => {
  it('fetches learning paths')
  it('adds learning path to store')
  it('removes learning path from store')
  it('toggles favorite status')
})
```

### 2.5 Frontend-Editor (React + Yjs)

#### Unit Tests

```
apps/frontend-editor/
├── src/
│   ├── components/
│   │   └── __tests__/
│   │       ├── NodeModal.test.tsx
│   │       ├── TopicNode.test.tsx
│   │       └── Toolbar.test.tsx
│   ├── hooks/
│   │   └── __tests__/
│   │       └── useCollaboration.test.ts
│   └── store/
│       └── __tests__/
│           └── collaborativeStore.test.ts
```

**Test Cases - Collaborative Store**:
```typescript
// Priority: HIGH
describe('collaborativeStore', () => {
  it('initializes Yjs document')
  it('syncs nodes from Yjs to local state')
  it('propagates local changes to Yjs')
  it('handles remote node additions')
  it('handles remote node deletions')
  it('tracks user presence')
})
```

---

## 3. Test Categories & Priorities

### Phase 1: Security Foundation (Week 1-2)

| Test Suite | Service | Priority | Coverage Target |
|------------|---------|----------|-----------------|
| Auth Middleware | backend | CRITICAL | 100% |
| CBAC Middleware | backend | CRITICAL | 100% |
| Auth Middleware | backend-editor | CRITICAL | 100% |
| CBAC Service | backend-editor | CRITICAL | 100% |
| OAuth Handlers | auth-service | CRITICAL | 100% |

### Phase 2: Business Logic (Week 3-4)

| Test Suite | Service | Priority | Coverage Target |
|------------|---------|----------|-----------------|
| User Service | backend | HIGH | 90% |
| LP Service | backend | HIGH | 90% |
| Community Service | backend | HIGH | 90% |
| Diagram Service | backend-editor | HIGH | 90% |
| Graph Service | backend | HIGH | 80% |

### Phase 3: Data Layer (Week 5)

| Test Suite | Service | Priority | Coverage Target |
|------------|---------|----------|-----------------|
| GORM Models | backend | HIGH | 80% |
| Mongoose Models | backend-editor | HIGH | 80% |
| Cross-service Data | integration | HIGH | 80% |

### Phase 4: Real-Time Features (Week 6)

| Test Suite | Service | Priority | Coverage Target |
|------------|---------|----------|-----------------|
| Yjs Service | backend-editor | HIGH | 80% |
| WebSocket Handlers | backend-editor | HIGH | 80% |
| Collaboration E2E | integration | MEDIUM | 70% |

### Phase 5: Frontend (Week 7-8)

| Test Suite | Service | Priority | Coverage Target |
|------------|---------|----------|-----------------|
| RequireAuth | frontend | HIGH | 90% |
| Zustand Stores | frontend | MEDIUM | 80% |
| Components | frontend | MEDIUM | 70% |
| Editor Components | frontend-editor | MEDIUM | 70% |

---

## 4. Implementation Roadmap

### Milestone 1: Test Infrastructure Setup

**Deliverables**:
- [ ] Configure Vitest for `backend-editor`
- [ ] Configure Vitest for `frontend` and `frontend-editor`
- [ ] Set up Go test infrastructure with testify
- [ ] Create test database configuration (PostgreSQL, MongoDB)
- [ ] Set up mock OIDC provider for auth testing
- [ ] Configure code coverage reporting

**Files to Create/Modify**:
```
services/backend-editor/vitest.config.ts
services/backend-editor/src/test/setup.ts
apps/frontend/vitest.config.ts
apps/frontend-editor/vitest.config.ts
services/backend/Makefile  # Add test targets
docker-compose.test.yml     # Test databases
```

### Milestone 2: Security Tests

**Deliverables**:
- [ ] Backend auth middleware tests
- [ ] Backend CBAC middleware tests
- [ ] Backend-editor auth middleware tests
- [ ] Backend-editor CBAC service tests
- [ ] Auth-service OAuth flow tests
- [ ] Token validation edge cases

### Milestone 3: Business Logic Tests

**Deliverables**:
- [ ] User service complete test suite
- [ ] Learning path service complete test suite
- [ ] Community service tests
- [ ] Diagram service tests
- [ ] Graph API client tests (with mocked Microsoft Graph)

### Milestone 4: Integration Tests

**Deliverables**:
- [ ] Backend API integration tests
- [ ] Backend-editor API integration tests
- [ ] Cross-service integration tests (LP creation → Diagram creation)
- [ ] WebSocket integration tests

### Milestone 5: E2E Tests

**Deliverables**:
- [ ] User login flow
- [ ] Learning path CRUD flow
- [ ] Collaborative editing with 2+ users
- [ ] Permission denied scenarios

---

## 5. Testing Tools & Infrastructure

### Backend (Go)

| Tool | Purpose |
|------|---------|
| `testing` | Built-in test framework |
| `testify` | Assertions and mocking |
| `httptest` | HTTP handler testing |
| `sqlmock` | Database mocking |
| `go-oidc/mockoidc` | OIDC provider mocking |

**Installation**:
```bash
go get github.com/stretchr/testify
go get github.com/DATA-DOG/go-sqlmock
```

### Backend-Editor & Frontends (TypeScript)

| Tool | Purpose |
|------|---------|
| `vitest` | Test runner (fast, ESM-native) |
| `@testing-library/react` | React component testing |
| `msw` | API mocking |
| `mongodb-memory-server` | In-memory MongoDB |
| `ws` | WebSocket testing |

**Installation**:
```bash
# Backend-Editor
npm install -D vitest @vitest/coverage-v8 mongodb-memory-server msw

# Frontends
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom msw
```

### E2E Tests

E2E testing is not currently configured. Consider adding browser automation tools for end-to-end testing if needed.

---

## 6. Test Data Management

### Test Fixtures

**Location**: Each service has its own fixtures directory

```
services/backend/tests/fixtures/
├── users.json
├── learning_paths.json
├── communities.json
└── tokens.json

services/backend-editor/src/test/fixtures/
├── diagrams.json
├── users.json
└── tokens.json
```

### Database Strategy

| Environment | PostgreSQL | MongoDB |
|-------------|------------|---------|
| Unit Tests | SQLite in-memory / sqlmock | mongodb-memory-server |
| Integration Tests | Dedicated test database | Dedicated test database |
| E2E Tests | Docker Compose test stack | Docker Compose test stack |

### Token Generation

Create a utility to generate valid/invalid test tokens:

```go
// services/backend/tests/helpers/token.go
func GenerateTestToken(claims map[string]interface{}) string
func GenerateExpiredToken() string
func GenerateTokenWithWrongAudience() string
```

```typescript
// services/backend-editor/src/test/helpers/token.ts
export function generateTestToken(claims: Record<string, unknown>): string
export function generateExpiredToken(): string
```

---

## 7. CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.24'
      - name: Run tests
        run: |
          cd services/backend
          go test -v -race -coverprofile=coverage.out ./...
      - name: Upload coverage
        uses: codecov/codecov-action@v4

  backend-editor-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: |
          cd services/backend-editor
          npm ci
      - name: Run tests
        run: |
          cd services/backend-editor
          npm run test:coverage

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install and test frontend
        run: |
          cd apps/frontend
          npm ci
          npm run test:coverage
      - name: Install and test frontend-editor
        run: |
          cd apps/frontend-editor
          npm ci
          npm run test:coverage

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [backend-tests, backend-editor-tests, frontend-tests]
    steps:
      - uses: actions/checkout@v4
      - name: Start services
        run: docker-compose -f docker-compose.test.yml up -d
      - name: Run E2E tests
        run: echo "E2E tests not configured"
```

### Coverage Requirements

| Service | Minimum Coverage | Target Coverage |
|---------|-----------------|-----------------|
| backend (auth/cbac) | 90% | 100% |
| backend (services) | 70% | 90% |
| backend-editor (auth/cbac) | 90% | 100% |
| backend-editor (services) | 70% | 90% |
| frontend (wrappers) | 80% | 90% |
| frontend (components) | 60% | 80% |

### Pre-commit Hooks

Add test execution to Husky hooks:

```bash
# .husky/pre-push
npm run test:affected  # Run tests for changed files only
```

---

## Appendix A: Test File Templates

### Go Unit Test Template

```go
package service_test

import (
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
)

type MockUserRepository struct {
    mock.Mock
}

func (m *MockUserRepository) FindByID(id string) (*model.User, error) {
    args := m.Called(id)
    return args.Get(0).(*model.User), args.Error(1)
}

func TestUserService_GetUser_Success(t *testing.T) {
    // Arrange
    mockRepo := new(MockUserRepository)
    mockRepo.On("FindByID", "user-1").Return(&model.User{ID: "user-1"}, nil)
    service := NewUserService(mockRepo)

    // Act
    user, err := service.GetUser("user-1")

    // Assert
    assert.NoError(t, err)
    assert.Equal(t, "user-1", user.ID)
    mockRepo.AssertExpectations(t)
}
```

### TypeScript Unit Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DiagramService } from '../diagramService'

describe('DiagramService', () => {
  let service: DiagramService
  let mockDiagramModel: any

  beforeEach(() => {
    mockDiagramModel = {
      create: vi.fn(),
      findOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
      deleteOne: vi.fn(),
    }
    service = new DiagramService(mockDiagramModel)
  })

  it('creates diagram with valid structure', async () => {
    // Arrange
    const input = { name: 'test/diagram', nodes: [], edges: [] }
    mockDiagramModel.create.mockResolvedValue({ ...input, _id: '123' })

    // Act
    const result = await service.create(input)

    // Assert
    expect(result.name).toBe('test/diagram')
    expect(mockDiagramModel.create).toHaveBeenCalledWith(input)
  })
})
```

### React Component Test Template

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { RequireAuth } from '../RequireAuth'
import { useUserStore } from '../../store/userStore'

vi.mock('../../store/userStore')

describe('RequireAuth', () => {
  it('renders children when authenticated', async () => {
    // Arrange
    vi.mocked(useUserStore).mockReturnValue({
      user: { id: '1', name: 'Test' },
      isLoading: false,
    })

    // Act
    render(
      <RequireAuth>
        <div>Protected Content</div>
      </RequireAuth>
    )

    // Assert
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects to login when unauthenticated', async () => {
    // Arrange
    const mockNavigate = vi.fn()
    vi.mocked(useUserStore).mockReturnValue({
      user: null,
      isLoading: false,
    })

    // Act
    render(
      <RequireAuth>
        <div>Protected Content</div>
      </RequireAuth>
    )

    // Assert
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/auth/login')
    })
  })
})
```

---

## Appendix B: Security Test Scenarios

### Authentication Bypass Attempts

| Scenario | Expected Result | Priority |
|----------|-----------------|----------|
| No Authorization header | 401 Unauthorized | CRITICAL |
| Empty Bearer token | 401 Unauthorized | CRITICAL |
| Malformed JWT | 401 Unauthorized | CRITICAL |
| Expired token | 401 Unauthorized | CRITICAL |
| Token signed with wrong key | 401 Unauthorized | CRITICAL |
| Token with wrong audience | 401 Unauthorized | CRITICAL |
| Token with wrong issuer | 401 Unauthorized | CRITICAL |
| Forged admin claims | 403 Forbidden | CRITICAL |

### CBAC Bypass Attempts

| Scenario | Expected Result | Priority |
|----------|-----------------|----------|
| Access other community's LP | 403 Forbidden | CRITICAL |
| Access other community's diagram | 403 Forbidden | CRITICAL |
| Forge community header | Ignored (use token) | CRITICAL |
| Non-admin accessing admin endpoint | 403 Forbidden | HIGH |
| User with no community accessing resources | 403 Forbidden | HIGH |

---

## Appendix C: Performance Test Baseline

While not the primary focus, establish baseline performance metrics:

| Endpoint | Expected P95 | Load Test Users |
|----------|--------------|-----------------|
| GET /api/learning-paths | < 200ms | 100 concurrent |
| POST /api/learning-paths | < 500ms | 50 concurrent |
| WebSocket connect | < 100ms | 50 concurrent |
| Yjs sync (1000 nodes) | < 1s | 10 concurrent |

---

## Summary

This testing plan prioritizes security-critical components first, followed by core business logic, data integrity, and finally user-facing features. The estimated implementation timeline is 8 weeks for full coverage, with security tests completed in the first 2 weeks.

**Key Metrics**:
- 100% coverage on authentication/authorization code
- 80%+ coverage on business logic
- 70%+ coverage on UI components
- Zero security vulnerabilities in tested paths
