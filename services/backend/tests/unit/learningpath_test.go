package unit_test

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/model"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/service"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/tests/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// CREATE LEARNING PATH TESTS
// ============================================================================

func TestCreateLearningPath_ValidData_Success(t *testing.T) {
	// Setup
	db := testutil.SetupTestDB(t)
	mockHTTP := new(testutil.MockHTTPClient)

	// Mock successful diagram creation (201 Created)
	mockHTTP.On("Do", mock.MatchedBy(func(req *http.Request) bool {
		return req.Method == http.MethodPost && strings.Contains(req.URL.Path, "diagrams/by-lp")
	})).Return(testutil.CreateMockHTTPResponse(201, `{"_id":"mongo123","learningPathId":"test-uuid","name":"Test LP"}`), nil).Once()

	svc := service.NewLearningPathServiceWithClient(db, mockHTTP, "http://test:3001/api")

	// Execute
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"Test LP",
		"Test Description",
		true,
		"thumbnail.png",
		[]string{"Go", "Testing"},
		"auth-token",
		"test-community",
	)

	// Assert
	require.NoError(t, err)
	require.NotNil(t, lp)
	assert.Equal(t, "Test LP", lp.Title)
	assert.Equal(t, "Test Description", lp.Description)
	assert.Equal(t, true, lp.IsPublic)
	assert.Equal(t, "mongo123", lp.DiagramID)
	assert.Equal(t, "test-community", lp.Community)
	assert.Len(t, lp.SkillsList, 2)
	mockHTTP.AssertExpectations(t)

	// Verify LP exists in database
	var dbLP model.LearningPath
	err = db.First(&dbLP, "id = ?", lp.ID).Error
	require.NoError(t, err)
	assert.Equal(t, "Test LP", dbLP.Title)
}

func TestCreateLearningPath_DuplicateName_ReturnsError(t *testing.T) {
	// Setup
	db := testutil.SetupTestDB(t)
	mockHTTP := new(testutil.MockHTTPClient)

	// Mock diagram creation returning 409 Conflict (duplicate name)
	mockHTTP.On("Do", mock.MatchedBy(func(req *http.Request) bool {
		return req.Method == http.MethodPost
	})).Return(testutil.CreateMockHTTPResponse(409, `{"error":"A learning path with this name already exists"}`), nil).Once()

	svc := service.NewLearningPathServiceWithClient(db, mockHTTP, "http://test:3001/api")

	// Execute
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"Existing LP",
		"Description",
		true,
		"",
		[]string{},
		"token",
		"community",
	)

	// Assert
	require.Error(t, err)
	assert.Nil(t, lp)
	assert.Contains(t, err.Error(), "saga step 1 failed")
	assert.Contains(t, err.Error(), "already exists")
	mockHTTP.AssertExpectations(t)
}

func TestCreateLearningPath_MongoDBUnavailable_NoOrphanCreated(t *testing.T) {
	// Setup
	db := testutil.SetupTestDB(t)
	mockHTTP := new(testutil.MockHTTPClient)

	// Mock MongoDB connection failure
	mockHTTP.On("Do", mock.MatchedBy(func(req *http.Request) bool {
		return req.Method == http.MethodPost
	})).Return(nil, errors.New("connection refused")).Once()

	svc := service.NewLearningPathServiceWithClient(db, mockHTTP, "http://test:3001/api")

	// Execute
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"Test LP",
		"Description",
		true,
		"",
		[]string{},
		"token",
		"community",
	)

	// Assert
	require.Error(t, err)
	assert.Nil(t, lp)
	assert.Contains(t, err.Error(), "saga step 1 failed")
	mockHTTP.AssertExpectations(t)

	// Verify NO learning path was created (no orphan)
	var count int64
	db.Model(&model.LearningPath{}).Count(&count)
	assert.Equal(t, int64(0), count)
}

