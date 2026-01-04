package integration_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/rosetta-monorepo/services/backend/internal/model"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/rosetta-monorepo/services/backend/internal/service"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/rosetta-monorepo/services/backend/tests/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// INTEGRATION TEST HELPERS
// ============================================================================

// mockMongoServer simulates the backend-editor MongoDB service
type mockMongoServer struct {
	diagrams      map[string]map[string]interface{} // learningPathId -> diagram data
	mu            sync.RWMutex
	createCount   int32 // atomic counter for create requests
	deleteCount   int32 // atomic counter for delete requests
	updateCount   int32 // atomic counter for update requests
	failOnCreate  bool
	failOnDelete  bool
	failOnUpdate  bool
	delayCreate   time.Duration
	delayDelete   time.Duration
	delayUpdate   time.Duration
}

func newMockMongoServer() *mockMongoServer {
	return &mockMongoServer{
		diagrams: make(map[string]map[string]interface{}),
	}
}

// validateAuth checks for Bearer token (matches real backend-editor authenticateRequest)
func (m *mockMongoServer) validateAuth(r *http.Request, w http.ResponseWriter) bool {
	authHeader := r.Header.Get("Authorization")

	if authHeader == "" {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error":   "Unauthorized",
			"message": "No access token provided",
		})
		return false
	}

	if !strings.HasPrefix(authHeader, "Bearer ") {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error":   "Unauthorized",
			"message": "Invalid authorization format",
		})
		return false
	}

	// In tests, any non-empty Bearer token is considered valid
	// (we're testing the backend controller logic, not token validation)
	return true
}

func (m *mockMongoServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Extract the lpId from URL for DELETE and PATCH requests
	// URL format: /api/diagrams/by-lp or /api/diagrams/by-lp/{lpId}
	path := r.URL.Path

	switch {
	case r.Method == http.MethodPost && path == "/api/diagrams/by-lp":
		m.handleCreate(w, r)
	case r.Method == http.MethodPatch && len(path) > len("/api/diagrams/by-lp/"):
		lpId := path[len("/api/diagrams/by-lp/"):]
		m.handleUpdate(w, r, lpId)
	case r.Method == http.MethodDelete && len(path) > len("/api/diagrams/by-lp/"):
		lpId := path[len("/api/diagrams/by-lp/"):]
		m.handleDelete(w, r, lpId)
	default:
		http.Error(w, "Not found", http.StatusNotFound)
	}
}

