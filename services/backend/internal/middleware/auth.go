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
			// Get id_token from cookie (used for user identity validation)
			idToken, err := c.Cookie("id_token")
			if err != nil {
				log.Printf("Error fetching id_token cookie: %v", err)
				c.JSON(http.StatusUnauthorized, gin.H{"error": "No access token provided"})
				c.Abort()
				return
			}
			authHeader = "Bearer " + idToken
			c.Request.Header.Set("Authorization", authHeader)
		}

		token := ""
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format"})
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

		// Get or create user (lazy provisioning - user created on first authenticated request)
		userService := service.NewUserService(initializer.DB)
		user, err := userService.GetOrCreateUser(claims)
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
