package middleware

import (
	"context"
	"log"
	"net/http"
	"os"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/initializer"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/service"
	"github.com/coreos/go-oidc"
	"github.com/gin-gonic/gin"
)

// isDebugEnabled checks if auth debug logging is enabled
func isDebugEnabled() bool {
	return os.Getenv("AUTH_DEBUG") == "true"
}

// extractAuthToken extracts the authentication token from Authorization header or id_token cookie
func extractAuthToken(c *gin.Context) (string, error) {
	// Check Authorization header first (for API clients)
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" && len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		if isDebugEnabled() {
			log.Print("[DEBUG] Token found in Authorization header")
		}
		return authHeader[7:], nil
	}

	// Fall back to id_token cookie (primary method for browser clients)
	idToken, err := c.Cookie("id_token")
	if err != nil {
		return "", err
	}

	if isDebugEnabled() {
		log.Print("[DEBUG] Token found in id_token cookie")
	}
	return idToken, nil
}

func Auth() gin.HandlerFunc {
	clientID := os.Getenv("CLIENT_ID")
	tenantID := os.Getenv("TENANT_ID")

	ctx := context.Background()
	provider, err := oidc.NewProvider(ctx, "https://login.microsoftonline.com/"+tenantID+"/v2.0")
	if err != nil {
		panic("Failed to initialize OIDC provider: " + err.Error())
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: clientID})

	return func(c *gin.Context) {
		token, err := extractAuthToken(c)
		if err != nil {
			log.Print("[ERROR] No valid authentication found")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No valid authentication found"})
			c.Abort()
			return
		}

		idToken, err := verifier.Verify(ctx, token)
		if err != nil {
			log.Printf("Token verification failed: %v", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Token refresh is now handled by the frontend calling auth-service directly
		// No need to refresh here - just validate the token

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

		// Get Graph API access token from cookie
		graphAccessToken, err := c.Cookie("graph_access_token")
		if err != nil {
			log.Printf("Warning: graph_access_token not found in cookies: %v", err)
			graphAccessToken = "" // Continue without graph token, community won't be updated
		}

		// Get or create user (lazy provisioning - user created on first authenticated request)
		userService := service.NewUserService(initializer.DB)
		graphService := service.NewGraphService()
		user, err := userService.GetOrCreateUser(claims, graphService, graphAccessToken)
		if err != nil {
			log.Printf("Failed to get/create user: %s - %v", entraID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process user account"})
			c.Abort()
			return
		}

		c.Set("user", user) // Make user available in handlers
		c.Next()
	}
}
