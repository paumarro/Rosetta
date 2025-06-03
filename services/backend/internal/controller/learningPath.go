package controller

import (
	"log"
	"net/http"

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
