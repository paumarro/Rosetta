package controller

import (
	"log"
	"net/http"

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

	learningPath, err := res.LearningPathService.CreateLearningPath(c, req.PathName, req.Description, true, "", req.Skills)
	if err != nil {
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

// TODO(human): Implement AddToFavorites controller method
// This method should:
// 1. Extract the authenticated user from context using c.Get("user")
// 2. Type assert to *model.User and handle the case where user doesn't exist
// 3. Extract the learning path ID from URL parameters using c.Param("id")
// 4. Validate that the ID is not empty
// 5. Call res.LearningPathService.AddToFavorites(c, user.ID, id)
// 6. Handle errors appropriately with respondWithError
// 7. Return 200 OK with success message on success
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
