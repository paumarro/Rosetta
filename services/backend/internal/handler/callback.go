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
)

func Callback(c *gin.Context) {
	log.Println("Callback handler called")
	code := c.Query("code")
	if code == "" {
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get token", "details": err.Error()})
		return
	}
	defer func() {
		if resp != nil {
			resp.Body.Close()
		}
	}()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":    "Failed to get token",
			"status":   resp.StatusCode,
			"response": string(bodyBytes),
		})
		return
	}

	var tokenResponse map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode token response"})
		return
	}

	accessToken, ok := tokenResponse["access_token"].(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid token response"})
		return
	}

	refreshToken, ok := tokenResponse["refresh_token"].(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid token response: missing refresh token"})
		return
	}

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
