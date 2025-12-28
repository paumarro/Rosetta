# Saga Pattern: Distributed Transactions for Learning Paths

> **Last Updated**: December 2025
> **Services Involved**: `backend` (Go/PostgreSQL) ↔ `backend-editor` (Node.js/MongoDB)

## Overview

The Rosetta platform uses a **Saga Pattern** to maintain data consistency when creating or deleting Learning Paths, which span two databases:

| Resource | Database | Service |
|----------|----------|---------|
| Learning Path (LP) metadata, skills, users | PostgreSQL | `backend` |
| Diagram content (nodes, edges, Yjs state) | MongoDB | `backend-editor` |

Since distributed transactions (2PC) are impractical across heterogeneous databases, we use **sagas** with **compensating transactions** to achieve eventual consistency.

---

## Implementation Variant

> ⚠️ **Note on Pattern Classification**
>
> This implementation is a **synchronous, orchestration-based saga** rather than the event-driven choreography pattern commonly associated with microservices. Key characteristics:

| Aspect | Classic Event-Driven Saga | Our Implementation |
|--------|--------------------------|-------------------|
| **Communication** | Asynchronous message queues | Synchronous HTTP REST calls |
| **Coordinator** | Choreography (no central) or Orchestrator | Orchestrator (`LearningPathService`) |
| **Retry mechanism** | Message broker handles retries | Idempotent endpoints + manual retry |
| **Failure detection** | Event timeouts | HTTP response codes |
| **Compensation trigger** | Compensating events | Direct function calls |

### Why This Approach?

1. **Simplicity**: Two-service topology doesn't require event bus complexity
2. **Debuggability**: Synchronous calls are easier to trace and debug
3. **Latency**: No message queue overhead for simple operations
4. **Idempotency**: Built-in via MongoDB unique indexes and HTTP status codes

### Trade-offs

| Advantage | Disadvantage |
|-----------|--------------|
| Simple to implement and debug | Tighter coupling between services |
| No message infrastructure needed | Blocking calls during saga execution |
| Immediate consistency feedback | Less resilient to network partitions |
| Easy local development | Compensation must complete synchronously |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SAGA ORCHESTRATOR                              │
│                        (LearningPathService in backend)                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                 ┌────────────────────┼────────────────────┐
                 │                    │                    │
                 ▼                    │                    ▼
    ┌────────────────────┐            │       ┌────────────────────┐
    │    PostgreSQL      │            │       │      MongoDB       │
    │    (backend)       │◄───────────┼──────►│  (backend-editor)  │
    │                    │   HTTP     │       │                    │
    │  - Learning Paths  │   REST     │       │  - Diagrams        │
    │  - Skills          │   API      │       │  - Nodes/Edges     │
    │  - User relations  │            │       │  - Yjs Documents   │
    └────────────────────┘            │       └────────────────────┘
                                      │
                              Compensation on
                                 failure
