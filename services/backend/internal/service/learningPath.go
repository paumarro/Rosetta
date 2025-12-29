package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/rosetta-monorepo/services/backend/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// HTTPClient interface for dependency injection (enables mocking in tests)
type HTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

type LearningPathService struct {
	DB         *gorm.DB
	HTTPClient HTTPClient
	EditorURL  string
}

// NewLearningPathService creates a service with default HTTP client
func NewLearningPathService(db *gorm.DB) *LearningPathService {
	editorURL := os.Getenv("EDITOR_BASE_URL")
	if editorURL == "" {
		editorURL = "http://localhost:3001/api"
	}
	return &LearningPathService{
		DB:         db,
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
		EditorURL:  editorURL,
	}
}

// NewLearningPathServiceWithClient creates a service with custom HTTP client (for testing)
func NewLearningPathServiceWithClient(db *gorm.DB, client HTTPClient, editorURL string) *LearningPathService {
	return &LearningPathService{
		DB:         db,
		HTTPClient: client,
		EditorURL:  editorURL,
	}
}

// populateSkillsList extracts skills from the join table into SkillsList for a single path
func populateSkillsList(lp *model.LearningPath) {
	lp.SkillsList = make([]model.Skill, 0, len(lp.Skills))
	for _, lpSkill := range lp.Skills {
		lp.SkillsList = append(lp.SkillsList, lpSkill.Skill)
	}
}

// populateSkillsListForPaths extracts skills from the join table into SkillsList for multiple paths
func populateSkillsListForPaths(paths []model.LearningPath) {
	for i := range paths {
		populateSkillsList(&paths[i])
	}
}

type diagramResponse struct {
	ID             string `json:"_id"`
	LearningPathID string `json:"learningPathId"`
	Name           string `json:"name"`
}

func (s *LearningPathService) GetLearningPaths() ([]model.LearningPath, error) {
	var paths []model.LearningPath
	if err := s.DB.Preload("Skills.Skill").Find(&paths).Error; err != nil {
		return nil, err
	}

	populateSkillsListForPaths(paths)

	return paths, nil
}

func (s *LearningPathService) CreateLearningPath(ctx context.Context, title, description string, isPublic bool, thumbnail string, skillNames []string, authToken string, community string) (*model.LearningPath, error) {
	lpID := uuid.New()

	// SAGA STEP 1: Create diagram in MongoDB (idempotent - safe to retry)
	dr, err := s.createDiagramInMongo(ctx, s.HTTPClient, s.EditorURL, lpID.String(), title, authToken)
	if err != nil {
		return nil, fmt.Errorf("saga step 1 failed (create diagram): %w", err)
	}

	// SAGA STEP 2: Create LP and skills in PostgreSQL within a transaction
	lp, err := s.createLPWithSkillsInTransaction(ctx, lpID, title, description, isPublic, thumbnail, dr.ID, community, skillNames)
	if err != nil {
		// COMPENSATION: Delete the MongoDB diagram we just created
		if compErr := s.deleteDiagramByLP(ctx, s.HTTPClient, s.EditorURL, lpID.String(), authToken); compErr != nil {
			// Log compensation failure for manual intervention
			fmt.Printf("SAGA COMPENSATION FAILED: diagram %s may be orphaned in MongoDB: %v\n", lpID.String(), compErr)
		}
		return nil, fmt.Errorf("saga step 2 failed (create LP): %w", err)
	}

	fmt.Printf("SAGA COMPLETED: LP %s created successfully\n", lpID.String())
	return lp, nil
}

