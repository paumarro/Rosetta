package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/handler"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/initializer"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/middleware"
	env "dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/pkg"
)

func init() {
	env.LoadEnvVariables(".env")
	initializer.ConnectToDB()
}

func main() {
	frontendURL := os.Getenv("ROSETTA_FE")

	r := gin.Default()

	// Add CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{frontendURL}, // Your frontend URL
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept", "X-Requested-With"},
		AllowCredentials: true, // Important for cookies
	}))

	authRoutes := r.Group("/")
	authRoutes.Use(middleware.Auth())
	{
		authRoutes.GET("/", handler.Dashboard)
	}

	r.GET("/callback", handler.Callback)
	r.GET("/auth/check", handler.AuthCheck) // This endpoint ONLY checks, never redirects
	r.GET("/auth/logout", handler.Logout)

	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
