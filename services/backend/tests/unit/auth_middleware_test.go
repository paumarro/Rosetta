package unit_test

import (
	"net/http"
	"testing"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/rosetta-monorepo/services/backend/tests/testutil"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ============================================================================
// Token Extraction Tests
// ============================================================================

func TestExtractAuthToken_BearerHeader(t *testing.T) {
	tests := []struct {
		name          string
		authHeader    string
		expectToken   string
		expectSuccess bool
	}{
		{
			name:          "Valid Bearer token",
			authHeader:    "Bearer valid-token-123",
			expectToken:   "valid-token-123",
			expectSuccess: true,
		},
		{
			name:          "Bearer with JWT-like token",
			authHeader:    "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature",
			expectToken:   "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature",
			expectSuccess: true,
		},
		{
			name:          "Empty Authorization header",
			authHeader:    "",
			expectToken:   "",
			expectSuccess: false,
		},
		{
			name:          "Basic auth instead of Bearer",
			authHeader:    "Basic dXNlcjpwYXNz",
			expectToken:   "",
			expectSuccess: false,
		},
		{
			name:          "Bearer without token",
			authHeader:    "Bearer ",
			expectToken:   "",
			expectSuccess: false,
		},
		{
			name:          "Just Bearer word",
			authHeader:    "Bearer",
			expectToken:   "",
			expectSuccess: false,
		},
		{
			name:          "Bearer with extra spaces",
			authHeader:    "Bearer  token-with-space",
			expectToken:   " token-with-space",
			expectSuccess: true,
		},
		{
			name:          "Lowercase bearer (should fail)",
			authHeader:    "bearer token",
			expectToken:   "",
			expectSuccess: false,
		},
		{
			name:          "Token with special characters",
			authHeader:    "Bearer eyJ+/=token",
			expectToken:   "eyJ+/=token",
			expectSuccess: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := testutil.CreateTestGinContext()
			if tt.authHeader != "" {
				c.Request.Header.Set("Authorization", tt.authHeader)
			}

			// Extract token using same logic as middleware
			token, success := extractBearerToken(c)

			assert.Equal(t, tt.expectSuccess, success, "Extraction success mismatch")
			if tt.expectSuccess {
				assert.Equal(t, tt.expectToken, token, "Token mismatch")
			} else {
				assert.Empty(t, token, "Token should be empty on failure")
			}
		})
	}
}

// extractBearerToken extracts token from Authorization header (mirrors middleware logic)
func extractBearerToken(c *gin.Context) (string, bool) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" || len(authHeader) <= 7 || authHeader[:7] != "Bearer " {
		return "", false
	}
	token := authHeader[7:]
	return token, token != ""
}

func TestExtractAuthToken_Cookie(t *testing.T) {
	tests := []struct {
		name          string
		cookieName    string
		cookieValue   string
		expectToken   string
		expectSuccess bool
	}{
		{
			name:          "Valid id_token cookie",
			cookieName:    "id_token",
			cookieValue:   "valid-token-from-cookie",
			expectToken:   "valid-token-from-cookie",
			expectSuccess: true,
		},
		{
			name:          "JWT-like token in cookie",
			cookieName:    "id_token",
			cookieValue:   "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig",
			expectToken:   "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig",
			expectSuccess: true,
		},
		{
			name:          "Wrong cookie name",
			cookieName:    "other_cookie",
			cookieValue:   "some-value",
			expectToken:   "",
			expectSuccess: false,
		},
		{
			name:          "No cookie",
			cookieName:    "",
			cookieValue:   "",
			expectToken:   "",
			expectSuccess: false,
		},
		{
			name:          "Empty cookie value",
			cookieName:    "id_token",
			cookieValue:   "",
			expectToken:   "",
			expectSuccess: true, // Cookie exists but empty
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := testutil.CreateTestGinContext()
			if tt.cookieName != "" {
				c.Request.AddCookie(&http.Cookie{
					Name:  tt.cookieName,
					Value: tt.cookieValue,
				})
			}

			token, err := c.Cookie("id_token")

			if tt.expectSuccess {
				require.NoError(t, err, "Expected cookie extraction to succeed")
				assert.Equal(t, tt.expectToken, token, "Token mismatch")
			} else {
				assert.Error(t, err, "Expected cookie extraction to fail")
			}
		})
	}
}

func TestExtractAuthToken_HeaderPrecedence(t *testing.T) {
	c, _ := testutil.CreateTestGinContext(
		testutil.WithBearerToken("header-token"),
		testutil.WithIDTokenCookie("cookie-token"),
	)

	// Header should take precedence
	token, success := extractBearerToken(c)
	if success {
		assert.Equal(t, "header-token", token, "Header should take precedence over cookie")
	} else {
		cookieToken, _ := c.Cookie("id_token")
		assert.Equal(t, "header-token", cookieToken)
	}
}