```

---

## Saga Flows

### 1. Create Learning Path Saga

Creates a new learning path with an associated diagram.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CREATE LEARNING PATH SAGA                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   STEP 1: Create Diagram in MongoDB (Idempotent)                             │
│   ─────────────────────────────────────────────────                          │
│   POST /api/diagrams/by-lp                                                   │
│   Body: { learningPathId: UUID, name: "LP Title" }                           │
│                                                                              │
│   ✓ Returns 201 (Created) or 200 (Already Exists - idempotent)               │
│   ✗ On failure → Return error (no compensation needed)                       │
│                                                                              │
│   ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│   STEP 2: Create LP + Skills in PostgreSQL (Transaction)                     │
│   ────────────────────────────────────────────────────────                   │
│   BEGIN TRANSACTION                                                          │
│     INSERT learning_paths (id, title, diagram_id, ...)                       │
│     INSERT skills (name) ON CONFLICT DO NOTHING                              │
│     INSERT lp_skills (lp_id, skill_id)                                       │
│   COMMIT                                                                     │
│                                                                              │
│   ✓ On success → Saga complete                                               │
│   ✗ On failure → COMPENSATE: Delete MongoDB diagram                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Sequence Diagram

```
    Client              Backend (Go)           Backend-Editor (Node)      PostgreSQL       MongoDB
       │                     │                         │                      │               │
       │  POST /lp           │                         │                      │               │
       │────────────────────►│                         │                      │               │
       │                     │                         │                      │               │
       │                     │  POST /diagrams/by-lp   │                      │               │
       │                     │────────────────────────►│                      │               │
       │                     │                         │                      │               │
       │                     │                         │  INSERT diagram      │               │
       │                     │                         │─────────────────────────────────────►│
       │                     │                         │                      │               │
       │                     │        201 Created      │                      │               │
       │                     │◄────────────────────────│                      │               │
       │                     │                         │                      │               │
       │                     │  BEGIN TRANSACTION                             │               │
       │                     │───────────────────────────────────────────────►│               │
       │                     │  INSERT learning_path                          │               │
       │                     │───────────────────────────────────────────────►│               │
       │                     │  INSERT skills                                 │               │
       │                     │───────────────────────────────────────────────►│               │
       │                     │  COMMIT                                        │               │
       │                     │───────────────────────────────────────────────►│               │
       │                     │                         │                      │               │
       │     201 Created     │                         │                      │               │
       │◄────────────────────│                         │                      │               │
       │                     │                         │                      │               │
```

#### Compensation Flow (PostgreSQL Insert Fails)

```
    Client              Backend (Go)           Backend-Editor (Node)      PostgreSQL       MongoDB
       │                     │                         │                      │               │
       │  POST /lp           │                         │                      │               │
       │────────────────────►│                         │                      │               │
       │                     │                         │                      │               │
       │                     │  POST /diagrams/by-lp   │                      │               │
       │                     │────────────────────────►│                      │               │
       │                     │        201 Created      │                      │               │
       │                     │◄────────────────────────│                      │               │
       │                     │                         │                      │               │
       │                     │  INSERT learning_path   │                      │               │
       │                     │───────────────────────────────────────────────►│               │
       │                     │        ❌ CONSTRAINT VIOLATION                  │               │
       │                     │◄───────────────────────────────────────────────│               │
       │                     │                         │                      │               │
       │                     │  ┌─────────────────────────────────────────┐   │               │
       │                     │  │ COMPENSATION: Delete orphaned diagram   │   │               │
       │                     │  └─────────────────────────────────────────┘   │               │
       │                     │                         │                      │               │
       │                     │  DELETE /diagrams/by-lp/{lpId}                 │               │
       │                     │────────────────────────►│                      │               │
       │                     │                         │  DELETE diagram      │               │
       │                     │                         │─────────────────────────────────────►│
       │                     │        204 No Content   │                      │               │
       │                     │◄────────────────────────│                      │               │
       │                     │                         │                      │               │
       │   500 Error         │                         │                      │               │
       │◄────────────────────│                         │                      │               │
