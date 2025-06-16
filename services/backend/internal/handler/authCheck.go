package handler

import (
	"context"
	"net/http"
	"os"

	"github.com/coreos/go-oidc"
	"github.com/gin-gonic/gin"
)

func AuthCheck(c *gin.Context) {
	clientID := os.Getenv("CLIENT_ID")
	tenantID := os.Getenv("TENANT_ID")

	//Try to get access token from cookie
	accessToken, err := c.Cookie("access_token")
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"authenticated": false})
		return
	}
	//Verify token
	ctx := context.Background()
	provider, err := oidc.NewProvider(ctx, "https://login.microsoftonline.com/"+tenantID+"/v2.0")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize OIDC provider"})
		return
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: clientID})
	_, err = verifier.Verify(ctx, accessToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"authenticated": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{"authenticated": true})

}
