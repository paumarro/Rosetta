# Learning Path SAGA Tests

> **Last Updated**: December 2025
> **Related Documentation**: [SAGA_PATTERN.md](./SAGA_PATTERN.md)

## Overview

This document describes the comprehensive test suite for the Learning Path SAGA pattern implementation. The tests cover both the Go backend (PostgreSQL) and TypeScript backend-editor (MongoDB) services.

### Test Summary

| Service | Unit Tests | Integration Tests | Total |
|---------|------------|-------------------|-------|
| Go Backend | 9 | 16 | **25** |
| TypeScript Backend-Editor | 11 | 14 | **25** |
| **Total** | **20** | **30** | **50** |

---

## Test Structure

```
services/backend/
└── tests/
    ├── unit/
    │   └── learningpath_test.go      # 9 unit tests (mocked HTTP)
    ├── integration/
    │   └── saga_test.go              # 16 integration tests (real HTTP server)
    └── testutil/
        ├── db.go                     # Database setup helpers
        └── mock_http_client.go       # HTTP client mock

services/backend-editor/
└── tests/
    ├── unit/
    │   └── diagramController.test.ts # 11 unit tests
    ├── integration/
    │   └── diagramWorkflow.test.ts   # 14 integration tests
    └── helpers/
        ├── mongoMemory.ts            # MongoDB memory server setup
        └── testApp.ts                # Express app without auth
```

---

## Running Tests

### Go Backend

```bash
cd services/backend

# Run all tests
go test ./tests/... -v

# Run only unit tests
go test ./tests/unit/... -v

# Run only integration tests
go test ./tests/integration/... -v

# Run with coverage
go test ./tests/... -cover -coverprofile=coverage.out
go tool cover -html=coverage.out
```

### TypeScript Backend-Editor

```bash
cd services/backend-editor

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/unit/diagramController.test.ts
```

---

## Go Backend Tests

### Unit Tests (`tests/unit/learningpath_test.go`)

Unit tests use **mocked HTTP client** to isolate the service logic from external dependencies.

| Test | Description | Validates |
|------|-------------|-----------|
| `TestCreateLearningPath_ValidData_Success` | Creates LP with all fields populated | Full saga flow with skills |
| `TestCreateLearningPath_DuplicateName_ReturnsError` | MongoDB returns 409 for duplicate name | Error propagation from step 1 |
| `TestCreateLearningPath_MongoDBUnavailable_NoOrphanCreated` | MongoDB connection fails | No orphaned LP in PostgreSQL |
| `TestCreateLearningPath_PostgreSQLFails_CompensationRuns` | PostgreSQL constraint violation | Compensation DELETE is called |
| `TestDeleteLearningPath_ValidID_Success` | Deletes existing LP | Full delete saga flow |
| `TestDeleteLearningPath_MongoDBUnavailable_LPRestored` | MongoDB fails during delete | LP is restored (soft-delete reversed) |
| `TestDeleteLearningPath_NotFound_ReturnsError` | LP doesn't exist | No HTTP calls made |
| `TestCreateLearningPath_IdempotentRetry_Returns200` | MongoDB returns 200 (already exists) | Idempotent handling |
| `TestDeleteLearningPath_DiagramNotFound_TreatedAsSuccess` | MongoDB returns 404 | Treated as already deleted |

#### Example: Testing Compensation

```go
func TestCreateLearningPath_PostgreSQLFails_CompensationRuns(t *testing.T) {
    db := testutil.SetupTestDBWithUniqueIndex(t)
    mockHTTP := new(testutil.MockHTTPClient)

    // Pre-create LP to cause unique constraint violation
    existingLP := model.LearningPath{
        ID:        uuid.New(),
        DiagramID: "mongo123", // Same ID we'll try to use
    }
    db.Create(&existingLP)

    // Mock successful diagram creation
    mockHTTP.On("Do", mock.MatchedBy(func(req *http.Request) bool {
        return req.Method == http.MethodPost
    })).Return(testutil.CreateMockHTTPResponse(201, `{"_id":"mongo123"}`), nil).Once()

    // Mock compensation delete
    mockHTTP.On("Do", mock.MatchedBy(func(req *http.Request) bool {
        return req.Method == http.MethodDelete
    })).Return(testutil.CreateMockHTTPResponse(204, ""), nil).Once()

    svc := service.NewLearningPathServiceWithClient(db, mockHTTP, "http://test/api")

    _, err := svc.CreateLearningPath(ctx, "Test", ...)

    require.Error(t, err)
    assert.Contains(t, err.Error(), "saga step 2 failed")
    mockHTTP.AssertExpectations(t) // Verify compensation was called
}
```

### Integration Tests (`tests/integration/saga_test.go`)

Integration tests use a **real HTTP test server** (`httptest.NewServer`) that simulates the backend-editor service.

#### Mock Server Implementation

The `mockMongoServer` simulates MongoDB behavior:

```go
type mockMongoServer struct {
    diagrams      map[string]map[string]interface{}
    mu            sync.RWMutex
    createCount   int32  // Atomic counter
    deleteCount   int32  // Atomic counter
    failOnCreate  bool   // Simulate failures
    failOnDelete  bool
    delayCreate   time.Duration  // Simulate latency
    delayDelete   time.Duration
}
```

#### Test Categories

##### Create Learning Path Tests

| Test | Description |
|------|-------------|
| `TestIntegration_CreateLP_FullSagaFlow` | Complete create flow with skills verification |
| `TestIntegration_CreateLP_PostgreSQLFails_CompensationDeletesMongoDiagram` | Verifies orphan cleanup |
| `TestIntegration_CreateLP_MongoDBFails_NoOrphanInPostgres` | No LP created when MongoDB fails |
| `TestIntegration_CreateLP_ConcurrentRequests_OnlyOneSucceeds` | Race condition handling |

##### Delete Learning Path Tests

| Test | Description |
|------|-------------|
| `TestIntegration_DeleteLP_FullSagaFlow` | Complete delete with hard-delete verification |
| `TestIntegration_DeleteLP_MongoDBFails_LPRestored` | Soft-delete rollback |
| `TestIntegration_DeleteLP_DiagramAlreadyDeleted_TreatedAsSuccess` | 404 is idempotent |

##### Idempotency Tests

| Test | Description |
|------|-------------|
| `TestIntegration_CreateLP_IdempotentRetry` | Duplicate creates return existing |

##### Data Consistency Tests

| Test | Description |
|------|-------------|
| `TestIntegration_CreateLP_SkillsCreatedAndAssociated` | Skill creation and LP-skill associations |
| `TestIntegration_CreateLP_ExistingSkillsReused` | Skills are reused across LPs |
| `TestIntegration_DeleteLP_SkillsRemainForOtherLPs` | Shared skills not deleted |

##### Compensation Failure Tests

| Test | Description |
|------|-------------|
| `TestIntegration_CreateLP_CompensationFails_BothErrorsReported` | Both saga and compensation fail |

##### Input Validation Tests

| Test | Description |
|------|-------------|
| `TestIntegration_DeleteLP_InvalidUUIDFormat` | Invalid UUID handling |
| `TestIntegration_CreateLP_EmptyTitle` | Empty title behavior |
| `TestIntegration_CreateLP_SpecialCharactersInTitle` | HTML/quotes in titles |

##### Timeout Tests

| Test | Description |
|------|-------------|
| `TestIntegration_CreateLP_ContextCancellation` | Context timeout handling |

---

## TypeScript Backend-Editor Tests

### Unit Tests (`tests/unit/diagramController.test.ts`)

Unit tests focus on **API endpoint behavior** and **input validation**.

#### Create Diagram Tests

| Test | Description |
|------|-------------|
| `should create diagram with valid data and return 201` | Happy path |
| `should return 200 for idempotent retry (same learningPathId)` | Duplicate learningPathId |
| `should return 409 for duplicate name (different learningPathId)` | Name uniqueness |
| `should use learningPathId as name when name is not provided` | Fallback behavior |
| `should use learningPathId as name when name is empty string` | Whitespace handling |

#### Delete Diagram Tests

| Test | Description |
|------|-------------|
| `should delete diagram and return 204` | Happy path |
| `should return 404 when diagram not found` | Missing diagram |

#### Input Validation Tests

| Test | Description |
|------|-------------|
| `should reject request without learningPathId` | Required field validation |
| `should handle very long name gracefully` | 1000-character name |
| `should handle special characters in name` | XSS patterns, quotes |
| `should handle unicode characters in name` | Emoji, international chars |

### Integration Tests (`tests/integration/diagramWorkflow.test.ts`)

Integration tests focus on **workflow scenarios** and **data consistency**.

#### Full Workflow Tests

| Test | Description |
|------|-------------|
| `should support complete diagram lifecycle` | Create → Verify → Delete → Verify |
| `should handle create-delete-recreate cycle` | Full lifecycle with recreate |

#### Concurrent Request Tests

| Test | Description |
|------|-------------|
| `should handle concurrent creates with same learningPathId idempotently` | 10 parallel requests |
| `should handle concurrent creates with different learningPathIds` | 5 parallel unique creates |
| `should handle concurrent deletes idempotently` | 5 parallel delete requests |

#### Data Consistency Tests

| Test | Description |
|------|-------------|
| `should maintain unique learningPathId constraint` | Unique index enforcement |
| `should maintain unique name constraint across different learningPathIds` | Cross-LP name uniqueness |
| `should populate default template nodes and edges` | Template application |
| `should preserve diagram data after retrieval` | Data integrity |

#### Batch Operations Tests

| Test | Description |
|------|-------------|
| `should handle multiple sequential create-delete operations` | 10 sequential operations |
| `should handle creating many diagrams then deleting all` | 20 creates, 20 deletes |

