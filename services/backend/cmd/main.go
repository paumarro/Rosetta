package main

import (
	"log"

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
	// frontendURL := os.Getenv("ROSETTA_FE")

	r := gin.Default()

	// Add CORS middleware - allow frontend origin
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept", "X-Requested-With"},
		AllowCredentials: true,
	}))

	authRoutes := r.Group("/")
	authRoutes.Use(middleware.Auth())
	{
		authRoutes.GET("/", handler.Dashboard)
	}

	learningPathService := service.NewLearningPathService(initializer.DB)
	lpController := controller.NewLearningPathController(learningPathService)

	// API routes
	api := r.Group("/api")
	{
		api.GET("/learning-paths", lpController.Index)
		api.POST("/learning-paths", lpController.Create)
	}

	r.GET("/callback", handler.Callback)
	r.GET("/auth/check", handler.AuthCheck)
	r.GET("/auth/logout", handler.Logout)
	r.GET("/auth/login", handler.Login)

	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
