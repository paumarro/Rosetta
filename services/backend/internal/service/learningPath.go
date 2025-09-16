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
	if err := s.DB.Preload("Courses").Find(&paths).Error; err != nil {
		return nil, err
	}
	return paths, nil
}

func (s *LearningPathService) CreateLearningPath(ctx context.Context, title, description string, isPublic bool, thumbnail string) (*model.LearningPath, error) {
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

	fmt.Println("LP created successfully")

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
