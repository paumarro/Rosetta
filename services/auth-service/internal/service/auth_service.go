package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
)

type AuthService struct {
	provider     *oidc.Provider
	verifier     *oidc.IDTokenVerifier
	clientID     string
	clientSecret string
	redirectURI  string
	tenantID     string
}

type TokenValidationResult struct {
	Valid   bool                   `json:"valid"`
	Claims  map[string]interface{} `json:"claims,omitempty"`
	EntraID string                 `json:"entra_id,omitempty"`
	Email   string                 `json:"email,omitempty"`
	Name    string                 `json:"name,omitempty"`
	Error   string                 `json:"error,omitempty"`
}

type TokenRefreshResult struct {
	Success      bool   `json:"success"`
	AccessToken  string `json:"access_token,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`
	IDToken      string `json:"id_token,omitempty"`
	ExpiresIn    int    `json:"expires_in,omitempty"`
	Error        string `json:"error,omitempty"`
}

func NewAuthService(issuer, clientID, clientSecret, redirectURI string) (*AuthService, error) {
	// Extract tenant ID from issuer URL if it's in the Microsoft format
	tenantID := ExtractTenantID(issuer)

	ctx := context.Background()

	// Build full issuer URL for Microsoft OIDC
	fullIssuer := issuer
	if !strings.Contains(issuer, "login.microsoftonline.com") {
		fullIssuer = fmt.Sprintf("https://login.microsoftonline.com/%s/v2.0", issuer)
	} else if !strings.HasSuffix(issuer, "/v2.0") {
		fullIssuer = fmt.Sprintf("%s/v2.0", issuer)
	}

	provider, err := oidc.NewProvider(ctx, fullIssuer)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize OIDC provider: %w", err)
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: clientID})

	return &AuthService{
		provider:     provider,
		verifier:     verifier,
		clientID:     clientID,
		clientSecret: clientSecret,
		redirectURI:  redirectURI,
		tenantID:     tenantID,
	}, nil
}

// ValidateToken validates an OIDC ID token and returns claims
func (s *AuthService) ValidateToken(token string) *TokenValidationResult {
	ctx := context.Background()

	idToken, err := s.verifier.Verify(ctx, token)
	if err != nil {
		return &TokenValidationResult{
			Valid: false,
			Error: fmt.Sprintf("Token verification failed: %v", err),
		}
	}

	// Extract claims
	claims := make(map[string]interface{})
	if err := idToken.Claims(&claims); err != nil {
		return &TokenValidationResult{
			Valid: false,
			Error: fmt.Sprintf("Failed to parse claims: %v", err),
		}
	}

	// Extract standard fields
	entraID, _ := claims["oid"].(string)
	email, _ := claims["email"].(string)
	name, _ := claims["name"].(string)

	// Also try preferred_username if email is not present
	if email == "" {
		email, _ = claims["preferred_username"].(string)
	}

	if entraID == "" {
		return &TokenValidationResult{
			Valid: false,
			Error: "Missing oid claim in token",
		}
	}

	return &TokenValidationResult{
		Valid:   true,
		Claims:  claims,
		EntraID: entraID,
		Email:   email,
		Name:    name,
	}
}

// RefreshToken exchanges a refresh token for new access and ID tokens
func (s *AuthService) RefreshToken(refreshToken string) *TokenRefreshResult {
	tokenURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", s.tenantID)

	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", refreshToken)
	data.Set("client_id", s.clientID)
	data.Set("client_secret", s.clientSecret)
	data.Set("scope", "api://academy-dev/GeneralAccess openid profile email offline_access")

	req, err := http.NewRequest("POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return &TokenRefreshResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to create refresh request: %v", err),
		}
	}
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return &TokenRefreshResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to call refresh endpoint: %v", err),
		}
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return &TokenRefreshResult{
			Success: false,
			Error:   fmt.Sprintf("Token refresh failed with status %d: %s", resp.StatusCode, string(bodyBytes)),
		}
	}

	var tokenResponse map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &tokenResponse); err != nil {
		return &TokenRefreshResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to decode token response: %v", err),
		}
	}

	accessToken, _ := tokenResponse["access_token"].(string)
	newRefreshToken, _ := tokenResponse["refresh_token"].(string)
	idToken, _ := tokenResponse["id_token"].(string)
	expiresIn, _ := tokenResponse["expires_in"].(float64)

	// If refresh token is not returned, use the old one
	if newRefreshToken == "" {
		newRefreshToken = refreshToken
	}

	if accessToken == "" || idToken == "" {
		return &TokenRefreshResult{
			Success: false,
			Error:   "Missing tokens in refresh response",
		}
	}

	return &TokenRefreshResult{
		Success:      true,
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		IDToken:      idToken,
		ExpiresIn:    int(expiresIn),
	}
}

// ExtractTenantID extracts tenant ID from various issuer formats.
// Supports plain tenant ID or full URL like "https://login.microsoftonline.com/TENANT_ID/v2.0"
func ExtractTenantID(issuer string) string {
	// If it's already just the tenant ID
	if !strings.Contains(issuer, "http") && !strings.Contains(issuer, "/") {
		return issuer
	}

	// Extract from URL like https://login.microsoftonline.com/{tenant}/v2.0
	parts := strings.Split(issuer, "/")
	for i, part := range parts {
		if part == "login.microsoftonline.com" && i+1 < len(parts) {
			return parts[i+1]
		}
	}

	return issuer
}
