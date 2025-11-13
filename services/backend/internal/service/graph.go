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

// GetUserProfile fetches basic user profile info
func (s *GraphService) GetUserProfile(ctx context.Context, accessToken string) (map[string]interface{}, error) {
	req, err := http.NewRequestWithContext(
		ctx,
		"GET",
		"https://graph.microsoft.com/v1.0/me",
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

	var profile map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return nil, err
	}
	log.Printf("User Profile: %+v", profile)
	return profile, nil
}
