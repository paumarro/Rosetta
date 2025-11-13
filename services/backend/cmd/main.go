package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/controller"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/handler"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/initializer"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/middleware"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/service"
	env "dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/pkg"
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

	learningPathService := service.NewLearningPathService(initializer.DB)
	lpController := controller.NewLearningPathController(learningPathService)

	// Public routes (no authentication required)
	r.GET("/callback", handler.Callback)
	r.GET("/auth/check", handler.AuthCheck)
	r.GET("/auth/logout", handler.Logout)
	r.GET("/auth/login", handler.Login)

	// Protected routes - all require company authentication
	protected := r.Group("/")
	protected.Use(middleware.Auth())
	{
		// Dashboard
		protected.GET("/", handler.Dashboard)

		// User API - all endpoints require auth
		protected.GET("/api/user/me", handler.GetCurrentUser)
		protected.PATCH("/api/user/me", handler.UpdateCurrentUser)

		// Learning Paths API - all endpoints require auth
		protected.GET("/api/learning-paths", lpController.Index)
		protected.POST("/api/learning-paths", lpController.Create)
		protected.DELETE("/api/learning-paths/:id", lpController.Delete)
		protected.GET("/api/learning-paths/favorites", lpController.GetUserFavorites)
		protected.POST("/api/learning-paths/:id/favorite", lpController.AddToFavorites)
		protected.DELETE("/api/learning-paths/:id/favorite", lpController.RemoveFromFavorites)
	}

	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