```

---

### 2. Delete Learning Path Saga

Deletes a learning path and its associated diagram using a **soft-delete pattern** for safe rollback.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        DELETE LEARNING PATH SAGA                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   STEP 1: Soft-Delete LP in PostgreSQL (Recoverable)                         │
│   ─────────────────────────────────────────────────────                      │
│   UPDATE learning_paths SET deleted_at = NOW() WHERE id = ?                  │
│                                                                              │
│   ✓ LP is hidden but recoverable                                             │
│   ✗ On failure → Return error (nothing to compensate)                        │
│                                                                              │
│   ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│   STEP 2: Delete Diagram from MongoDB                                        │
│   ────────────────────────────────────                                       │
│   DELETE /api/diagrams/by-lp/{lpId}                                          │
│                                                                              │
│   ✓ On success → Proceed to Step 3                                           │
│   ✗ On failure → COMPENSATE: Restore soft-deleted LP                         │
│                                                                              │
│   ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│   STEP 3: Hard-Delete LP from PostgreSQL                                     │
│   ─────────────────────────────────────────────────────                      │
│   DELETE FROM learning_paths WHERE id = ? (Unscoped - bypasses soft-delete)  │
│                                                                              │
│   ✓ Permanent removal                                                        │
│   ✗ On failure → Non-critical, cleanup job will handle                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Why Soft-Delete First?

The order of operations is **critical** for saga safety:

| Order | If MongoDB Delete Fails | Recovery Possible? |
|-------|------------------------|-------------------|
| ❌ **Wrong**: MongoDB first, then PostgreSQL | Diagram is deleted, LP remains | **NO** - User content lost forever |
| ✅ **Correct**: PostgreSQL first (soft), then MongoDB | LP is soft-deleted, diagram remains | **YES** - Restore LP by clearing `deleted_at` |

#### Compensation Flow (MongoDB Delete Fails)

```
    Client              Backend (Go)           Backend-Editor (Node)      PostgreSQL       MongoDB
       │                     │                         │                      │               │
       │  DELETE /lp/{id}    │                         │                      │               │
       │────────────────────►│                         │                      │               │
       │                     │                         │                      │               │
       │                     │  SOFT DELETE (set deleted_at)                  │               │
       │                     │───────────────────────────────────────────────►│               │
       │                     │        ✓ Success                               │               │
       │                     │◄───────────────────────────────────────────────│               │
       │                     │                         │                      │               │
       │                     │  DELETE /diagrams/by-lp/{lpId}                 │               │
       │                     │────────────────────────►│                      │               │
       │                     │        ❌ 503 Unavailable                       │               │
       │                     │◄────────────────────────│                      │               │
       │                     │                         │                      │               │
       │                     │  ┌─────────────────────────────────────────┐   │               │
       │                     │  │ COMPENSATION: Restore soft-deleted LP   │   │               │
       │                     │  └─────────────────────────────────────────┘   │               │
       │                     │                         │                      │               │
       │                     │  UPDATE SET deleted_at = NULL                  │               │
       │                     │───────────────────────────────────────────────►│               │
       │                     │        ✓ LP Restored                           │               │
       │                     │◄───────────────────────────────────────────────│               │
       │                     │                         │                      │               │
       │   500 Error         │                         │                      │               │
       │   (LP restored)     │                         │                      │               │
       │◄────────────────────│                         │                      │               │
```

---

## Implementation Details

### Code Location

| Component | File |
|-----------|------|
| Saga Orchestrator | `services/backend/internal/service/learningPath.go` |
| Diagram API | `services/backend-editor/src/controllers/diagramController.ts` |
| Diagram Routes | `services/backend-editor/src/routes/diagramRoutes.ts` |

### Key Functions

#### Backend (Go)

```go
// Main saga orchestrators
func (s *LearningPathService) CreateLearningPath(...) (*model.LearningPath, error)
func (s *LearningPathService) DeleteLearningPath(...) error

// Saga steps
func (s *LearningPathService) createDiagramInMongo(...) (*diagramResponse, error)
func (s *LearningPathService) createLPWithSkillsInTransaction(...) (*model.LearningPath, error)

// Compensation actions
func (s *LearningPathService) deleteDiagramByLP(...) error
func (s *LearningPathService) restoreSoftDeletedLP(...) error
```

#### Backend-Editor (TypeScript)

```typescript
// Idempotent create (returns 200 if already exists)
export const createDiagramByLP = async (req, res) => { ... }

// Delete by LP UUID (for compensation)
export const deleteDiagramByLP = async (req, res) => { ... }
```

### API Endpoints (Internal Only)

These endpoints are **blocked by nginx** from external access and only accessible service-to-service:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/diagrams/by-lp` | Create diagram (idempotent) |
| `DELETE` | `/api/diagrams/by-lp/:lpId` | Delete diagram by LP UUID |

Nginx configuration:

```nginx
location ~ ^/editor/diagrams/by-lp {
    allow 172.16.0.0/12;   # Docker network
    allow 192.168.0.0/16;  # Private network
    deny all;
    proxy_pass http://backend-editor:3001;
}
```

---

## Idempotency

### Create Diagram (Idempotent)

The `createDiagramByLP` function handles duplicate requests gracefully:

