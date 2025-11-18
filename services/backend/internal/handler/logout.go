package handler

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func Logout(c *gin.Context) {
	// Determine cookie domain and secure flag to match login settings
	rosettaDomain := os.Getenv("ROSETTA_DOMAIN")
	cookieDomain := rosettaDomain

	// Check if running in development
	isDevelopment := strings.Contains(cookieDomain, "localhost") || cookieDomain == "127.0.0.1" || cookieDomain == ""
	if isDevelopment {
		cookieDomain = "localhost"
	}

	// Match the Secure flag from login
	isSecure := !isDevelopment

	// Clear cookies with same settings used when they were created
	c.SetCookie("access_token", "", -1, "/", cookieDomain, isSecure, true)
	c.SetCookie("refresh_token", "", -1, "/", cookieDomain, isSecure, true)

	// Return success response
	c.JSON(http.StatusOK, gin.H{
		"message": "Logged out successfully",
	})
}
