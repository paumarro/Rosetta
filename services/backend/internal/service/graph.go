// BE/internal/service/graph.go
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

type GraphService struct {
	httpClient *http.Client
}

type Group struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	Description string `json:"description"`
}

func NewGraphService() *GraphService {
	return &GraphService{
		httpClient: &http.Client{},
	}
}

// GetUserPhoto fetches the user's profile photo from Microsoft Graph
func (s *GraphService) GetUserPhoto(ctx context.Context, accessToken string) ([]byte, error) {
	req, err := http.NewRequestWithContext(
		ctx,
		"GET",
		"https://graph.microsoft.com/v1.0/me/photo/$value",
		nil,
	)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return nil, nil // No photo available
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("failed to fetch photo: status %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

// GetUserGroups fetches the groups the user belongs to from Microsoft Graph
func (s *GraphService) GetUserGroups(ctx context.Context, accessToken string) ([]Group, error) {
	req, err := http.NewRequestWithContext(
		ctx,
		"GET",
		"https://graph.microsoft.com/v1.0/me/memberOf",
		nil,
	)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("failed to fetch groups: status %d", resp.StatusCode)
	}

	var result struct {
		Value []Group `json:"value"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	log.Printf("User belongs to %d groups", len(result.Value))
	for _, group := range result.Value {
		log.Printf("Group: %s (ID: %s)", group.DisplayName, group.ID)
	}

	return result.Value, nil
}