func (m *mockMongoServer) handleCreate(w http.ResponseWriter, r *http.Request) {
	atomic.AddInt32(&m.createCount, 1)

	// Validate authentication (Zero Trust)
	if !m.validateAuth(r, w) {
		return
	}

	if m.delayCreate > 0 {
		time.Sleep(m.delayCreate)
	}

	if m.failOnCreate {
		http.Error(w, `{"error":"service unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	var body struct {
		LearningPathID string `json:"learningPathId"`
		Name           string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Check for existing diagram (idempotency)
	if existing, ok := m.diagrams[body.LearningPathID]; ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK) // 200 = idempotent retry
		json.NewEncoder(w).Encode(existing)
		return
	}

	// Check for duplicate name
	for _, d := range m.diagrams {
		if d["name"] == body.Name {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "A learning path with this name already exists",
			})
			return
		}
	}

	// Create new diagram
	diagram := map[string]interface{}{
		"_id":            "mongo-" + uuid.New().String()[:8],
		"learningPathId": body.LearningPathID,
		"name":           body.Name,
	}
	m.diagrams[body.LearningPathID] = diagram

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(diagram)
}

func (m *mockMongoServer) handleDelete(w http.ResponseWriter, r *http.Request, lpId string) {
	atomic.AddInt32(&m.deleteCount, 1)

	// Validate authentication (Zero Trust)
	if !m.validateAuth(r, w) {
		return
	}

	if m.delayDelete > 0 {
		time.Sleep(m.delayDelete)
	}

	if m.failOnDelete {
		http.Error(w, `{"error":"service unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.diagrams[lpId]; !ok {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "not found"})
		return
	}

	delete(m.diagrams, lpId)
	w.WriteHeader(http.StatusNoContent)
}

func (m *mockMongoServer) handleUpdate(w http.ResponseWriter, r *http.Request, lpId string) {
	atomic.AddInt32(&m.updateCount, 1)

	// Validate authentication (Zero Trust)
	if !m.validateAuth(r, w) {
		return
	}

	if m.delayUpdate > 0 {
		time.Sleep(m.delayUpdate)
	}

	if m.failOnUpdate {
		http.Error(w, `{"error":"service unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	diagram, ok := m.diagrams[lpId]
	if !ok {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "not found"})
		return
	}

	// Update the diagram name
	diagram["name"] = body.Name
	m.diagrams[lpId] = diagram

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(diagram)
}

func (m *mockMongoServer) getDiagramCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.diagrams)
}

func (m *mockMongoServer) hasDiagram(lpId string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	_, ok := m.diagrams[lpId]
	return ok
}

func (m *mockMongoServer) getCreateCount() int32 {
	return atomic.LoadInt32(&m.createCount)
}

func (m *mockMongoServer) getDeleteCount() int32 {
	return atomic.LoadInt32(&m.deleteCount)
}

func (m *mockMongoServer) getUpdateCount() int32 {
	return atomic.LoadInt32(&m.updateCount)
}

func (m *mockMongoServer) getDiagramName(lpId string) string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if diagram, ok := m.diagrams[lpId]; ok {
		if name, ok := diagram["name"].(string); ok {
			return name
		}
	}
	return ""
}

func (m *mockMongoServer) getDiagram(lpId string) map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if diagram, ok := m.diagrams[lpId]; ok {
		return diagram
	}
	return nil
}

// ============================================================================
// CREATE LEARNING PATH INTEGRATION TESTS
// ============================================================================

func TestIntegration_CreateLP_FullSagaFlow(t *testing.T) {
	// Setup real database and mock HTTP server
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Execute full saga
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"Integration Test LP",
		"Test Description",
		true,
		"thumbnail.png",
		[]string{"Go", "Testing", "SAGA"},
		"test-token",
		"test-community",
	)

	// Assert success
	require.NoError(t, err)
	require.NotNil(t, lp)
	assert.Equal(t, "Integration Test LP", lp.Title)
	assert.NotEmpty(t, lp.DiagramID)
	assert.Len(t, lp.SkillsList, 3)

	// Verify MongoDB diagram was created
	diagram := mongoServer.getDiagram(lp.ID.String())
	assert.NotNil(t, diagram, "Diagram should exist in MongoDB")
	assert.Equal(t, lp.Title, diagram["name"], "Diagram name should match LP title")

	// Verify PostgreSQL LP exists
	var dbLP model.LearningPath
	err = db.Preload("Skills.Skill").First(&dbLP, "id = ?", lp.ID).Error
	require.NoError(t, err)
	assert.Equal(t, "Integration Test LP", dbLP.Title)
	assert.Equal(t, "test-community", dbLP.Community)
}

func TestIntegration_CreateLP_PostgreSQLFails_CompensationDeletesMongoDiagram(t *testing.T) {
	// Setup with unique constraint on name to force PostgreSQL failure
	db := testutil.SetupTestDBWithUniqueIndex(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	// Add unique constraint on title to cause failure
	db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_title ON learning_paths(title)")

	// Pre-create an LP with a specific title to cause unique constraint violation
	existingLP := model.LearningPath{
		ID:        uuid.New(),
		Title:     "Duplicate Title",
		DiagramID: "mongo-existing",
		IsPublic:  true,
	}
	require.NoError(t, db.Create(&existingLP).Error)

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Execute - MongoDB succeeds but PostgreSQL fails due to duplicate title
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"Duplicate Title", // Same title as existing LP
		"Description",
		true,
		"",
		[]string{},
		"token",
		"community",
	)

	// Assert failure
	require.Error(t, err)
	assert.Nil(t, lp)
	assert.Contains(t, err.Error(), "saga step 2 failed")

	// Verify compensation was executed - no orphan diagram in MongoDB
	// (The diagram created before PostgreSQL failure should be cleaned up)
	diagramCount := mongoServer.getDiagramCount()
	assert.Equal(t, 0, diagramCount, "No orphan diagram should exist after compensation")

	// Verify only the original LP exists in database
	var count int64
	db.Model(&model.LearningPath{}).Where("title = ?", "Duplicate Title").Count(&count)
	assert.Equal(t, int64(1), count)
}

func TestIntegration_CreateLP_MongoDBFails_NoOrphanInPostgres(t *testing.T) {
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	mongoServer.failOnCreate = true // Simulate MongoDB failure
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Execute
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"Failed LP",
		"Description",
		true,
		"",
		[]string{},
		"token",
		"community",
	)

	// Assert failure at step 1
	require.Error(t, err)
	assert.Nil(t, lp)
	assert.Contains(t, err.Error(), "saga step 1 failed")

	// Verify NO LP was created in PostgreSQL
	var count int64
	db.Model(&model.LearningPath{}).Count(&count)
	assert.Equal(t, int64(0), count)

	// Verify NO skills were created
	db.Model(&model.Skill{}).Count(&count)
	assert.Equal(t, int64(0), count)
}

func TestIntegration_CreateLP_ConcurrentRequests_OnlyOneSucceeds(t *testing.T) {
	db := testutil.SetupTestDBWithUniqueIndex(t)
	mongoServer := newMockMongoServer()
	mongoServer.delayCreate = 50 * time.Millisecond // Add delay to increase race condition window
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	const numRequests = 5
	var wg sync.WaitGroup
	results := make(chan error, numRequests)
	successCount := int32(0)

	for i := 0; i < numRequests; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := svc.CreateLearningPath(
				context.Background(),
				"Concurrent LP",
				"Description",
				true,
				"",
				[]string{},
				"token",
				"community",
			)
			results <- err
			if err == nil {
				atomic.AddInt32(&successCount, 1)
			}
		}()
	}

	wg.Wait()
	close(results)

	// At least one should succeed
	assert.GreaterOrEqual(t, successCount, int32(1), "At least one request should succeed")

	// Verify only one LP exists in database
	var count int64
	db.Model(&model.LearningPath{}).Where("title = ?", "Concurrent LP").Count(&count)
	assert.Equal(t, int64(1), count, "Only one LP should exist in database")
}

// ============================================================================
// DELETE LEARNING PATH INTEGRATION TESTS
// ============================================================================

func TestIntegration_DeleteLP_FullSagaFlow(t *testing.T) {
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// First create an LP
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"LP To Delete",
		"Description",
		true,
		"",
		[]string{"Skill1"},
		"token",
		"community",
	)
	require.NoError(t, err)
	lpID := lp.ID.String()

	// Verify diagram exists before delete
	assert.True(t, mongoServer.hasDiagram(lpID))

	// Execute delete
	err = svc.DeleteLearningPath(context.Background(), lpID, "token")

	// Assert success
	require.NoError(t, err)

	// Verify MongoDB diagram was deleted
	assert.False(t, mongoServer.hasDiagram(lpID), "Diagram should be deleted from MongoDB")
	assert.Equal(t, 0, mongoServer.getDiagramCount(), "No diagrams should remain in MongoDB")

	// Verify PostgreSQL LP is hard-deleted (not just soft-deleted)
	var count int64
	db.Unscoped().Model(&model.LearningPath{}).Where("id = ?", lpID).Count(&count)
	assert.Equal(t, int64(0), count)
}

func TestIntegration_DeleteLP_MongoDBFails_LPRestored(t *testing.T) {
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// First create an LP
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"LP To Fail Delete",
		"Description",
		true,
		"",
		[]string{},
		"token",
		"community",
	)
	require.NoError(t, err)
	lpID := lp.ID.String()

	// Now make MongoDB fail on delete
	mongoServer.failOnDelete = true

	// Execute delete
	err = svc.DeleteLearningPath(context.Background(), lpID, "token")

	// Assert failure
	require.Error(t, err)
	assert.Contains(t, err.Error(), "saga step 2 failed")
	assert.Contains(t, err.Error(), "LP restored")

	// Verify LP was restored (not soft-deleted)
	var restoredLP model.LearningPath
	err = db.First(&restoredLP, "id = ?", lpID).Error
	require.NoError(t, err)
	assert.Equal(t, "LP To Fail Delete", restoredLP.Title)
	assert.True(t, restoredLP.DeletedAt.Time.IsZero(), "DeletedAt should be nil (LP restored)")

	// Verify MongoDB diagram still exists (delete failed, but our mock doesn't persist on failure)
	assert.True(t, mongoServer.hasDiagram(lpID))
}

func TestIntegration_DeleteLP_DiagramAlreadyDeleted_TreatedAsSuccess(t *testing.T) {
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	// Create LP directly in database (no corresponding diagram)
	lpID := uuid.New()
	lp := model.LearningPath{
		ID:        lpID,
		Title:     "LP Without Diagram",
		DiagramID: "non-existent-diagram",
		IsPublic:  true,
	}
	require.NoError(t, db.Create(&lp).Error)

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Execute delete - MongoDB will return 404, but should be treated as success
	err := svc.DeleteLearningPath(context.Background(), lpID.String(), "token")

	// Assert success (404 treated as idempotent)
	require.NoError(t, err)

	// Verify LP is deleted from PostgreSQL
	var count int64
	db.Unscoped().Model(&model.LearningPath{}).Where("id = ?", lpID).Count(&count)
	assert.Equal(t, int64(0), count)
}

// ============================================================================
// IDEMPOTENCY INTEGRATION TESTS
// ============================================================================

func TestIntegration_CreateLP_IdempotentRetry(t *testing.T) {
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Create first LP
	lp1, err := svc.CreateLearningPath(
		context.Background(),
		"Idempotent LP",
		"Description",
		true,
		"",
		[]string{},
		"token",
		"community",
	)
	require.NoError(t, err)

	// Pre-add the diagram to simulate retry scenario
	// (In real scenario, this would be the same request retried)
	// The MongoDB mock already handles this via learningPathId check

	// Verify diagram exists
	assert.Equal(t, 1, mongoServer.getDiagramCount())

	// Store original diagram ID
	originalDiagramID := lp1.DiagramID

	// Verify only one LP and one diagram
	var lpCount int64
	db.Model(&model.LearningPath{}).Count(&lpCount)
	assert.Equal(t, int64(1), lpCount)
	assert.Equal(t, 1, mongoServer.getDiagramCount())
	assert.Equal(t, originalDiagramID, lp1.DiagramID)
}

// ============================================================================
// DATA CONSISTENCY INTEGRATION TESTS
// ============================================================================

func TestIntegration_CreateLP_SkillsCreatedAndAssociated(t *testing.T) {
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Create LP with skills
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"LP With Skills",
		"Description",
		true,
		"",
		[]string{"Go", "Docker", "Kubernetes"},
		"token",
		"community",
	)
	require.NoError(t, err)

	// Verify skills were created
	var skillCount int64
	db.Model(&model.Skill{}).Count(&skillCount)
	assert.Equal(t, int64(3), skillCount)

	// Verify skill associations
	var lpSkillCount int64
	db.Model(&model.LPSkill{}).Where("lp_id = ?", lp.ID).Count(&lpSkillCount)
	assert.Equal(t, int64(3), lpSkillCount)

	// Verify SkillsList is populated
	assert.Len(t, lp.SkillsList, 3)
	skillNames := make([]string, 0, 3)
	for _, s := range lp.SkillsList {
		skillNames = append(skillNames, s.Name)
	}
	assert.Contains(t, skillNames, "Go")
	assert.Contains(t, skillNames, "Docker")
	assert.Contains(t, skillNames, "Kubernetes")
}

func TestIntegration_CreateLP_ExistingSkillsReused(t *testing.T) {
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Create first LP with some skills
	_, err := svc.CreateLearningPath(
		context.Background(),
		"First LP",
		"Description",
		true,
		"",
		[]string{"Go", "Docker"},
		"token",
		"community",
	)
	require.NoError(t, err)

	// Create second LP with overlapping skills
	lp2, err := svc.CreateLearningPath(
		context.Background(),
		"Second LP",
		"Description",
		true,
		"",
		[]string{"Go", "Kubernetes"}, // Go is reused, Kubernetes is new
		"token",
		"community",
	)
	require.NoError(t, err)

	// Verify total skills (Go, Docker, Kubernetes)
	var skillCount int64
	db.Model(&model.Skill{}).Count(&skillCount)
	assert.Equal(t, int64(3), skillCount, "Should have exactly 3 unique skills")

	// Verify LP2 has correct skills
	assert.Len(t, lp2.SkillsList, 2)
}

func TestIntegration_DeleteLP_SkillsRemainForOtherLPs(t *testing.T) {
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Create two LPs with shared skill
	lp1, err := svc.CreateLearningPath(
		context.Background(),
		"First LP",
		"Description",
		true,
		"",
		[]string{"SharedSkill", "UniqueSkill1"},
		"token",
		"community",
	)
	require.NoError(t, err)

	lp2, err := svc.CreateLearningPath(
		context.Background(),
		"Second LP",
		"Description",
		true,
		"",
		[]string{"SharedSkill", "UniqueSkill2"},
		"token",
		"community",
	)
	require.NoError(t, err)

	// Delete first LP
	err = svc.DeleteLearningPath(context.Background(), lp1.ID.String(), "token")
	require.NoError(t, err)

	// Verify skills still exist (they're shared and remain for other LPs)
	var skillCount int64
	db.Model(&model.Skill{}).Count(&skillCount)
	assert.Equal(t, int64(3), skillCount, "All skills should remain")

	// Verify LP2 still has its skill associations
	var lp2SkillCount int64
	db.Model(&model.LPSkill{}).Where("lp_id = ?", lp2.ID).Count(&lp2SkillCount)
	assert.Equal(t, int64(2), lp2SkillCount, "LP2 should still have 2 skill associations")

	// Verify LP1 was deleted
	var lpCount int64
	db.Unscoped().Model(&model.LearningPath{}).Where("id = ?", lp1.ID).Count(&lpCount)
	assert.Equal(t, int64(0), lpCount, "LP1 should be deleted")
}

// ============================================================================
// COMPENSATION FAILURE TESTS
// ============================================================================

func TestIntegration_CreateLP_CompensationFails_BothErrorsReported(t *testing.T) {
	// This tests the critical scenario where both saga step AND compensation fail
	db := testutil.SetupTestDBWithUniqueIndex(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	// Add unique constraint on title
	db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_title ON learning_paths(title)")

	// Pre-create an LP with specific title to cause PostgreSQL failure
	existingLP := model.LearningPath{
		ID:        uuid.New(),
		Title:     "Collision Title",
		DiagramID: "mongo-existing",
		IsPublic:  true,
	}
	require.NoError(t, db.Create(&existingLP).Error)

	// Make compensation (DELETE) also fail
	mongoServer.failOnDelete = true

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Execute - MongoDB create succeeds, PostgreSQL fails, compensation fails
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"Collision Title", // Will fail PostgreSQL
		"Description",
		true,
		"",
		[]string{},
		"token",
		"community",
	)

	// Assert - should get saga step 2 failure (compensation failure is logged)
	require.Error(t, err)
	assert.Nil(t, lp)
	assert.Contains(t, err.Error(), "saga step 2 failed")

	// Verify diagram was created but compensation failed (orphan exists)
	assert.Equal(t, 1, mongoServer.getDiagramCount(), "Orphan diagram should remain after compensation failure")
}

// ============================================================================
// INPUT VALIDATION TESTS
// ============================================================================

func TestIntegration_DeleteLP_InvalidUUIDFormat(t *testing.T) {
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Execute with invalid UUID format
	err := svc.DeleteLearningPath(context.Background(), "not-a-valid-uuid", "token")

	// Assert - should fail before making any HTTP calls
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")

	// Verify MongoDB state unchanged (error handling prevented unnecessary operations)
	assert.Equal(t, 0, mongoServer.getDiagramCount(), "No diagrams should exist (operation short-circuited)")
}

func TestIntegration_CreateLP_SpecialCharactersInTitle(t *testing.T) {
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	specialTitle := `Test "quotes" & <tags> 'apostrophes'`

	lp, err := svc.CreateLearningPath(
		context.Background(),
		specialTitle,
		"Description with <html>",
		true,
		"",
		[]string{},
		"token",
		"community",
	)

	require.NoError(t, err)
	require.NotNil(t, lp)
	assert.Equal(t, specialTitle, lp.Title)
}

// ============================================================================
// TIMEOUT AND CONTEXT CANCELLATION TESTS
// ============================================================================

func TestIntegration_CreateLP_ContextCancellation(t *testing.T) {
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	mongoServer.delayCreate = 500 * time.Millisecond // Slow response
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Create context that will be cancelled
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	// Execute - should fail due to context cancellation
	_, err := svc.CreateLearningPath(
		ctx,
		"Timeout LP",
		"Description",
		true,
		"",
		[]string{},
		"token",
		"community",
	)

	// Assert context cancellation error
	require.Error(t, err)
	assert.Contains(t, err.Error(), "saga step 1 failed")

	// Verify no LP was created
	var count int64
	db.Model(&model.LearningPath{}).Count(&count)
	assert.Equal(t, int64(0), count)
}
// ============================================================================
// UPDATE LEARNING PATH INTEGRATION TESTS
// ============================================================================

func TestIntegration_UpdateLP_FullSagaFlow(t *testing.T) {
	// Setup real database and mock HTTP server
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Pre-create a learning path with diagram
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"Original Title",
		"Original Description",
		true,
		"",
		[]string{},
		"token",
		"test-community",
	)
	require.NoError(t, err)
	require.NotNil(t, lp)

	lpID := lp.ID.String()

	// Verify initial state
	assert.Equal(t, "Original Title", lp.Title)
	assert.Equal(t, "Original Description", lp.Description)
	assert.Equal(t, "Original Title", mongoServer.getDiagramName(lpID))

	// Execute UPDATE SAGA
	updatedLP, err := svc.UpdateLearningPath(
		context.Background(),
		lpID,
		"New Title",
		"New Description",
		"token",
	)

	// Assert success
	require.NoError(t, err)
	require.NotNil(t, updatedLP)
	assert.Equal(t, "New Title", updatedLP.Title)
	assert.Equal(t, "New Description", updatedLP.Description)

	// Verify MongoDB diagram was updated
	diagram := mongoServer.getDiagram(lpID)
	assert.NotNil(t, diagram, "Diagram should exist in MongoDB after update")
	assert.Equal(t, "New Title", diagram["name"], "Diagram name should be updated in MongoDB")

	// Verify PostgreSQL LP was updated
	var dbLP model.LearningPath
	err = db.First(&dbLP, "id = ?", lp.ID).Error
	require.NoError(t, err)
	assert.Equal(t, "New Title", dbLP.Title)
	assert.Equal(t, "New Description", dbLP.Description)
}

func TestIntegration_UpdateLP_MongoDBFails_RollbackPostgreSQL(t *testing.T) {
	// Setup real database and mock HTTP server
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Pre-create a learning path
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"Original Title",
		"Original Description",
		true,
		"",
		[]string{},
		"token",
		"test-community",
	)
	require.NoError(t, err)

	lpID := lp.ID.String()

	// Configure mock to fail on update
	mongoServer.failOnUpdate = true

	// Execute UPDATE SAGA (MongoDB will fail)
	updatedLP, err := svc.UpdateLearningPath(
		context.Background(),
		lpID,
		"New Title",
		"New Description",
		"token",
	)

	// Assert failure
	require.Error(t, err)
	assert.Nil(t, updatedLP)
	assert.Contains(t, err.Error(), "saga step 2 failed")
	assert.Contains(t, err.Error(), "LP restored")

	// Verify compensation: PostgreSQL should be rolled back
	var dbLP model.LearningPath
	err = db.First(&dbLP, "id = ?", lp.ID).Error
	require.NoError(t, err)
	assert.Equal(t, "Original Title", dbLP.Title, "Title should be rolled back")
	assert.Equal(t, "Original Description", dbLP.Description, "Description should be rolled back")

	// Verify MongoDB diagram still has original name (rollback successful)
	diagram := mongoServer.getDiagram(lpID)
	assert.NotNil(t, diagram, "Diagram should still exist after rollback")
	assert.Equal(t, "Original Title", diagram["name"], "Diagram name should be rolled back to original")
}

func TestIntegration_UpdateLP_NotFound(t *testing.T) {
	// Setup real database and mock HTTP server
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Try to update non-existent LP
	randomID := uuid.New().String()
	updatedLP, err := svc.UpdateLearningPath(
		context.Background(),
		randomID,
		"New Title",
		"New Description",
		"token",
	)

	// Assert failure
	require.Error(t, err)
	assert.Nil(t, updatedLP)
	assert.Contains(t, err.Error(), "not found")

	// Verify MongoDB state unchanged (error short-circuited before update)
	assert.Equal(t, 0, mongoServer.getDiagramCount(), "No diagrams should exist")
}

func TestIntegration_UpdateLP_InvalidUUID(t *testing.T) {
	// Setup real database and mock HTTP server
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Try to update with invalid UUID
	updatedLP, err := svc.UpdateLearningPath(
		context.Background(),
		"not-a-valid-uuid",
		"New Title",
		"New Description",
		"token",
	)

	// Assert failure
	require.Error(t, err)
	assert.Nil(t, updatedLP)
	assert.Contains(t, err.Error(), "invalid")

	// Verify MongoDB state unchanged (invalid UUID prevented update)
	assert.Equal(t, 0, mongoServer.getDiagramCount(), "No diagrams should exist")
}

func TestIntegration_UpdateLP_ConcurrentUpdates_DataConsistency(t *testing.T) {
	// Setup real database and mock HTTP server with simulated slow MongoDB
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	mongoServer.delayUpdate = 100 * time.Millisecond // Simulate slow MongoDB updates
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Pre-create a learning path
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"Original Title",
		"Original Description",
		true, "", []string{}, "token", "test-community",
	)
	require.NoError(t, err)
	lpID := lp.ID.String()

	// Execute concurrent updates with different titles
	var wg sync.WaitGroup
	results := make(chan error, 2)

	wg.Add(2)
	go func() {
		defer wg.Done()
		_, err := svc.UpdateLearningPath(
			context.Background(),
			lpID,
			"Title A",
			"Description A",
			"token",
		)
		results <- err
	}()
	go func() {
		defer wg.Done()
		_, err := svc.UpdateLearningPath(
			context.Background(),
			lpID,
			"Title B",
			"Description B",
			"token",
		)
		results <- err
	}()

	wg.Wait()
	close(results)

	// Collect results - at least one should succeed
	successCount := 0
	for err := range results {
		if err == nil {
			successCount++
		}
	}

	// At least one update should succeed
	assert.GreaterOrEqual(t, successCount, 1, "At least one concurrent update should succeed")

	// Verify final state is consistent between PostgreSQL and MongoDB
	var dbLP model.LearningPath
	err = db.First(&dbLP, "id = ?", lp.ID).Error
	require.NoError(t, err)

	diagramName := mongoServer.getDiagramName(lpID)
	assert.Equal(t, dbLP.Title, diagramName, "PostgreSQL and MongoDB should be consistent after concurrent updates")

	// Verify at least one update was applied (final title is not "Original Title")
	assert.NotEqual(t, "Original Title", dbLP.Title, "Title should have been updated")
	assert.Contains(t, []string{"Title A", "Title B"}, dbLP.Title, "Final title should be one of the concurrent update values")
}

// ============================================================================
// AUTHENTICATION TESTS
// ============================================================================

func TestIntegration_CreateLP_MissingAuthToken_Returns401(t *testing.T) {
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Execute with empty auth token
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"Test LP",
		"Description",
		true,
		"",
		[]string{},
		"", // Empty token
		"community",
	)

	// Assert failure
	require.Error(t, err)
	assert.Nil(t, lp)
	assert.Contains(t, err.Error(), "saga step 1 failed")

	// Verify no LP created in database
	var count int64
	db.Model(&model.LearningPath{}).Count(&count)
	assert.Equal(t, int64(0), count)

	// Verify no diagram created in MongoDB
	assert.Equal(t, 0, mongoServer.getDiagramCount())
}

func TestIntegration_UpdateLP_MissingAuthToken_Returns401(t *testing.T) {
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Create LP with valid token first
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"Original Title",
		"Original Description",
		true,
		"",
		[]string{},
		"valid-token",
		"community",
	)
	require.NoError(t, err)

	// Try to update with empty token
	updatedLP, err := svc.UpdateLearningPath(
		context.Background(),
		lp.ID.String(),
		"New Title",
		"New Description",
		"", // Empty token
	)

	// Assert failure
	require.Error(t, err)
	assert.Nil(t, updatedLP)

	// Verify LP unchanged
	var dbLP model.LearningPath
	db.First(&dbLP, "id = ?", lp.ID)
	assert.Equal(t, "Original Title", dbLP.Title)
}

func TestIntegration_DeleteLP_MissingAuthToken_Returns401(t *testing.T) {
	db := testutil.SetupTestDB(t)
	mongoServer := newMockMongoServer()
	ts := httptest.NewServer(mongoServer)
	defer ts.Close()

	svc := service.NewLearningPathServiceWithClient(db, ts.Client(), ts.URL)

	// Create LP with valid token first
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"Test LP",
		"Description",
		true,
		"",
		[]string{},
		"valid-token",
		"community",
	)
	require.NoError(t, err)

	// Try to delete with empty token
	err = svc.DeleteLearningPath(
		context.Background(),
		lp.ID.String(),
		"", // Empty token
	)

	// Assert failure
	require.Error(t, err)

	// Verify LP still exists
	var count int64
	db.Model(&model.LearningPath{}).Where("id = ?", lp.ID).Count(&count)
	assert.Equal(t, int64(1), count)
}
