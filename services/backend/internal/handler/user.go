package handler

import (
	"net/http"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/initializer"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/model"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/service"
	"github.com/gin-gonic/gin"
)

func GetUserPhoto(c *gin.Context) {
	// Get access token from cookie
	accessToken, err := c.Cookie("access_token")
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	graphService := service.NewGraphService()
	photo, err := graphService.GetUserPhoto(c.Request.Context(), accessToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if photo == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No photo available"})
		return
	}

	// Return photo as image
	c.Data(http.StatusOK, "image/jpeg", photo)
}

func GetCurrentUser(c *gin.Context) {
	// Get user from context (set by middleware)
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	user := userInterface.(*model.User)
	c.JSON(http.StatusOK, user)
}

type UpdateUserRequest struct {
	Name     *string `json:"name,omitempty"`
	PhotoURL *string `json:"photoURL,omitempty"`
}

func UpdateCurrentUser(c *gin.Context) {
	// Get user from context (set by middleware)
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	user := userInterface.(*model.User)

	// Parse request body
	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Build updates map with only provided fields
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.PhotoURL != nil {
		updates["photo_url"] = *req.PhotoURL
	}

	// If no fields to update, return current user
	if len(updates) == 0 {
		c.JSON(http.StatusOK, user)
		return
	}

	// Update user
	userService := service.NewUserService(initializer.DB)
	updatedUser, err := userService.UpdateUser(user.ID, updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	c.JSON(http.StatusOK, updatedUser)
}
