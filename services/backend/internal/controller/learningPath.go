package controller

import (
	"log"
	"net/http"
	"strings"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/model"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/service"
	"github.com/gin-gonic/gin"
)

type LearningPathController struct {
	LearningPathService *service.LearningPathService
}

func NewLearningPathController(learningPathService *service.LearningPathService) *LearningPathController {
	return &LearningPathController{
		LearningPathService: learningPathService,
	}
}

// Helper function to send error responses
func respondWithError(c *gin.Context, code int, message string, details interface{}) {
	log.Printf("Error: %s, Details: %v", message, details)
	c.JSON(code, gin.H{"error": message})
}

func (res *LearningPathController) Index(c *gin.Context) {
	paths, err := res.LearningPathService.GetLearningPaths()
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to fetch learning paths", err)
		return
	}

	c.JSON(http.StatusOK, paths)
}

type CreateLearningPathRequest struct {
	PathName    string   `json:"pathName" binding:"required"`
	Description string   `json:"description"`
	Skills      []string `json:"skills"`
}

func (res *LearningPathController) Create(c *gin.Context) {
	var req CreateLearningPathRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithError(c, http.StatusBadRequest, "Invalid request format", err)
		return
	}

	// Get authenticated user
	user, exists := c.Get("user")
	if !exists {
		respondWithError(c, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	userModel, ok := user.(*model.User)
	if !ok {
		respondWithError(c, http.StatusInternalServerError, "Failed to get user information", nil)
		return
	}

	// Determine community: from URL param (new way) or user's community (backward compat)
	communityName := c.Param("communityname")
	if communityName == "" {
		// Backward compatibility: use user's community if no URL param
		communityName = userModel.Community
	}

	// Validate community
	if communityName == "" {
		respondWithError(c, http.StatusForbidden, "You must be assigned to a community to create learning paths", nil)
		return
	}

	// Validate community exists
	communityService := service.NewCommunityService()
	if !communityService.IsValidCommunity(c, communityName) {
		respondWithError(c, http.StatusNotFound, "Community not found", nil)
		return
	}

	// AUTHORIZATION: Check if user is admin
	userService := service.NewUserService(res.LearningPathService.DB)
	isAdmin := userService.IsAdmin(userModel.Email)

	// AUTHORIZATION: User must be in community OR be admin
	if userModel.Community != communityName && !isAdmin {
		respondWithError(c, http.StatusForbidden, "You can only create learning paths for your own community", nil)
		return
	}

	// Extract token for service-to-service calls
	authToken, _ := c.Cookie("id_token")

	learningPath, err := res.LearningPathService.CreateLearningPath(c, req.PathName, req.Description, true, "", req.Skills, authToken, communityName)
	if err != nil {
		// Check if error is about duplicate name
		errMsg := err.Error()
		if strings.Contains(errMsg, "already exists") || strings.Contains(errMsg, "duplicate") {
			respondWithError(c, http.StatusConflict, errMsg, err)
			return
		}
		respondWithError(c, http.StatusInternalServerError, "Failed to create learning path", err)
		return
	}

	c.JSON(http.StatusCreated, learningPath)
}

func (res *LearningPathController) Delete(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		respondWithError(c, http.StatusBadRequest, "Learning path ID is required", nil)
		return
	}

	err := res.LearningPathService.DeleteLearningPath(c, id)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to delete learning path", err)
		return
	}

	c.Status(http.StatusNoContent)
}

func (res *LearningPathController) AddToFavorites(c *gin.Context) {
	// Extract authenticated user from context
	user, exists := c.Get("user")
	if !exists {
		respondWithError(c, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	userModel, ok := user.(*model.User)
	if !ok {
		respondWithError(c, http.StatusInternalServerError, "Failed to get user information", nil)
		return
	}

	// Extract learning path ID from URL
	lpID := c.Param("id")
	if lpID == "" {
		respondWithError(c, http.StatusBadRequest, "Learning path ID is required", nil)
		return
	}

	// Call service to add to favorites
	err := res.LearningPathService.AddToFavorites(c, userModel.ID, lpID)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to add to favorites", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully added to favorites"})
}

func (res *LearningPathController) RemoveFromFavorites(c *gin.Context) {
	// Extract authenticated user from context
	user, exists := c.Get("user")
	if !exists {
		respondWithError(c, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	userModel, ok := user.(*model.User)
	if !ok {
		respondWithError(c, http.StatusInternalServerError, "Failed to get user information", nil)
		return
	}

	// Extract learning path ID from URL
	lpID := c.Param("id")
	if lpID == "" {
		respondWithError(c, http.StatusBadRequest, "Learning path ID is required", nil)
		return
	}

	// Call service to remove from favorites
	err := res.LearningPathService.RemoveFromFavorites(c, userModel.ID, lpID)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to remove from favorites", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully removed from favorites"})
}

func (res *LearningPathController) GetUserFavorites(c *gin.Context) {
	// Extract authenticated user from context
	user, exists := c.Get("user")
	if !exists {
		respondWithError(c, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	userModel, ok := user.(*model.User)
	if !ok {
		respondWithError(c, http.StatusInternalServerError, "Failed to get user information", nil)
		return
	}

	// Get user's favorite learning paths
	favorites, err := res.LearningPathService.GetUserFavorites(c, userModel.ID)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to fetch favorite learning paths", err)
		return
	}

	c.JSON(http.StatusOK, favorites)
}

func (res *LearningPathController) GetByCommunity(c *gin.Context) {
	communityName := c.Param("communityname")
	if communityName == "" {
		respondWithError(c, http.StatusBadRequest, "Community name is required", nil)
		return
	}

	paths, err := res.LearningPathService.GetLearningPathsByCommunity(c, communityName)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to fetch learning paths for community", err)
		return
	}

	c.JSON(http.StatusOK, paths)
}
