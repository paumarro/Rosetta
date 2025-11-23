package util

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// GetRosettaDomain returns the ROSETTA_DOMAIN env var or "localhost" as default
func GetRosettaDomain() string {
	domain := os.Getenv("ROSETTA_DOMAIN")
	if domain == "" {
		return "localhost"
	}
	return domain
}

// GetRedirectURL returns the full redirect URL based on environment.
// Development: http://localhost, Production: https://domain
func GetRedirectURL() string {
	domain := GetRosettaDomain()
	if IsDevelopment() {
		return "http://" + domain
	}
	return "https://" + domain
}

// SetCookiesFromTokens sets authentication cookies with the provided tokens
func SetCookiesFromTokens(c *gin.Context, accessToken, refreshToken, idToken string) {
	cookieDomain := GetCookieDomain()
	isSecure := !IsDevelopment()

	if IsDevelopment() {
		c.SetSameSite(http.SameSiteLaxMode)
	} else {
		c.SetSameSite(http.SameSiteNoneMode)
		isSecure = true
	}

	c.SetCookie("id_token", idToken, 3600, "/", cookieDomain, isSecure, true)
	c.SetCookie("access_token", accessToken, 3600, "/", cookieDomain, isSecure, true)
	c.SetCookie("refresh_token", refreshToken, 3600*24, "/", cookieDomain, isSecure, true)

	log.Printf("Cookies set for domain: %s (Secure: %v)", cookieDomain, isSecure)
}

// GetCookieDomain determines the appropriate cookie domain based on environment
func GetCookieDomain() string {
	rosettaDomain := os.Getenv("ROSETTA_DOMAIN")
	if rosettaDomain == "" {
		rosettaDomain = "localhost"
	}

	if strings.Contains(rosettaDomain, "localhost") || rosettaDomain == "127.0.0.1" {
		return "localhost"
	}

	if strings.Contains(rosettaDomain, ":") {
		parts := strings.Split(rosettaDomain, ":")
		return parts[0]
	}

	return rosettaDomain
}

// IsDevelopment checks if the application is running in development mode
func IsDevelopment() bool {
	rosettaDomain := os.Getenv("ROSETTA_DOMAIN")
	return rosettaDomain == "" ||
		strings.Contains(rosettaDomain, "localhost") ||
		strings.Contains(rosettaDomain, "127.0.0.1")
}
