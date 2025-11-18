package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/initializer"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/service"
	"github.com/coreos/go-oidc"
	"github.com/gin-gonic/gin"
)

// TokenRefreshResponse represents the response from auth-service refresh endpoint
type TokenRefreshResponse struct {
	Success      bool   `json:"success"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	IDToken      string `json:"id_token"`
	ExpiresIn    int    `json:"expires_in"`
	Error        string `json:"error"`
}

// shouldRefreshToken checks if a token should be refreshed (expires in < 5 minutes)
func shouldRefreshToken(idToken *oidc.IDToken) bool {
	timeUntilExpiry := time.Until(idToken.Expiry)
	shouldRefresh := timeUntilExpiry < 5*time.Minute

	if shouldRefresh {
		log.Printf("🔄 Token expires in %v, will refresh", timeUntilExpiry)
	}

	return shouldRefresh
}

// refreshTokenViaAuthService calls auth-service to refresh the access token
func refreshTokenViaAuthService(c *gin.Context, refreshToken string) (*TokenRefreshResponse, error) {
	authServiceURL := os.Getenv("AUTH_SERVICE_URL")
	if authServiceURL == "" {
		authServiceURL = "http://localhost:3002"
	}

	// Prepare request body
	reqBody := map[string]string{
		"refresh_token": refreshToken,
	}
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Call auth-service refresh endpoint
	req, err := http.NewRequest("POST", authServiceURL+"/api/auth/refresh", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call auth-service: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var refreshResp TokenRefreshResponse
	if err := json.Unmarshal(body, &refreshResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !refreshResp.Success {
		return nil, fmt.Errorf("token refresh failed: %s", refreshResp.Error)
	}

	log.Printf("✅ Token refreshed successfully via auth-service, expires in: %d seconds", refreshResp.ExpiresIn)
	return &refreshResp, nil
}

// updateCookiesWithNewTokens sets new token cookies after refresh
func updateCookiesWithNewTokens(c *gin.Context, tokens *TokenRefreshResponse) {
	rosettaDomain := os.Getenv("ROSETTA_DOMAIN")
	cookieDomain := rosettaDomain

	// Use localhost for local development
	isDevelopment := cookieDomain == "" || cookieDomain == "localhost:8080"
	if isDevelopment {
		cookieDomain = "localhost"
	}

	// Secure flag should only be true in production (HTTPS)
	// In development (HTTP), browsers won't send cookies with Secure flag
	isSecure := !isDevelopment

	// Set SameSite mode for cross-port cookie sharing
	c.SetSameSite(http.SameSiteLaxMode)

	// Update access token cookie (1 hour)
	c.SetCookie("access_token", tokens.AccessToken, 3600, "/", cookieDomain, isSecure, true)

	// Update refresh token cookie (24 hours)
	c.SetCookie("refresh_token", tokens.RefreshToken, 3600*24, "/", cookieDomain, isSecure, true)

	log.Printf("🍪 Cookies updated with refreshed tokens for domain: %s, Secure: %v", cookieDomain, isSecure)
}

func redirectToLogin(c *gin.Context, originalURL string) {
	clientID := os.Getenv("CLIENT_ID")
	tenantID := os.Getenv("TENANT_ID")
	rosettaDomain := os.Getenv("ROSETTA_DOMAIN")
	redirectURL := fmt.Sprintf("http://%s/callback", rosettaDomain)

	loginURL := fmt.Sprintf(
		"https://login.microsoftonline.com/%s/oauth2.0/authorize?client_id=%s&response_type=code&redirect_uri=%s&scope=api://academy-dev/GeneralAccess openid profile email offline_access User.Read",
		tenantID,
		clientID,
		redirectURL,
	)
	loginURL = fmt.Sprintf("%s&state=%s", loginURL, url.QueryEscape(originalURL))
	c.Redirect(http.StatusFound, loginURL)
	c.Abort()
}

func Auth() gin.HandlerFunc {
	log.Println("Auth Middleware called")
	clientID := os.Getenv("CLIENT_ID")
	tenantID := os.Getenv("TENANT_ID")

	ctx := context.Background()
	provider, err := oidc.NewProvider(ctx, "https://login.microsoftonline.com/"+tenantID+"/v2.0")
	if err != nil {
		panic("Failed to initialize OIDC provider: " + err.Error())
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: clientID})

	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		log.Printf("Authorization Header: %s", authHeader)
		if authHeader == "" {
			log.Print("No Auth header found")
			accessToken, err := c.Cookie("access_token")
			if err != nil {
				log.Printf("Error fetching access_token cookie: %v", err)
				originalURL := c.Request.URL.String()
				redirectToLogin(c, originalURL)
				redirectToLogin(c, c.Request.URL.String())
				return
			}
			authHeader = "Bearer " + accessToken
			c.Request.Header.Set("Authorization", authHeader)
		}

		token := ""
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		} else {
			redirectToLogin(c, c.Request.URL.String())
			return
		}

		idToken, err := verifier.Verify(ctx, token)
		if err != nil {
			log.Printf("Token verification failed: %v", err)
			redirectToLogin(c, c.Request.URL.String())
			return
		}

		// Check if token is expiring soon and refresh if needed
		if shouldRefreshToken(idToken) {
			refreshToken, err := c.Cookie("refresh_token")
			if err != nil {
				log.Printf("⚠️ Token expiring soon but no refresh token found: %v", err)
				// Continue with current token - will fail next time if expired
			} else {
				// Call auth-service to refresh the token
				newTokens, err := refreshTokenViaAuthService(c, refreshToken)
				if err != nil {
					log.Printf("⚠️ Failed to refresh token: %v", err)
					// Continue with current token - will fail next time if expired
				} else {
					// Update cookies with new tokens
					updateCookiesWithNewTokens(c, newTokens)

					// Use the new access token for the rest of this request
					token = newTokens.IDToken
					authHeader = "Bearer " + token
					c.Request.Header.Set("Authorization", authHeader)

					// Re-verify the new token
					idToken, err = verifier.Verify(ctx, token)
					if err != nil {
						log.Printf("New token verification failed: %v", err)
						redirectToLogin(c, c.Request.URL.String())
						return
					}
				}
			}
		}

		// Extract Entra ID from token
		claims := map[string]interface{}{}
		if err := idToken.Claims(&claims); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse claims: " + err.Error()})
			c.Abort()
			return
		}

		entraID, ok := claims["oid"].(string)
		if !ok || entraID == "" {
			log.Printf("Missing oid claim in token")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token: missing user identifier"})
			c.Abort()
			return
		}

		// Load user from database (must already exist from callback)
		userService := service.NewUserService(initializer.DB)
		user, err := userService.GetUserByEntraID(entraID)
		if err != nil {
			log.Printf("User not found in database: %s - %v", entraID, err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User account not found. Please log in again."})
			c.Abort()
			return
		}

		c.Set("user", user) // Make user available in handlers
		c.Next()
	}
}
