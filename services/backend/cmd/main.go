package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/rosetta-monorepo/services/backend/internal/controller"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/rosetta-monorepo/services/backend/internal/initializer"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/rosetta-monorepo/services/backend/internal/middleware"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/rosetta-monorepo/services/backend/internal/service"
	env "dev.azure.com/carbyte/Carbyte-Academy/_git/rosetta-monorepo/services/backend/pkg"
)

func init() {
	env.LoadEnvVariables(".env")
	initializer.ConnectToDB()
}

func main() {
	allowOrigins := []string{
		os.Getenv("ROSETTA_FE"),
	}

	r := gin.Default()

	// Add CORS middleware - allow frontend origin
	r.Use(cors.New(cors.Config{
		AllowOrigins:     allowOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept", "X-Requested-With"},
		AllowCredentials: true,
	}))

	// Initialize services
	userService := service.NewUserService(initializer.DB)
	learningPathService := service.NewLearningPathService(initializer.DB)
	communityService := service.NewCommunityService()

	// Initialize controllers
	userController := controller.NewUserController(userService)
	lpController := controller.NewLearningPathController(learningPathService)
	communityController := controller.NewCommunityController(communityService)

	// Protected routes - all require authentication
	protected := r.Group("/")
	protected.Use(middleware.Auth())
	{

		// User API
		protected.GET("/api/user/me", userController.GetCurrentUser)
		protected.PATCH("/api/user/me", userController.UpdateCurrentUser)
		protected.POST("/api/user/me/community", userController.SetUserCommunity)
		protected.GET("/api/user/photo", userController.GetUserPhoto)

		// Community API
		protected.GET("/api/communities", communityController.GetCommunities)
		protected.GET("/api/communities/:communityname/learning-paths", lpController.GetByCommunity)
		protected.POST("/api/communities/:communityname/learning-paths", lpController.Create)

		// Learning Paths API
		protected.GET("/api/learning-paths", lpController.Index)
		protected.POST("/api/learning-paths", lpController.Create) // Backward compatibility
		protected.PUT("/api/learning-paths/:id", lpController.Update)
		protected.DELETE("/api/learning-paths/:id", lpController.Delete)
		// LPs Favorites
		protected.GET("/api/learning-paths/favorites", lpController.GetUserFavorites)
		protected.POST("/api/learning-paths/:id/favorite", lpController.AddToFavorites)
		protected.DELETE("/api/learning-paths/:id/favorite", lpController.RemoveFromFavorites)
	}

	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