func TestCreateLearningPath_PostgreSQLFails_CompensationRuns(t *testing.T) {
	// Setup - create a database with unique constraint
	db := testutil.SetupTestDBWithUniqueIndex(t)
	mockHTTP := new(testutil.MockHTTPClient)

	// First, create an LP with a specific diagram ID to cause unique constraint violation
	existingLP := model.LearningPath{
		ID:        uuid.New(),
		Title:     "Existing",
		DiagramID: "mongo123", // Same diagram ID we'll try to use
		IsPublic:  true,
	}
	require.NoError(t, db.Create(&existingLP).Error)

	// Mock successful diagram creation (201 Created)
	mockHTTP.On("Do", mock.MatchedBy(func(req *http.Request) bool {
		return req.Method == http.MethodPost && strings.Contains(req.URL.Path, "diagrams/by-lp")
	})).Return(testutil.CreateMockHTTPResponse(201, `{"_id":"mongo123","learningPathId":"test-uuid","name":"Test LP"}`), nil).Once()

	// Mock compensation delete (should be called when PostgreSQL fails)
	mockHTTP.On("Do", mock.MatchedBy(func(req *http.Request) bool {
		return req.Method == http.MethodDelete && strings.Contains(req.URL.Path, "diagrams/by-lp")
	})).Return(testutil.CreateMockHTTPResponse(204, ""), nil).Once()

	svc := service.NewLearningPathServiceWithClient(db, mockHTTP, "http://test:3001/api")

	// Execute - this should fail because DiagramID is unique and already exists
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"Test LP",
		"Description",
		true,
		"",
		[]string{},
		"token",
		"community",
	)

	// Assert
	require.Error(t, err)
	assert.Nil(t, lp)
	assert.Contains(t, err.Error(), "saga step 2 failed")

	// Verify compensation DELETE was called
	mockHTTP.AssertExpectations(t)
}

// ============================================================================
// DELETE LEARNING PATH TESTS
// ============================================================================

func TestDeleteLearningPath_ValidID_Success(t *testing.T) {
	// Setup
	db := testutil.SetupTestDB(t)
	mockHTTP := new(testutil.MockHTTPClient)

	// Create an existing LP to delete
	lpID := uuid.New()
	existingLP := model.LearningPath{
		ID:        lpID,
		Title:     "To Delete",
		DiagramID: "mongo456",
		IsPublic:  true,
	}
	db.Create(&existingLP)

	// Mock successful diagram deletion (204 No Content)
	mockHTTP.On("Do", mock.MatchedBy(func(req *http.Request) bool {
		return req.Method == http.MethodDelete && strings.Contains(req.URL.Path, "diagrams/by-lp")
	})).Return(testutil.CreateMockHTTPResponse(204, ""), nil).Once()

	svc := service.NewLearningPathServiceWithClient(db, mockHTTP, "http://test:3001/api")

	// Execute
	err := svc.DeleteLearningPath(context.Background(), lpID.String(), "token")

	// Assert
	require.NoError(t, err)
	mockHTTP.AssertExpectations(t)

	// Verify LP is deleted (both soft and hard delete)
	var count int64
	db.Unscoped().Model(&model.LearningPath{}).Where("id = ?", lpID).Count(&count)
	assert.Equal(t, int64(0), count)
}