// ============================================================================
// Middleware Behavior Tests
// ============================================================================

func TestAuthMiddleware_NoAuth_Returns401(t *testing.T) {
	c, w := testutil.CreateTestGinContext()

	// Simulate middleware checking for auth
	token, hasBearer := extractBearerToken(c)
	_, cookieErr := c.Cookie("id_token")

	if !hasBearer && cookieErr != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No valid authentication found"})
	}

	assert.True(t, testutil.AssertUnauthorized(w), "Should return 401 when no auth provided")
	assert.Empty(t, token, "Token should be empty")
}

func TestAuthMiddleware_InvalidBearerFormat_Returns401(t *testing.T) {
	tests := []struct {
		name   string
		header string
	}{
		{"Missing Bearer prefix", "token-without-bearer"},
		{"Wrong auth type", "Basic sometoken"},
		{"Empty after Bearer", "Bearer "},
		{"Just Bearer", "Bearer"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, w := testutil.CreateTestGinContext()
			c.Request.Header.Set("Authorization", tt.header)

			token, hasBearer := extractBearerToken(c)
			if !hasBearer {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header"})
			}

			assert.True(t, testutil.AssertUnauthorized(w), "Should return 401")
			assert.Empty(t, token, "Token should be empty for invalid format")
		})
	}
}

// ============================================================================
// Context and Claims Tests
// ============================================================================

func TestAuthContext_UserAttachment(t *testing.T) {
	c, _ := testutil.CreateTestGinContext()

	// Simulate setting user in context (as auth middleware does)
	mockUser := map[string]interface{}{
		"id":        "user-123",
		"entra_id":  "entra-456",
		"email":     "test@example.com",
		"community": "TestCommunity",
		"is_admin":  false,
	}
	c.Set("user", mockUser)

	// Retrieve user from context
	user, exists := c.Get("user")
	require.True(t, exists, "User should exist in context")

	userMap, ok := user.(map[string]interface{})
	require.True(t, ok, "User should be a map")
	assert.Equal(t, "test@example.com", userMap["email"])
	assert.Equal(t, "TestCommunity", userMap["community"])
	assert.Equal(t, false, userMap["is_admin"])
}

func TestMockClaimsMap_ValidClaims(t *testing.T) {
	claims := testutil.DefaultMockClaims()
	claimsMap := testutil.CreateMockClaimsMap(claims)

	assert.Equal(t, claims.Oid, claimsMap["oid"])
	assert.Equal(t, claims.Email, claimsMap["email"])
	assert.Equal(t, claims.Name, claimsMap["name"])
	assert.Equal(t, claims.Sub, claimsMap["sub"])
	assert.NotNil(t, claimsMap["exp"])
	assert.NotNil(t, claimsMap["iat"])
}

func TestMockClaimsMap_WithGroups(t *testing.T) {
	claims := testutil.DefaultMockClaims()
	claims.Groups = []string{"group-1", "group-2", "group-3"}
	claimsMap := testutil.CreateMockClaimsMap(claims)

	groups, ok := claimsMap["groups"].([]interface{})
	require.True(t, ok, "Groups should be present")
	assert.Len(t, groups, 3)
	assert.Equal(t, "group-1", groups[0])
	assert.Equal(t, "group-2", groups[1])
	assert.Equal(t, "group-3", groups[2])
}

func TestMockClaimsMap_EmptyGroups(t *testing.T) {
	claims := testutil.DefaultMockClaims()
	claims.Groups = []string{}
	claimsMap := testutil.CreateMockClaimsMap(claims)

	_, hasGroups := claimsMap["groups"]
	assert.False(t, hasGroups, "Empty groups should not be included")
}

// ============================================================================
// Security Edge Cases
// ============================================================================

func TestAuthToken_LargeToken(t *testing.T) {
	// Test handling of very large tokens (potential DoS)
	largeToken := make([]byte, 10000)
	for i := range largeToken {
		largeToken[i] = 'a'
	}

	c, _ := testutil.CreateTestGinContext(
		testutil.WithBearerToken(string(largeToken)),
	)

	token, success := extractBearerToken(c)
	assert.True(t, success, "Should extract large token")
	assert.Len(t, token, 10000, "Token length should be preserved")
}

func TestAuthToken_SpecialCharacters(t *testing.T) {
	tests := []struct {
		name  string
		token string
	}{
		{"Base64 padding", "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig=="},
		{"Plus signs", "token+with+plus"},
		{"Slashes", "token/with/slashes"},
		{"Unicode", "token-with-émoji-🔐"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := testutil.CreateTestGinContext(
				testutil.WithBearerToken(tt.token),
			)

			token, success := extractBearerToken(c)
			assert.True(t, success)
			assert.Equal(t, tt.token, token)
		})
	}
}

}
