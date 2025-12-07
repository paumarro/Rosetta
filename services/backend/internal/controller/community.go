package controller

import (
	"net/http"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/service"
	"github.com/gin-gonic/gin"
)

type CommunityController struct {
	CommunityService *service.CommunityService
}

func NewCommunityController(communityService *service.CommunityService) *CommunityController {
	return &CommunityController{
		CommunityService: communityService,
	}
}

func (ctrl *CommunityController) GetCommunities(c *gin.Context) {
	// Pass the request context for potential future use (logging, tracing, cancellation)
	communities := ctrl.CommunityService.GetCommunities(c.Request.Context())

	// gin.H is shorthand for map[string]interface{}
	c.JSON(http.StatusOK, gin.H{"communities": communities})
}