func TestDeleteLearningPath_MongoDBUnavailable_LPRestored(t *testing.T) {
	// Setup
	db := testutil.SetupTestDB(t)
	mockHTTP := new(testutil.MockHTTPClient)

	// Create an existing LP
	lpID := uuid.New()
	existingLP := model.LearningPath{
		ID:        lpID,
		Title:     "To Restore",
		DiagramID: "mongo789",
		IsPublic:  true,
	}
	db.Create(&existingLP)

	// Mock MongoDB connection failure during deletion
	mockHTTP.On("Do", mock.MatchedBy(func(req *http.Request) bool {
		return req.Method == http.MethodDelete
	})).Return(nil, errors.New("connection refused")).Once()

	svc := service.NewLearningPathServiceWithClient(db, mockHTTP, "http://test:3001/api")

	// Execute
	err := svc.DeleteLearningPath(context.Background(), lpID.String(), "token")

	// Assert
	require.Error(t, err)
	assert.Contains(t, err.Error(), "saga step 2 failed")
	assert.Contains(t, err.Error(), "LP restored")
	mockHTTP.AssertExpectations(t)

	// Verify LP was restored (not soft-deleted)
	var restoredLP model.LearningPath
	err = db.First(&restoredLP, "id = ?", lpID).Error
	require.NoError(t, err)
	assert.Equal(t, "To Restore", restoredLP.Title)
	assert.True(t, restoredLP.DeletedAt.Time.IsZero())
}

func TestDeleteLearningPath_NotFound_ReturnsError(t *testing.T) {
	// Setup
	db := testutil.SetupTestDB(t)
	mockHTTP := new(testutil.MockHTTPClient)

	svc := service.NewLearningPathServiceWithClient(db, mockHTTP, "http://test:3001/api")

	// Execute with non-existent LP ID
	err := svc.DeleteLearningPath(context.Background(), uuid.New().String(), "token")

	// Assert
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")

	// Verify no HTTP calls were made (should fail before reaching MongoDB)
	mockHTTP.AssertNotCalled(t, "Do")
}

// ============================================================================
// IDEMPOTENCY TESTS
// ============================================================================

func TestCreateLearningPath_IdempotentRetry_Returns200(t *testing.T) {
	// Setup
	db := testutil.SetupTestDB(t)
	mockHTTP := new(testutil.MockHTTPClient)

	// Mock idempotent response (200 OK - already exists)
	mockHTTP.On("Do", mock.MatchedBy(func(req *http.Request) bool {
		return req.Method == http.MethodPost && strings.Contains(req.URL.Path, "diagrams/by-lp")
	})).Return(testutil.CreateMockHTTPResponse(200, `{"_id":"mongo-existing","learningPathId":"existing-uuid","name":"Existing LP"}`), nil).Once()

	svc := service.NewLearningPathServiceWithClient(db, mockHTTP, "http://test:3001/api")

	// Execute
	lp, err := svc.CreateLearningPath(
		context.Background(),
		"Existing LP",
		"Description",
		true,
		"",
		[]string{},
		"token",
		"community",
	)

	// Assert - should succeed with idempotent response
	require.NoError(t, err)
	require.NotNil(t, lp)
	assert.Equal(t, "mongo-existing", lp.DiagramID)
	mockHTTP.AssertExpectations(t)
}

func TestDeleteLearningPath_DiagramNotFound_TreatedAsSuccess(t *testing.T) {
	// Setup
	db := testutil.SetupTestDB(t)
	mockHTTP := new(testutil.MockHTTPClient)

	// Create an existing LP
	lpID := uuid.New()
	existingLP := model.LearningPath{
		ID:        lpID,
		Title:     "To Delete",
		DiagramID: "mongo-already-deleted",
		IsPublic:  true,
	}
	db.Create(&existingLP)

	// Mock diagram not found (404 - idempotent, treated as already deleted)
	mockHTTP.On("Do", mock.MatchedBy(func(req *http.Request) bool {
		return req.Method == http.MethodDelete
	})).Return(testutil.CreateMockHTTPResponse(404, `{"error":"not found"}`), nil).Once()

	svc := service.NewLearningPathServiceWithClient(db, mockHTTP, "http://test:3001/api")

	// Execute
	err := svc.DeleteLearningPath(context.Background(), lpID.String(), "token")

	// Assert - should succeed because 404 is treated as already deleted
	require.NoError(t, err)
	mockHTTP.AssertExpectations(t)

	// Verify LP is deleted
	var count int64
	db.Unscoped().Model(&model.LearningPath{}).Where("id = ?", lpID).Count(&count)
	assert.Equal(t, int64(0), count)
}
