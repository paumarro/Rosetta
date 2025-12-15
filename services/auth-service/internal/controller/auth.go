package controller

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rosetta/auth-service/internal/service"
	"github.com/rosetta/auth-service/internal/util"
)

type AuthController struct {
	authService *service.AuthService
}

func NewAuthController(authService *service.AuthService) *AuthController {
	return &AuthController{
		authService: authService,
	}
}

// Login initiates the OAuth login flow by redirecting to Microsoft
// GET /auth/login
func (ctrl *AuthController) Login(c *gin.Context) {
	clientID := os.Getenv("OIDC_CLIENT_ID")
	redirectURI := os.Getenv("OIDC_REDIRECT_URI")
	tenantID := service.ExtractTenantID(os.Getenv("OIDC_ISSUER"))

	loginURL := fmt.Sprintf(
		"https://login.microsoftonline.com/%s/oauth2/v2.0/authorize?client_id=%s&response_type=code&redirect_uri=%s&scope=%s",
		tenantID,
		clientID,
		url.QueryEscape(redirectURI),
		url.QueryEscape(service.OAuthScope),
	)

	log.Printf("Redirecting to Microsoft login")
	c.Redirect(http.StatusFound, loginURL)
}

// Callback handles the OAuth callback from Microsoft
// GET /auth/callback?code=...
func (ctrl *AuthController) Callback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		log.Println("Error: Authorization code not found in callback")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Authorization code not found"})
		return
	}

	clientID := os.Getenv("OIDC_CLIENT_ID")
	clientSecret := os.Getenv("OIDC_CLIENT_SECRET")
	redirectURI := os.Getenv("OIDC_REDIRECT_URI")
	tenantID := service.ExtractTenantID(os.Getenv("OIDC_ISSUER"))

	tokenURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", tenantID)

	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", redirectURI)
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("scope", service.OAuthScope)

	req, err := http.NewRequest("POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		log.Printf("Error: Failed to create token request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token request"})
		return
	}
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
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

	validationResult := ctrl.authService.ValidateToken(idToken)
	if !validationResult.Valid {
		log.Printf("Error: ID token validation failed: %s", validationResult.Error)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid ID token"})
		return
	}

	log.Printf("User successfully authenticated: %s (%s)", validationResult.Email, validationResult.EntraID)

	// Request Graph API access token using the refresh token
	graphAccessToken, err := ctrl.authService.GetGraphToken(refreshToken)
	if err != nil {
		log.Printf("Warning: Failed to get Graph API token: %v", err)
		graphAccessToken = "" // Continue without graph token
	} else {
		log.Printf("Graph API token obtained successfully")
	}

	util.SetCookiesFromTokens(c, accessToken, refreshToken, idToken, graphAccessToken)

	redirectURL := util.GetRedirectURL()
	log.Printf("Redirecting user to: %s", redirectURL)
	c.Redirect(http.StatusFound, redirectURL)
}

// Logout clears authentication cookies
// GET /auth/logout
func (ctrl *AuthController) Logout(c *gin.Context) {
	redirectTo := c.Query("redirect")

	// Validate redirect URL to prevent open redirect attacks
	if redirectTo != "" {
		if !isAllowedRedirect(redirectTo) {
			log.Printf("Warning: Blocked invalid redirect URL: %s", redirectTo)
			redirectTo = ""
		}
	}
	if redirectTo == "" {
		redirectTo = util.GetRedirectURL()
	}

	cookieDomain := util.GetCookieDomain()
	isSecure := !util.IsDevelopment()

	// Use environment-aware SameSite policy (consistent with SetCookiesFromTokens)
	if util.IsDevelopment() {
		c.SetSameSite(http.SameSiteLaxMode)
	} else {
		c.SetSameSite(http.SameSiteNoneMode)
	}

	// Clear all authentication cookies including graph_access_token
	c.SetCookie("id_token", "", -1, "/", cookieDomain, isSecure, true)
	c.SetCookie("access_token", "", -1, "/", cookieDomain, isSecure, true)
	c.SetCookie("refresh_token", "", -1, "/", cookieDomain, isSecure, true)
	c.SetCookie("graph_access_token", "", -1, "/", cookieDomain, isSecure, true)

	log.Printf("User logged out, redirecting to: %s", redirectTo)
	c.Redirect(http.StatusFound, redirectTo)
}

// isAllowedRedirect validates that the redirect URL is safe
func isAllowedRedirect(redirectURL string) bool {
	// Allow relative paths
	if strings.HasPrefix(redirectURL, "/") && !strings.HasPrefix(redirectURL, "//") {
		return true
	}

	// Parse the URL
	parsed, err := url.Parse(redirectURL)
	if err != nil {
		return false
	}

	// Only allow http/https schemes
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return false
	}

	// Get allowed domain from environment
	allowedDomain := util.GetRosettaDomain()

	// Check if host matches allowed domain (including localhost for dev)
	host := parsed.Hostname()
	if host == "localhost" || host == allowedDomain || strings.HasSuffix(host, "."+allowedDomain) {
		return true
	}

	return false
}

// RefreshToken exchanges a refresh token for new tokens
// POST /auth/refresh
func (ctrl *AuthController) RefreshToken(c *gin.Context) {
	var refreshToken string

	// Try JSON body first
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := c.ShouldBindJSON(&req); err == nil && req.RefreshToken != "" {
		refreshToken = req.RefreshToken
	} else {
		// Try refresh_token cookie
		cookieToken, err := c.Cookie("refresh_token")
		if err != nil {
			log.Printf("Refresh failed: No refresh token provided - %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Refresh token required in body or cookie"})
			return
		}
		refreshToken = cookieToken
	}

	log.Printf("Refreshing token (length: %d)", len(refreshToken))

	result := ctrl.authService.RefreshToken(refreshToken)

	if !result.Success {
		log.Printf("Token refresh failed: %s", result.Error)
		c.JSON(http.StatusUnauthorized, result)
		return
	}

	log.Printf("Token refreshed successfully, expires in: %d seconds", result.ExpiresIn)

	// Request Graph API access token using the refresh token
	graphAccessToken, err := ctrl.authService.GetGraphToken(result.RefreshToken)
	if err != nil {
		log.Printf("Warning: Failed to get Graph API token during refresh: %v", err)
		graphAccessToken = "" // Continue without graph token
	} else {
		log.Printf("Graph API token obtained successfully during refresh")
	}

	util.SetCookiesFromTokens(c, result.AccessToken, result.RefreshToken, result.IDToken, graphAccessToken)

	c.JSON(http.StatusOK, result)
}