// createDiagramInMongo handles the MongoDB diagram creation with proper error handling
func (s *LearningPathService) createDiagramInMongo(ctx context.Context, httpClient HTTPClient, editorURL, lpID, title, authToken string) (*diagramResponse, error) {
	body, _ := json.Marshal(map[string]string{
		"learningPathId": lpID,
		"name":           title,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/diagrams/by-lp", editorURL), bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if authToken != "" {
		req.Header.Set("Authorization", "Bearer "+authToken)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// 200 OK = idempotent retry (diagram already exists), 201 Created = new diagram
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		var errorResp map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&errorResp); err == nil {
			if errorMsg, ok := errorResp["error"].(string); ok {
				return nil, fmt.Errorf("%s", errorMsg)
			}
		}
		return nil, fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	var dr diagramResponse
	if err := json.NewDecoder(resp.Body).Decode(&dr); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	if dr.ID == "" {
		return nil, errors.New("diagram _id missing from response")
	}

	return &dr, nil
}

// createLPWithSkillsInTransaction wraps LP and skill creation in a single PostgreSQL transaction
func (s *LearningPathService) createLPWithSkillsInTransaction(ctx context.Context, lpID uuid.UUID, title, description string, isPublic bool, thumbnail, diagramID, community string, skillNames []string) (*model.LearningPath, error) {
	lp := &model.LearningPath{
		ID:          lpID,
		Title:       title,
		Description: description,
		IsPublic:    isPublic,
		Thumbnail:   thumbnail,
		DiagramID:   diagramID,
		Community:   community,
	}

	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Create the learning path
		if err := tx.Create(lp).Error; err != nil {
			return fmt.Errorf("failed to create learning path: %w", err)
		}

		// Create skills and associations
		for _, skillName := range skillNames {
			var skill model.Skill
			if err := tx.Where("name = ?", skillName).First(&skill).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					skill = model.Skill{Name: skillName}
					if err := tx.Create(&skill).Error; err != nil {
						return fmt.Errorf("failed to create skill %s: %w", skillName, err)
					}
				} else {
					return fmt.Errorf("failed to query skill %s: %w", skillName, err)
				}
			}

			lpSkill := model.LPSkill{
				LPID:    lpID,
				SkillID: skill.ID,
			}
			if err := tx.Create(&lpSkill).Error; err != nil {
				return fmt.Errorf("failed to associate skill %s: %w", skillName, err)
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// Reload with skills outside transaction
	if err := s.DB.WithContext(ctx).Preload("Skills.Skill").First(lp, "id = ?", lpID).Error; err != nil {
		fmt.Printf("Warning: failed to reload LP with skills: %v\n", err)
	}
	populateSkillsList(lp)

	return lp, nil
}

func (s *LearningPathService) deleteDiagramByLP(_ context.Context, httpClient HTTPClient, baseURL, lpID, authToken string) error {
	// For compensation/cleanup operations, use a background context with a short timeout
	// to ensure cleanup completes even if the original request context is canceled
	cleanupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, _ := http.NewRequestWithContext(cleanupCtx, http.MethodDelete, fmt.Sprintf("%s/diagrams/by-lp/%s", baseURL, lpID), nil)
	if authToken != "" {
		req.Header.Set("Authorization", "Bearer "+authToken)
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	// 204 is expected; if not found, we consider it already cleaned up.
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusNotFound {
		return fmt.Errorf("unexpected status deleting diagram: %d", resp.StatusCode)
	}
	return nil
}

func (s *LearningPathService) DeleteLearningPath(ctx context.Context, lpID string, authToken string) error {
	// SAGA DELETE: Uses soft-delete pattern for safe distributed deletion
	//
	// Order of operations (saga-safe):
	// 1. Find the LP (validate it exists)
	// 2. Soft-delete LP in PostgreSQL (recoverable if MongoDB fails)
	// 3. Delete diagram from MongoDB
	// 4. If MongoDB fails, restore LP (undelete)
	// 5. If MongoDB succeeds, optionally hard-delete LP (or let cleanup job handle it)

	var lp model.LearningPath
	if err := s.DB.WithContext(ctx).Where("id = ?", lpID).First(&lp).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("learning path not found")
		}
		return fmt.Errorf("failed to find learning path: %w", err)
	}

	// SAGA STEP 1: Soft-delete LP in PostgreSQL (recoverable)
	// This uses GORM's soft-delete which sets DeletedAt timestamp
	if err := s.DB.WithContext(ctx).Delete(&lp).Error; err != nil {
		return fmt.Errorf("saga step 1 failed (soft-delete LP): %w", err)
	}

	// SAGA STEP 2: Delete diagram from MongoDB
	if err := s.deleteDiagramByLP(ctx, s.HTTPClient, s.EditorURL, lp.ID.String(), authToken); err != nil {
		// COMPENSATION: Restore the soft-deleted LP
		if restoreErr := s.restoreSoftDeletedLP(ctx, lp.ID); restoreErr != nil {
			// Critical: Both operations failed, LP is soft-deleted but diagram still exists
			fmt.Printf("SAGA COMPENSATION FAILED: LP %s is soft-deleted but diagram still exists in MongoDB. Error: %v\n", lpID, restoreErr)
			return fmt.Errorf("saga failed and compensation failed: delete diagram: %w, restore LP: %v", err, restoreErr)
		}
		return fmt.Errorf("saga step 2 failed (delete diagram), LP restored: %w", err)
	}

	// SAGA STEP 3: Hard-delete the LP now that MongoDB diagram is gone
	// This permanently removes the record (Unscoped bypasses soft-delete)
	if err := s.DB.WithContext(ctx).Unscoped().Delete(&lp).Error; err != nil {
		// Non-critical: LP is soft-deleted and diagram is gone, cleanup job can handle this
		fmt.Printf("Warning: hard-delete failed for LP %s, soft-delete remains: %v\n", lpID, err)
	}

	fmt.Printf("SAGA COMPLETED: LP %s deleted successfully\n", lpID)
	return nil
}

