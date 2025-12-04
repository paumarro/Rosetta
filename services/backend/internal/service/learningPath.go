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

	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LearningPathService struct {
	DB *gorm.DB
}

func NewLearningPathService(db *gorm.DB) *LearningPathService {
	return &LearningPathService{DB: db}
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

	// Extract skills from join table into SkillsList
	for i := range paths {
		paths[i].SkillsList = make([]model.Skill, 0, len(paths[i].Skills))
		for _, lpSkill := range paths[i].Skills {
			paths[i].SkillsList = append(paths[i].SkillsList, lpSkill.Skill)
		}
	}

	return paths, nil
}

func (s *LearningPathService) CreateLearningPath(ctx context.Context, title, description string, isPublic bool, thumbnail string, skillNames []string, authToken string) (*model.LearningPath, error) {
	lpID := uuid.New()

	editorURL := os.Getenv("EDITOR_BASE_URL")
	if editorURL == "" {
		editorURL = "http://localhost:3001"
	}

	body, _ := json.Marshal(map[string]string{
		"learningPathId": lpID.String(),
		"name":           title,
	})

	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/api/diagrams/by-lp", editorURL), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if authToken != "" {
		req.Header.Set("Authorization", "Bearer "+authToken)
	}

	httpClient := &http.Client{Timeout: 10 * time.Second}

	// Step 2: create diagram in Mongo (idempotent)
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("create diagram request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("create diagram failed: status %d", resp.StatusCode)
	}

	var dr diagramResponse
	if err := json.NewDecoder(resp.Body).Decode(&dr); err != nil {
		return nil, fmt.Errorf("decode diagram response failed: %w", err)
	}
	if dr.ID == "" {
		return nil, errors.New("diagram _id missing from response")
	}

	lp := &model.LearningPath{
		ID:          lpID,
		Title:       title,
		Description: description,
		IsPublic:    isPublic,
		Thumbnail:   thumbnail,
		DiagramID:   dr.ID,
	}

	// Step 5: insert LP row; compensate on failure
	if err := s.DB.WithContext(ctx).Create(lp).Error; err != nil {
		// Compensation: delete the Mongo diagram we just created
		_ = s.deleteDiagramByLP(ctx, httpClient, editorURL, lpID.String())
		return nil, fmt.Errorf("postgres insert failed: %w", err)
	}

	// Step 6: Create skills for the learning path
	for _, skillName := range skillNames {
		// First, find or create the skill
		var skill model.Skill
		if err := s.DB.WithContext(ctx).Where("name = ?", skillName).First(&skill).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				// Skill doesn't exist, create it
				skill = model.Skill{Name: skillName}
				if err := s.DB.WithContext(ctx).Create(&skill).Error; err != nil {
					fmt.Printf("Warning: failed to create skill %s: %v\n", skillName, err)
					continue
				}
			} else {
				fmt.Printf("Warning: failed to query skill %s: %v\n", skillName, err)
				continue
			}
		}

		// Create the LPSkill association
		lpSkill := model.LPSkill{
			LPID:    lpID,
			SkillID: skill.ID,
		}
		if err := s.DB.WithContext(ctx).Create(&lpSkill).Error; err != nil {
			fmt.Printf("Warning: failed to associate skill %s with LP: %v\n", skillName, err)
		}
	}

	// Reload the learning path with skills
	if err := s.DB.WithContext(ctx).Preload("Skills.Skill").First(lp, "id = ?", lpID).Error; err != nil {
		fmt.Printf("Warning: failed to reload LP with skills: %v\n", err)
	}

	// Extract skills from join table into SkillsList
	lp.SkillsList = make([]model.Skill, 0, len(lp.Skills))
	for _, lpSkill := range lp.Skills {
		lp.SkillsList = append(lp.SkillsList, lpSkill.Skill)
	}

	fmt.Println("LP created successfully with skills")

	return lp, nil
}

func (s *LearningPathService) deleteDiagramByLP(_ context.Context, httpClient *http.Client, baseURL, lpID string) error {
	// For compensation/cleanup operations, use a background context with a short timeout
	// to ensure cleanup completes even if the original request context is canceled
	cleanupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, _ := http.NewRequestWithContext(cleanupCtx, http.MethodDelete, fmt.Sprintf("%s/api/diagrams/by-lp/%s", baseURL, lpID), nil)
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

func (s *LearningPathService) DeleteLearningPath(ctx context.Context, lpID string) error {
	// First, find the learning path to get its UUID and diagram ID
	var lp model.LearningPath
	if err := s.DB.WithContext(ctx).Where("id = ?", lpID).First(&lp).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("learning path not found")
		}
		return fmt.Errorf("failed to find learning path: %w", err)
	}

	editorURL := os.Getenv("EDITOR_BASE_URL")
	if editorURL == "" {
		editorURL = "http://localhost:3001"
	}

	httpClient := &http.Client{Timeout: 10 * time.Second}

	// Delete the diagram from MongoDB using the LP UUID
	if err := s.deleteDiagramByLP(ctx, httpClient, editorURL, lp.ID.String()); err != nil {
		return fmt.Errorf("failed to delete diagram: %w", err)
	}

	// Delete the learning path from PostgreSQL
	if err := s.DB.WithContext(ctx).Delete(&lp).Error; err != nil {
		return fmt.Errorf("failed to delete learning path: %w", err)
	}

	return nil
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

	// Extract skills into SkillsList
	for i := range paths {
		paths[i].SkillsList = make([]model.Skill, 0, len(paths[i].Skills))
		for _, lpSkill := range paths[i].Skills {
			paths[i].SkillsList = append(paths[i].SkillsList, lpSkill.Skill)
		}
	}

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

	// Extract skills into SkillsList
	for i := range paths {
		paths[i].SkillsList = make([]model.Skill, 0, len(paths[i].Skills))
		for _, lpSkill := range paths[i].Skills {
			paths[i].SkillsList = append(paths[i].SkillsList, lpSkill.Skill)
		}
	}

	return paths, nil
}
