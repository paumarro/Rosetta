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

	originalURL := c.Query("state")

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

	c.SetCookie("refresh_token", refreshToken, 3600*24, "/", rosettaDomain, true, true)

	c.SetCookie("access_token", accessToken, 3600, "/", rosettaDomain, true, true)

	fmt.Printf("Access and refresh tokens set in cookies\n")

	if originalURL != "" {
		c.Redirect(http.StatusFound, originalURL)
	} else {
		c.JSON(http.StatusOK, gin.H{"message": "Token stored in cookie"})
	}
}
