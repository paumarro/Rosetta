package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/rosetta/auth-service/internal/service"
)

type OAuthHandler struct {
	authService *service.AuthService
}

func NewOAuthHandler(authService *service.AuthService) *OAuthHandler {
	return &OAuthHandler{
		authService: authService,
	}
}

// Login initiates the OAuth login flow by redirecting to Microsoft
// GET /auth/login
func (h *OAuthHandler) Login(c *gin.Context) {
	clientID := os.Getenv("OIDC_CLIENT_ID")
	redirectURI := os.Getenv("OIDC_REDIRECT_URI")

	// Get tenant ID from issuer
	issuer := os.Getenv("OIDC_ISSUER")
	tenantID := ExtractTenantIDFromIssuer(issuer)

	// Use ROSETTA_DOMAIN as the redirect target (don't trust Referer port)
	// In development with nginx, all services should be accessed through the proxy
	rosettaDomain := os.Getenv("ROSETTA_DOMAIN")
	if rosettaDomain == "" {
		rosettaDomain = "localhost"
	}
	
	// Determine scheme from referer, default to http
	scheme := "http"
	referer := c.GetHeader("Referer")
	if referer != "" {
		if parsedReferer, err := url.Parse(referer); err == nil && parsedReferer.Scheme != "" {
			scheme = parsedReferer.Scheme
		}
	}
	
	redirectDomain := fmt.Sprintf("%s://%s", scheme, rosettaDomain)

	// Build Microsoft OAuth URL
	// Include custom API scope for user consent without admin approval
	scopes := "api://academy-dev/GeneralAccess openid profile email offline_access"
	loginURL := fmt.Sprintf(
		"https://login.microsoftonline.com/%s/oauth2/v2.0/authorize?client_id=%s&response_type=code&redirect_uri=%s&scope=%s",
		tenantID,
		clientID,
		url.QueryEscape(redirectURI),
		url.QueryEscape(scopes),
	)

	// Pass redirect domain in state parameter
	loginURL = fmt.Sprintf("%s&state=%s", loginURL, url.QueryEscape(redirectDomain))

	log.Printf("Redirecting to Microsoft login, will return to: %s", redirectDomain)
	c.Redirect(http.StatusFound, loginURL)
}

// Callback handles the OAuth callback from Microsoft
// GET /auth/callback?code=...&state=...
func (h *OAuthHandler) Callback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		log.Println("Error: Authorization code not found in callback")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Authorization code not found"})
		return
	}

	// ALWAYS use ROSETTA_DOMAIN for redirects (ignore state parameter port)
	// The state parameter might contain old URLs with ports from previous sessions
	rosettaDomain := os.Getenv("ROSETTA_DOMAIN")
	if rosettaDomain == "" {
		rosettaDomain = "localhost"
	}
	
	// Determine scheme from state parameter if available, default to http
	scheme := "http"
	state := c.Query("state")
	if state != "" {
		if stateURL, err := url.QueryUnescape(state); err == nil {
			if parsed, parseErr := url.Parse(stateURL); parseErr == nil && parsed.Scheme != "" {
				scheme = parsed.Scheme
			}
		}
	}
	
	redirectDomain := fmt.Sprintf("%s://%s", scheme, rosettaDomain)

	clientID := os.Getenv("OIDC_CLIENT_ID")
	clientSecret := os.Getenv("OIDC_CLIENT_SECRET")
	redirectURI := os.Getenv("OIDC_REDIRECT_URI")

	// Get tenant ID from issuer
	issuer := os.Getenv("OIDC_ISSUER")
	tenantID := ExtractTenantIDFromIssuer(issuer)

	// Exchange authorization code for tokens
	tokenURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", tenantID)

	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", redirectURI)
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("scope", "api://academy-dev/GeneralAccess openid profile email offline_access")

	req, err := http.NewRequest("POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		log.Printf("Error: Failed to create token request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token request"})
		return
	}
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Error: Microsoft OAuth API error - Failed to exchange code: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Microsoft OAuth API error"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		log.Printf("Error: Microsoft OAuth token exchange failed with status %d: %s", resp.StatusCode, string(bodyBytes))
		c.JSON(http.StatusBadGateway, gin.H{"error": "Microsoft OAuth API error"})
		return
	}

	var tokenResponse map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResponse); err != nil {
		log.Printf("Error: Failed to decode Microsoft OAuth token response: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Microsoft OAuth API error"})
		return
	}

	accessToken, ok := tokenResponse["access_token"].(string)
	if !ok {
		log.Println("Error: access_token missing from Microsoft OAuth response")
		c.JSON(http.StatusBadGateway, gin.H{"error": "Microsoft OAuth API error"})
		return
	}

	idToken, ok := tokenResponse["id_token"].(string)
	if !ok {
		log.Println("Error: id_token missing from Microsoft OAuth response")
		c.JSON(http.StatusBadGateway, gin.H{"error": "Microsoft OAuth API error"})
		return
	}

	refreshToken, ok := tokenResponse["refresh_token"].(string)
	if !ok {
		log.Println("Error: refresh_token missing from Microsoft OAuth response")
		c.JSON(http.StatusBadGateway, gin.H{"error": "Microsoft OAuth API error"})
		return
	}

	// Validate the ID token and extract claims
	validationResult := h.authService.ValidateToken(idToken)
	if !validationResult.Valid {
		log.Printf("Error: ID token validation failed: %s", validationResult.Error)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid ID token"})
		return
	}

	log.Printf("User successfully authenticated: %s (%s)", validationResult.Email, validationResult.EntraID)

	// Set authentication cookies
	// Note: User will be created lazily in BE database on first authenticated request
	SetCookiesFromTokens(c, accessToken, refreshToken, idToken)

	log.Printf("Redirecting user to: %s", redirectDomain)
	c.Redirect(http.StatusFound, redirectDomain)
}

// Logout clears authentication cookies
// GET /auth/logout
func (h *OAuthHandler) Logout(c *gin.Context) {
	// Get redirect parameter
	redirectTo := c.Query("redirect")
	if redirectTo == "" {
		rosettaDomain := os.Getenv("ROSETTA_DOMAIN")
		if rosettaDomain == "" {
			rosettaDomain = "localhost"
		}
		redirectTo = fmt.Sprintf("http://%s", rosettaDomain)
	}

	// Clear cookies by setting them with negative max age
	cookieDomain := GetCookieDomain()
	isSecure := !IsDevelopment()

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("id_token", "", -1, "/", cookieDomain, isSecure, true)
	c.SetCookie("access_token", "", -1, "/", cookieDomain, isSecure, true)
	c.SetCookie("refresh_token", "", -1, "/", cookieDomain, isSecure, true)

	log.Printf("User logged out, redirecting to: %s", redirectTo)
	c.Redirect(http.StatusFound, redirectTo)
}
