package unit_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/rosetta-monorepo/services/auth-service/internal/util"
)

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	os.Exit(m.Run())
}

// ============================================================================
// GetCookieDomain Tests
// ============================================================================

func TestGetCookieDomain_Localhost(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "localhost")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	domain := util.GetCookieDomain()
	assert.Equal(t, "localhost", domain)
}

func TestGetCookieDomain_LocalhostWithPort(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "localhost:3000")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	domain := util.GetCookieDomain()
	assert.Equal(t, "localhost", domain)
}

func TestGetCookieDomain_127001(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "127.0.0.1")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	domain := util.GetCookieDomain()
	assert.Equal(t, "localhost", domain)
}

func TestGetCookieDomain_ProductionDomain(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "app.example.com")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	domain := util.GetCookieDomain()
	assert.Equal(t, "app.example.com", domain)
}

func TestGetCookieDomain_ProductionDomainWithPort(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "app.example.com:443")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	domain := util.GetCookieDomain()
	assert.Equal(t, "app.example.com", domain)
}

func TestGetCookieDomain_AzureContainerApps(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "nginx.purplebay-96c2df34.westeurope.azurecontainerapps.io")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	domain := util.GetCookieDomain()
	assert.Equal(t, "nginx.purplebay-96c2df34.westeurope.azurecontainerapps.io", domain)
}

func TestGetCookieDomain_EmptyDefault(t *testing.T) {
	os.Unsetenv("ROSETTA_DOMAIN")

	domain := util.GetCookieDomain()
	assert.Equal(t, "localhost", domain)
}

// ============================================================================
// IsDevelopment Tests
// ============================================================================

func TestIsDevelopment_Localhost(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "localhost")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	assert.True(t, util.IsDevelopment())
}

func TestIsDevelopment_127001(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "127.0.0.1")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	assert.True(t, util.IsDevelopment())
}

func TestIsDevelopment_Empty(t *testing.T) {
	os.Unsetenv("ROSETTA_DOMAIN")

	assert.True(t, util.IsDevelopment())
}

func TestIsDevelopment_Production(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "app.example.com")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	assert.False(t, util.IsDevelopment())
}

func TestIsDevelopment_AzureContainerApps(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "nginx.purplebay-96c2df34.westeurope.azurecontainerapps.io")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	assert.False(t, util.IsDevelopment())
}

// ============================================================================
// GetRedirectURL Tests
// ============================================================================

func TestGetRedirectURL_Development(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "localhost")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	url := util.GetRedirectURL()
	assert.Equal(t, "http://localhost", url)
}

func TestGetRedirectURL_Production(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "app.example.com")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	url := util.GetRedirectURL()
	assert.Equal(t, "https://app.example.com", url)
}

// ============================================================================
// SetCookiesFromTokens Tests - Cookie Security Attributes
// ============================================================================

func TestSetCookiesFromTokens_Development_HttpOnly(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "localhost")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	util.SetCookiesFromTokens(c, "access", "refresh", "id-token", "")

	// Check cookies in response
	cookies := w.Result().Cookies()
	require.GreaterOrEqual(t, len(cookies), 3, "Should set at least 3 cookies")

	for _, cookie := range cookies {
		assert.True(t, cookie.HttpOnly, "Cookie %s should be HttpOnly", cookie.Name)
	}
}

func TestSetCookiesFromTokens_Production_Secure(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "app.example.com")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	util.SetCookiesFromTokens(c, "access", "refresh", "id-token", "")

	cookies := w.Result().Cookies()
	require.GreaterOrEqual(t, len(cookies), 3, "Should set at least 3 cookies")

	for _, cookie := range cookies {
		assert.True(t, cookie.Secure, "Cookie %s should be Secure in production", cookie.Name)
	}
}

func TestSetCookiesFromTokens_Development_NotSecure(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "localhost")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	util.SetCookiesFromTokens(c, "access", "refresh", "id-token", "")

	cookies := w.Result().Cookies()
	require.GreaterOrEqual(t, len(cookies), 3, "Should set at least 3 cookies")

	for _, cookie := range cookies {
		assert.False(t, cookie.Secure, "Cookie %s should NOT be Secure in development", cookie.Name)
	}
}

func TestSetCookiesFromTokens_SetsAllCookies(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "localhost")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	util.SetCookiesFromTokens(c, "my-access", "my-refresh", "my-id-token", "")

	cookies := w.Result().Cookies()
	cookieMap := make(map[string]*http.Cookie)
	for _, cookie := range cookies {
		cookieMap[cookie.Name] = cookie
	}

	// Verify all expected cookies are set
	assert.Contains(t, cookieMap, "id_token", "Should set id_token cookie")
	assert.Contains(t, cookieMap, "access_token", "Should set access_token cookie")
	assert.Contains(t, cookieMap, "refresh_token", "Should set refresh_token cookie")

	// Verify values
	assert.Equal(t, "my-id-token", cookieMap["id_token"].Value)
	assert.Equal(t, "my-access", cookieMap["access_token"].Value)
	assert.Equal(t, "my-refresh", cookieMap["refresh_token"].Value)
}

func TestSetCookiesFromTokens_GraphToken(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "localhost")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	util.SetCookiesFromTokens(c, "access", "refresh", "id-token", "graph-token")

	cookies := w.Result().Cookies()
	cookieMap := make(map[string]*http.Cookie)
	for _, cookie := range cookies {
		cookieMap[cookie.Name] = cookie
	}

	assert.Contains(t, cookieMap, "graph_access_token", "Should set graph_access_token cookie")
	assert.Equal(t, "graph-token", cookieMap["graph_access_token"].Value)
}

