package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/initializer"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/service"
	"github.com/coreos/go-oidc"
	"github.com/gin-gonic/gin"
)

func Callback(c *gin.Context) {
	log.Println("Callback handler called")
	code := c.Query("code")
	if code == "" {
		log.Println("Error: Authorization code not found")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Authorization code not found"})
		return
	}

	// Get the redirect domain from state (this is now the domain, not a path)
	state := c.Query("state")
	redirectDomain, err := url.QueryUnescape(state)
	if err != nil || redirectDomain == "" {
		rosettaDomain := os.Getenv("ROSETTA_DOMAIN")
		redirectDomain = fmt.Sprintf("http://%s", rosettaDomain)
	}

	clientID := os.Getenv("CLIENT_ID")
	clientSecret := os.Getenv("CLIENT_SECRET")
	tenantID := os.Getenv("TENANT_ID")
	rosettaDomain := os.Getenv("ROSETTA_DOMAIN")

	redirectURL := fmt.Sprintf("http://%s/callback", rosettaDomain)
	tokenURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", tenantID)

	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", redirectURL)
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("scope", "openid profile email")

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
		log.Printf("Error: Microsoft OAuth API error - Failed to exchange authorization code for token: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Microsoft OAuth API error"})
		return
	}
	defer func() {
		if resp != nil {
			resp.Body.Close()
		}
	}()

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

	// Verify and decode the ID token to create/update user in database
	ctx := context.Background()
	provider, err := oidc.NewProvider(ctx, "https://login.microsoftonline.com/"+tenantID+"/v2.0")
	if err != nil {
		log.Printf("Error: Failed to initialize OIDC provider: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize OIDC provider"})
		return
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: clientID})
	parsedIDToken, err := verifier.Verify(ctx, idToken)
	if err != nil {
		log.Printf("Error: Failed to verify ID token: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to verify ID token"})
		return
	}

	// Extract claims and create/update user
	claims := map[string]interface{}{}
	if err := parsedIDToken.Claims(&claims); err != nil {
		log.Printf("Error: Failed to parse token claims: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse token claims"})
		return
	}

	// Create or update user in database
	userService := service.NewUserService(initializer.DB)
	user, err := userService.GetOrCreateUser(claims)
	if err != nil {
		log.Printf("Error: Failed to create/update user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user account"})
		return
	}

	log.Printf("User successfully authenticated and registered: %s (%s)", user.Email, user.EntraID)

	// Determine cookie domain based on the redirect domain
	var cookieDomain string
	if parsedDomain, err := url.Parse(redirectDomain); err == nil {
		cookieDomain = parsedDomain.Hostname()
	} else {
		cookieDomain = rosettaDomain
	}
	// Optional: Add logging for debugging
	fmt.Printf("Callback - State: %s, Redirect Domain: %s\n", state, redirectDomain)

	c.SetCookie("refresh_token", refreshToken, 3600*24, "/", cookieDomain, true, true)

	c.SetCookie("access_token", accessToken, 3600, "/", cookieDomain, true, true)

	fmt.Printf("Access and refresh tokens set in cookies for domain: %s\n", cookieDomain)

	fmt.Printf("Access and refresh tokens set in cookies\n")

	c.Redirect(http.StatusFound, redirectDomain)
}