// restoreSoftDeletedLP restores a soft-deleted learning path (compensation action)
func (s *LearningPathService) restoreSoftDeletedLP(ctx context.Context, lpID uuid.UUID) error {
	// Use Unscoped to find soft-deleted records, then set DeletedAt to NULL
	return s.DB.WithContext(ctx).Unscoped().
		Model(&model.LearningPath{}).
		Where("id = ?", lpID).
		Update("deleted_at", nil).Error
}

// AddToFavorites adds a learning path to user's favorites
func (s *LearningPathService) AddToFavorites(ctx context.Context, userID uint, lpID string) error {
	// Parse string ID to UUID
	lpUUID, err := uuid.Parse(lpID)
	if err != nil {
		return fmt.Errorf("invalid learning path ID format: %w", err)
	}

	// Check if relationship already exists
	var userLP model.UserLP
	err = s.DB.WithContext(ctx).
		Where("user_id = ? AND lp_id = ?", userID, lpUUID).
		First(&userLP).Error

	if err == nil {
		// Relationship exists, just update IsFavorite
		userLP.IsFavorite = true
		return s.DB.Save(&userLP).Error
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	// Relationship doesn't exist, create favorite
	userLP = model.UserLP{
		UserID:     userID,
		LPID:       lpUUID,
		IsFavorite: true,
	}

	return s.DB.Create(&userLP).Error
}

// RemoveFromFavorites removes a learning path from user's favorites
func (s *LearningPathService) RemoveFromFavorites(ctx context.Context, userID uint, lpID string) error {
	// Parse string ID to UUID
	lpUUID, err := uuid.Parse(lpID)
	if err != nil {
		return fmt.Errorf("invalid learning path ID format: %w", err)
	}

	return s.DB.WithContext(ctx).
		Model(&model.UserLP{}).
		Where("user_id = ? AND lp_id = ?", userID, lpUUID).
		Update("is_favorite", false).Error
}

// GetUserFavorites retrieves all favorite learning paths for a user
func (s *LearningPathService) GetUserFavorites(ctx context.Context, userID uint) ([]model.LearningPath, error) {
	var paths []model.LearningPath
	err := s.DB.WithContext(ctx).
		Joins("JOIN user_lps ON user_lps.lp_id = learning_paths.id").
		Where("user_lps.user_id = ? AND user_lps.is_favorite = ?", userID, true).
		Preload("Skills.Skill").
		Find(&paths).Error

	if err != nil {
		return nil, err
	}

	populateSkillsListForPaths(paths)

	return paths, nil
}

// GetLearningPathsByCommunity retrieves all learning paths for a specific community
func (s *LearningPathService) GetLearningPathsByCommunity(ctx context.Context, communityName string) ([]model.LearningPath, error) {
	var paths []model.LearningPath
	err := s.DB.WithContext(ctx).
		Where("community = ?", communityName).
		Preload("Skills.Skill").
		Find(&paths).Error

	if err != nil {
		return nil, err
	}

	populateSkillsListForPaths(paths)

	return paths, nil
}
