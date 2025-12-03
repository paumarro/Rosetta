package controller

import (
	"net/http"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/service"
	"github.com/gin-gonic/gin"
)

// CommunityController handles HTTP requests for community-related endpoints
// It's a thin layer that delegates business logic to CommunityService
type CommunityController struct {
	CommunityService *service.CommunityService
}

// NewCommunityController creates a new CommunityController
// Parameters:
//   - communityService: Service layer containing community business logic
func NewCommunityController(communityService *service.CommunityService) *CommunityController {
	return &CommunityController{
		CommunityService: communityService,
	}
}

// GetCommunities returns the list of available communities
// GET /api/communities
//
// HTTP Layer Responsibilities:
// 1. Extract context from the request
// 2. Call the service layer to get communities
// 3. Format the response as JSON
// 4. Handle any errors (though GetCommunities currently never errors)
//
// Response: {"communities": ["Engineering", "Design", "Sales", "Marketing", "Operations"]}
func (ctrl *CommunityController) GetCommunities(c *gin.Context) {
	// Get communities from the service layer
	// Pass the request context for potential future use (logging, tracing, cancellation)
	communities := ctrl.CommunityService.GetCommunities(c.Request.Context())

	// Return as JSON with a "communities" key containing the array
	// gin.H is shorthand for map[string]interface{}
	c.JSON(http.StatusOK, gin.H{"communities": communities})
}
