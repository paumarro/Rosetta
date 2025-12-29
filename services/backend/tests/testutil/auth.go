package testutil

import (
	"net/http"
	"net/http/httptest"
	"time"

	"github.com/gin-gonic/gin"
)

// MockTokenClaims represents typical JWT claims from Microsoft Entra ID
type MockTokenClaims struct {
	Sub               string   `json:"sub"`
	Oid               string   `json:"oid"`
	Email             string   `json:"email"`
	PreferredUsername string   `json:"preferred_username"`
	Name              string   `json:"name"`
	Groups            []string `json:"groups"`
	Aud               string   `json:"aud"`
	Iss               string   `json:"iss"`
	Exp               int64    `json:"exp"`
	Iat               int64    `json:"iat"`
}

// DefaultMockClaims returns a set of valid mock claims for testing
func DefaultMockClaims() MockTokenClaims {
	now := time.Now().Unix()
	return MockTokenClaims{
		Sub:               "test-subject-id",
		Oid:               "test-entra-id-12345",
		Email:             "test@example.com",
		PreferredUsername: "test@example.com",
		Name:              "Test User",
		Groups:            []string{},
		Aud:               "test-client-id",
		Iss:               "https://login.microsoftonline.com/test-tenant-id/v2.0",
		Exp:               now + 3600,
		Iat:               now,
	}
}

// CreateMockClaimsMap converts MockTokenClaims to a map[string]interface{} for use with OIDC
func CreateMockClaimsMap(claims MockTokenClaims) map[string]interface{} {
	result := map[string]interface{}{
		"sub":                claims.Sub,
		"oid":                claims.Oid,
		"email":              claims.Email,
		"preferred_username": claims.PreferredUsername,
		"name":               claims.Name,
		"aud":                claims.Aud,
		"iss":                claims.Iss,
		"exp":                float64(claims.Exp),
		"iat":                float64(claims.Iat),
	}

	if len(claims.Groups) > 0 {
		groups := make([]interface{}, len(claims.Groups))
		for i, g := range claims.Groups {
			groups[i] = g
		}
		result["groups"] = groups
	}

	return result
}

// CreateTestGinContext creates a Gin context for testing with optional auth headers/cookies
func CreateTestGinContext(options ...TestContextOption) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	// Create a basic request
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	// Apply options
	for _, opt := range options {
		opt(c)
	}

	return c, w
}

// TestContextOption is a function that configures a test Gin context
type TestContextOption func(*gin.Context)

// WithBearerToken adds a Bearer token to the Authorization header
func WithBearerToken(token string) TestContextOption {
	return func(c *gin.Context) {
		c.Request.Header.Set("Authorization", "Bearer "+token)
	}
}

// WithCookie adds a cookie to the request
func WithCookie(name, value string) TestContextOption {
	return func(c *gin.Context) {
		c.Request.AddCookie(&http.Cookie{
			Name:  name,
			Value: value,
		})
	}
}

// WithIDTokenCookie adds an id_token cookie to the request
func WithIDTokenCookie(token string) TestContextOption {
	return WithCookie("id_token", token)
}

// WithGraphAccessTokenCookie adds a graph_access_token cookie to the request
func WithGraphAccessTokenCookie(token string) TestContextOption {
	return WithCookie("graph_access_token", token)
}

// WithRequestPath sets the request path
func WithRequestPath(path string) TestContextOption {
	return func(c *gin.Context) {
		c.Request = httptest.NewRequest(http.MethodGet, path, nil)
	}
}

// WithRequestMethod sets the request method
func WithRequestMethod(method string) TestContextOption {
	return func(c *gin.Context) {
		c.Request.Method = method
	}
}

// AssertUnauthorized checks that the response is a 401 Unauthorized
func AssertUnauthorized(w *httptest.ResponseRecorder) bool {
	return w.Code == http.StatusUnauthorized
}

// AssertForbidden checks that the response is a 403 Forbidden
func AssertForbidden(w *httptest.ResponseRecorder) bool {
	return w.Code == http.StatusForbidden
}

// TestAuthEnv holds environment variables for auth testing
type TestAuthEnv struct {
	ClientID              string
	TenantID              string
	CommunityGroupMappings string
	AdminEmails           string
}

// DefaultTestAuthEnv returns default test auth environment values
func DefaultTestAuthEnv() TestAuthEnv {
	return TestAuthEnv{
		ClientID:              "test-client-id",
		TenantID:              "test-tenant-id",
		CommunityGroupMappings: "group-1:CommunityA,group-2:CommunityB",
		AdminEmails:           "admin@example.com",
	}
}