func TestSetCookiesFromTokens_NoGraphTokenWhenEmpty(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "localhost")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	util.SetCookiesFromTokens(c, "access", "refresh", "id-token", "")

	cookies := w.Result().Cookies()
	for _, cookie := range cookies {
		assert.NotEqual(t, "graph_access_token", cookie.Name, "Should NOT set graph_access_token when empty")
	}
}

func TestSetCookiesFromTokens_PathIsRoot(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "localhost")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	util.SetCookiesFromTokens(c, "access", "refresh", "id-token", "")

	cookies := w.Result().Cookies()
	for _, cookie := range cookies {
		assert.Equal(t, "/", cookie.Path, "Cookie %s should have Path=/", cookie.Name)
	}
}

func TestSetCookiesFromTokens_RefreshTokenLongerExpiry(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "localhost")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	util.SetCookiesFromTokens(c, "access", "refresh", "id-token", "")

	cookies := w.Result().Cookies()
	cookieMap := make(map[string]*http.Cookie)
	for _, cookie := range cookies {
		cookieMap[cookie.Name] = cookie
	}

	// Refresh token should have longer MaxAge (24 hours = 86400 seconds)
	// ID token and access token should have 1 hour = 3600 seconds
	assert.Equal(t, 3600, cookieMap["id_token"].MaxAge, "id_token should expire in 1 hour")
	assert.Equal(t, 3600, cookieMap["access_token"].MaxAge, "access_token should expire in 1 hour")
	assert.Equal(t, 86400, cookieMap["refresh_token"].MaxAge, "refresh_token should expire in 24 hours")
}

// ============================================================================
// SameSite Cookie Attribute Tests
// ============================================================================

func TestSetCookiesFromTokens_Production_SameSiteNone(t *testing.T) {
	// SameSite=None is used in production for cross-origin OAuth flows
	// This requires Secure=true to be set (tested separately)
	os.Setenv("ROSETTA_DOMAIN", "app.example.com")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	util.SetCookiesFromTokens(c, "access", "refresh", "id-token", "")

	cookies := w.Result().Cookies()
	require.GreaterOrEqual(t, len(cookies), 3, "Should set at least 3 cookies")

	for _, cookie := range cookies {
		// SameSite=None allows cross-site requests (needed for OAuth redirects)
		// Must be combined with Secure=true (verified in separate test)
		assert.Equal(t, http.SameSiteNoneMode, cookie.SameSite,
			"Cookie %s should have SameSite=None for cross-origin OAuth support", cookie.Name)
	}
}

func TestSetCookiesFromTokens_Development_SameSite(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "localhost")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	util.SetCookiesFromTokens(c, "access", "refresh", "id-token", "")

	cookies := w.Result().Cookies()
	require.GreaterOrEqual(t, len(cookies), 3, "Should set at least 3 cookies")

	// In development, SameSite can be Lax (more permissive for testing)
	for _, cookie := range cookies {
		// Should still have a valid SameSite value set
		assert.True(t, cookie.SameSite != http.SameSiteDefaultMode,
			"Cookie %s should have explicit SameSite attribute set", cookie.Name)
	}
}

// ============================================================================
// GetRosettaDomain Tests
// ============================================================================

func TestGetRosettaDomain_Set(t *testing.T) {
	os.Setenv("ROSETTA_DOMAIN", "custom.example.com")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	domain := util.GetRosettaDomain()
	assert.Equal(t, "custom.example.com", domain)
}

func TestGetRosettaDomain_Empty(t *testing.T) {
	os.Unsetenv("ROSETTA_DOMAIN")

	domain := util.GetRosettaDomain()
	assert.Equal(t, "localhost", domain)
}

// ============================================================================
// Security Edge Cases
// ============================================================================

func TestCookieDomain_NoPortLeakage(t *testing.T) {
	// This tests the bug fix documented in BUGFIX_AUTH_REDIRECT.md
	// Port numbers should be stripped from cookie domain
	testCases := []struct {
		input    string
		expected string
	}{
		{"app.example.com:8080", "app.example.com"},
		{"localhost:3000", "localhost"},
		{"api.rosetta.io:443", "api.rosetta.io"},
	}

	for _, tc := range testCases {
		t.Run(tc.input, func(t *testing.T) {
			os.Setenv("ROSETTA_DOMAIN", tc.input)
			defer os.Unsetenv("ROSETTA_DOMAIN")

			domain := util.GetCookieDomain()
			assert.Equal(t, tc.expected, domain, "Port should be stripped from domain")
		})
	}
}

func TestCookies_NeverExposeSecretInDevelopment(t *testing.T) {
	// Even in development, HttpOnly should be true to prevent XSS
	os.Setenv("ROSETTA_DOMAIN", "localhost")
	defer os.Unsetenv("ROSETTA_DOMAIN")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	util.SetCookiesFromTokens(c, "secret-access", "secret-refresh", "secret-id", "")

	cookies := w.Result().Cookies()
	for _, cookie := range cookies {
		assert.True(t, cookie.HttpOnly,
			"Cookie %s MUST be HttpOnly even in development to prevent XSS", cookie.Name)
	}
}
