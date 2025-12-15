package controller

import (
	"log"
	"net/http"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/model"
	"github.com/gin-gonic/gin"
)

// respondWithError sends a standardized error response
func respondWithError(c *gin.Context, code int, message string, details interface{}) {
	log.Printf("Error: %s, Details: %v", message, details)
	c.JSON(code, gin.H{"error": message})
}

// getUserFromContext extracts and type-asserts the authenticated user from context.
// Returns nil and sends an error response if the user is not found or invalid.
func getUserFromContext(c *gin.Context) *model.User {
	userInterface, exists := c.Get("user")
	if !exists {
		respondWithError(c, http.StatusUnauthorized, "User not authenticated", nil)
		return nil
	}

	user, ok := userInterface.(*model.User)
	if !ok {
		respondWithError(c, http.StatusInternalServerError, "Failed to get user information", nil)
		return nil
	}

	return user
}