#### SAGA Compensation Simulation Tests

| Test | Description |
|------|-------------|
| `should support compensation scenario: create then immediate delete` | Simulates compensation |
| `should support retry after compensation` | Create → Delete → Recreate |
| `should handle compensation for non-existent diagram gracefully` | 404 during compensation |

---

## Test Helpers

### Go: Database Setup (`tests/testutil/db.go`)

```go
// SetupTestDB creates an in-memory SQLite database
func SetupTestDB(t *testing.T) *gorm.DB {
    db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
    db.AutoMigrate(&model.LearningPath{}, &model.Skill{}, &model.LPSkill{})
    return db
}

// SetupTestDBWithUniqueIndex adds unique constraint on diagram_id
func SetupTestDBWithUniqueIndex(t *testing.T) *gorm.DB {
    db := SetupTestDB(t)
    db.Exec("CREATE UNIQUE INDEX idx_unique_diagram_id ON learning_paths(diagram_id)")
    return db
}
```

### Go: HTTP Mock (`tests/testutil/mock_http_client.go`)

```go
type MockHTTPClient struct {
    mock.Mock
}

func (m *MockHTTPClient) Do(req *http.Request) (*http.Response, error) {
    args := m.Called(req)
    return args.Get(0).(*http.Response), args.Error(1)
}

func CreateMockHTTPResponse(statusCode int, body string) *http.Response {
    return &http.Response{
        StatusCode: statusCode,
        Body:       io.NopCloser(strings.NewReader(body)),
    }
}
```

### TypeScript: Test App (`tests/helpers/testApp.ts`)

```typescript
// Creates Express app without authentication middleware
export const createTestApp = () => {
  const app = express();
  app.use(express.json());

  const router = Router();
  router.post('/diagrams/by-lp', catchAsync(createDiagramByLP));
  router.delete('/diagrams/by-lp/:lpId', catchAsync(deleteDiagramByLP));

  app.use('/api', router);
  return app;
};
```

### TypeScript: MongoDB Memory Server (`tests/helpers/mongoMemory.ts`)

```typescript
export const setupTestDB = () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });
};
```

---

## Test Coverage Goals

### Critical Paths (Must Have)

- [x] Create LP success flow
- [x] Delete LP success flow
- [x] MongoDB failure → no orphaned LP
- [x] PostgreSQL failure → compensation runs
- [x] Delete failure → LP restored
- [x] Idempotent create (200 response)
- [x] Idempotent delete (404 treated as success)

### Edge Cases (Should Have)

- [x] Concurrent requests
- [x] Empty/missing fields
- [x] Special characters in input
- [x] Context cancellation/timeout
- [x] Compensation failure logging

### Stress Tests (Nice to Have)

- [x] Batch operations (20+ sequential)
- [x] Parallel creates (10+ concurrent)
- [ ] Long-running saga (network delays)
- [ ] Memory pressure scenarios

---

## Debugging Failed Tests

### Common Issues

#### 1. MongoDB Model Already Compiled

```
OverwriteModelError: Cannot overwrite `Diagram` model once compiled
```

**Solution**: The `DiagramModel` export handles this:

```typescript
export const DiagramModel =
  mongoose.models.Diagram ||
  mongoose.model<IDiagram>('Diagram', diagramSchema);
```

#### 2. Unique Index Not Enforced

Tests expecting 200 (idempotent) get 201 (created).

**Solution**: Ensure indexes are created in `beforeAll`:

```typescript
beforeAll(async () => {
  await DiagramModel.createIndexes();
});
```

#### 3. SQLite Unique Constraint Not Working

Go tests expecting constraint violations pass unexpectedly.

**Solution**: SQLite requires explicit index creation:

```go
db.Exec("CREATE UNIQUE INDEX idx_name ON table(column)")
```

### Viewing Test Output

```bash
# Go: Verbose output
go test ./tests/... -v

# Go: Show only failures
go test ./tests/... -v 2>&1 | grep -A5 "FAIL"

# TypeScript: Watch mode
npm test -- --watch
```

---

## Adding New Tests

### Checklist for New SAGA Tests

1. **Unit test** with mocked HTTP for isolated logic
2. **Integration test** with real HTTP server for full flow
3. **Compensation test** if new failure mode introduced
4. **Idempotency test** if new endpoint added
5. **Concurrent test** if race conditions possible

### Test Naming Convention

```
# Go
TestCreateLearningPath_<Scenario>_<ExpectedOutcome>
TestDeleteLearningPath_<Scenario>_<ExpectedOutcome>
TestIntegration_<Operation>_<Scenario>

# TypeScript
should <action> when <condition>
should handle <edge case> gracefully
```

---

## References

- [Testing in Go](https://go.dev/doc/tutorial/add-a-test)
- [Testify Mock](https://github.com/stretchr/testify#mock-package)
- [Vitest Documentation](https://vitest.dev/)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)
- [Supertest](https://github.com/ladjs/supertest)
