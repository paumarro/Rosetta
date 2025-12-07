package controller

import (
	"net/http"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/model"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/service"
	"github.com/gin-gonic/gin"
)

type UserController struct {
	UserService  *service.UserService
	GraphService *service.GraphService
}

func NewUserController(userService *service.UserService) *UserController {
	return &UserController{
		UserService:  userService,
		GraphService: service.NewGraphService(),
	}
}

// Dashboard is a simple welcome endpoint
// GET /
func (ctrl *UserController) Dashboard(c *gin.Context) {
}

// GetCurrentUser returns the authenticated user
// GET /api/user/me
func (ctrl *UserController) GetCurrentUser(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		respondWithError(c, http.StatusUnauthorized, "User not found", nil)
		return
	}

	user := userInterface.(*model.User)
	isAdmin := ctrl.UserService.IsAdmin(user.Email)

	response := map[string]interface{}{
		"ID":        user.ID,
		"CreatedAt": user.CreatedAt,
		"UpdatedAt": user.UpdatedAt,
		"DeletedAt": user.DeletedAt,
		"Name":      user.Name,
		"Email":     user.Email,
		"EntraID":   user.EntraID,
		"PhotoURL":  user.PhotoURL,
		"Community": user.Community,
		"IsAdmin":   isAdmin,
	}

	c.JSON(http.StatusOK, response)
}

// GetUserPhoto returns the user's photo from Microsoft Graph
// GET /api/user/photo
func (ctrl *UserController) GetUserPhoto(c *gin.Context) {
	accessToken, err := c.Cookie("access_token")
	if err != nil {
		respondWithError(c, http.StatusUnauthorized, "Not authenticated", nil)
		return
	}

	photo, err := ctrl.GraphService.GetUserPhoto(c.Request.Context(), accessToken)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, err.Error(), nil)
		return
	}

	if photo == nil {
		respondWithError(c, http.StatusNotFound, "No photo available", nil)
		return
	}

	c.Data(http.StatusOK, "image/jpeg", photo)
}

type UpdateUserRequest struct {
	Name     *string `json:"name,omitempty"`
	PhotoURL *string `json:"photoURL,omitempty"`
}

// UpdateCurrentUser updates the authenticated user's profile
// PATCH /api/user/me
func (ctrl *UserController) UpdateCurrentUser(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		respondWithError(c, http.StatusUnauthorized, "User not found", nil)
		return
	}

	user := userInterface.(*model.User)

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithError(c, http.StatusBadRequest, "Invalid request body", nil)
		return
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.PhotoURL != nil {
		updates["photo_url"] = *req.PhotoURL
	}

	if len(updates) == 0 {
		c.JSON(http.StatusOK, user)
		return
	}

	updatedUser, err := ctrl.UserService.UpdateUser(user.ID, updates)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to update user", err)
		return
	}

	c.JSON(http.StatusOK, updatedUser)
}

//

func (ctrl *UserController) SetUserCommunity(c *gin.Context) {
	// Define request structure
	// `json:"community"` - Maps JSON field to struct field
	// `binding:"required"` - Gin validates this field must be present and non-empty
	var req struct {
		Community string `json:"community" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithError(c, http.StatusBadRequest, "Invalid request", err)
		return
	}

	userInterface, _ := c.Get("user")
	user := userInterface.(*model.User)

	updates := map[string]interface{}{
		"community": req.Community,
	}

	// Service handles: finding user, validating allowed fields, database update
	updatedUser, err := ctrl.UserService.UpdateUser(user.ID, updates)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to update community", err)
		return
	}

	// Return updated user as JSON
	c.JSON(http.StatusOK, updatedUser)
}