```typescript
// If diagram with this learningPathId already exists, return it (200 OK)
if ((err as Error & { code?: number }).code === 11000) {
  const existingByLP = await DiagramModel.findOne({ learningPathId });
  if (existingByLP) return res.status(200).json(existingByLP);
}
```

This allows safe retries if:
- Network timeout occurred but diagram was created
- Client retries the request
- Saga is re-executed after partial failure

### Delete Diagram (Idempotent)

Deletion is also idempotent:

```go
// 204 is expected; if not found, we consider it already cleaned up.
if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusNotFound {
    return fmt.Errorf("unexpected status deleting diagram: %d", resp.StatusCode)
}
return nil
```

---

## Error Handling

### Compensation Failure Logging

When compensation fails, it's logged for manual intervention:

```go
if compErr := s.deleteDiagramByLP(ctx, httpClient, editorURL, lpID.String(), authToken); compErr != nil {
    fmt.Printf("SAGA COMPENSATION FAILED: diagram %s may be orphaned in MongoDB: %v\n", lpID.String(), compErr)
}
```

### Error Messages

| Saga Step | Error Format |
|-----------|--------------|
| MongoDB create fails | `saga step 1 failed (create diagram): <error>` |
| PostgreSQL insert fails | `saga step 2 failed (create LP): <error>` |
| Soft-delete fails | `saga step 1 failed (soft-delete LP): <error>` |
| MongoDB delete fails | `saga step 2 failed (delete diagram), LP restored: <error>` |
| Compensation fails | `saga failed and compensation failed: delete diagram: <error>, restore LP: <error>` |

---

## Consistency Guarantees

### What We Guarantee

| Guarantee | Description |
|-----------|-------------|
| **No orphaned LPs** | If PostgreSQL insert fails, MongoDB diagram is deleted |
| **No orphaned diagrams** | If MongoDB create succeeds but PostgreSQL fails, diagram is cleaned up |
| **Recoverable deletes** | Soft-delete pattern allows restoration if MongoDB is temporarily unavailable |
| **Idempotent retries** | Safe to retry any saga operation |

### Eventual Consistency Window

There is a brief window (milliseconds to seconds) where:

| Scenario | Temporary State | Resolution |
|----------|-----------------|------------|
| Create: After MongoDB, before PostgreSQL | Diagram exists without LP | Saga completes or compensates |
| Delete: After soft-delete, before MongoDB | LP hidden, diagram exists | Saga completes or restores LP |

---

## Monitoring & Observability

### Log Patterns to Monitor

```bash
# Successful operations
grep "SAGA COMPLETED" backend.log

# Compensation executed
grep "SAGA COMPENSATION" backend.log

# Critical: Compensation failed (requires manual intervention)
grep "SAGA COMPENSATION FAILED" backend.log
```

### Recommended Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| Saga Compensation Failed | Log contains "SAGA COMPENSATION FAILED" | **Critical** |
| High Saga Failure Rate | >5% of saga operations fail | Warning |
| MongoDB Unavailable | Consistent `deleteDiagramByLP` failures | Warning |

---

## Testing Checklist

### Unit Tests

- [ ] `CreateLearningPath` with valid data → Success
- [ ] `CreateLearningPath` with duplicate name → Proper error
- [ ] `CreateLearningPath` when MongoDB unavailable → Error (no orphan)
- [ ] `CreateLearningPath` when PostgreSQL fails → Compensation runs
- [ ] `DeleteLearningPath` with valid ID → Success
- [ ] `DeleteLearningPath` when MongoDB unavailable → LP restored
- [ ] `DeleteLearningPath` when LP not found → Proper error

### Integration Tests

- [ ] Create LP → verify both PostgreSQL and MongoDB have data
- [ ] Delete LP → verify both databases cleaned up
- [ ] Kill MongoDB mid-create → verify no orphaned LP
- [ ] Kill MongoDB mid-delete → verify LP is restored

---

## References

- [Saga Pattern - Microsoft](https://docs.microsoft.com/en-us/azure/architecture/reference-architectures/saga/saga)
- [Compensating Transaction Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction)
- [GORM Soft Delete](https://gorm.io/docs/delete.html#Soft-Delete)


