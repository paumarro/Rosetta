package handler

import (
	"fmt"
	"net/http"
	"net/url"
	"os"

	"github.com/gin-gonic/gin"
)

func Login(c *gin.Context) {
	clientID := os.Getenv("CLIENT_ID")
	tenantID := os.Getenv("TENANT_ID")
	rosettaDomain := os.Getenv("ROSETTA_DOMAIN")
	redirectURL := fmt.Sprintf("http://%s/callback", rosettaDomain) // The callback URL that Microsoft will redirect to after authentication

	referer := c.GetHeader("Referer")
	var redirectDomain string
	if referer != "" {
		if parsedReferer, err := url.Parse(referer); err == nil {
			redirectDomain = fmt.Sprintf("%s://%s", parsedReferer.Scheme, parsedReferer.Host)
		}
	}

	if redirectDomain == "" {
		redirectDomain = fmt.Sprintf("http://%s", rosettaDomain)
	}

	loginURL := fmt.Sprintf(
		"https://login.microsoftonline.com/%s/oauth2/v2.0/authorize?client_id=%s&response_type=code&redirect_uri=%s&scope=api://academy-dev/GeneralAccess openid profile email offline_access",
		tenantID,
		clientID,
		redirectURL,
	)
	loginURL = fmt.Sprintf("%s&state=%s", loginURL, url.QueryEscape(redirectDomain))
	c.Redirect(http.StatusFound, loginURL)
	c.Abort()
}
