package middleware

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"

	"github.com/coreos/go-oidc"
	"github.com/gin-gonic/gin"
)

func redirectToLogin(c *gin.Context, originalURL string) {
	clientID := os.Getenv("CLIENT_ID")
	tenantID := os.Getenv("TENANT_ID")
	rosettaDomain := os.Getenv("ROSETTA_DOMAIN")
	redirectURL := fmt.Sprintf("http://%s/callback", rosettaDomain)

	loginURL := fmt.Sprintf(
		"https://login.microsoftonline.com/%s/oauth2/v2.0/authorize?client_id=%s&response_type=code&redirect_uri=%s&scope=api://academy-dev/GeneralAccess openid profile email offline_access",
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
				fmt.Println("Error fetching access_token cookie:", err)
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

		claims := map[string]interface{}{}
		if err := idToken.Claims(&claims); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse claims: " + err.Error()})
			c.Abort()
			return
		}

		c.Set("claims", claims)

		c.Next()
	}
}
