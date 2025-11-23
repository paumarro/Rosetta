package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/rosetta/auth-service/internal/controller"
	"github.com/rosetta/auth-service/internal/service"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize OIDC auth service
	authService, err := service.NewAuthService(
		os.Getenv("OIDC_ISSUER"),
		os.Getenv("OIDC_CLIENT_ID"),
		os.Getenv("OIDC_CLIENT_SECRET"),
		os.Getenv("OIDC_REDIRECT_URI"),
	)
	if err != nil {
		log.Fatalf("Failed to initialize auth service: %v", err)
	}

	// Initialize Gin router
	r := gin.Default()

	// Configure CORS
	// With nginx reverse proxy, all requests come from http://localhost
	// We keep the old ports for backward compatibility with direct access during dev
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = []string{
		"http://localhost",      // nginx reverse proxy (production-like)
		"http://localhost:3000", // FE direct (dev without nginx)
		"http://localhost:3001", // be-editor direct
		"http://localhost:5173", // fe-editor direct (Vite dev)
		"http://localhost:5174", // alternative dev port
		"http://localhost:8080", // BE direct
	}
	corsConfig.AllowCredentials = true
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	r.Use(cors.New(corsConfig))

	// Initialize controller
	authController := controller.NewAuthController(authService)

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "healthy"})
	})

	// Auth routes (all under /auth/*)
	// These paths match nginx routing: /auth/* → auth-service
	r.GET("/auth/login", authController.Login)
	r.GET("/auth/callback", authController.Callback)
	r.GET("/auth/logout", authController.Logout)
	r.GET("/auth/validate", authController.ValidateToken)
	r.POST("/auth/validate", authController.ValidateToken)
	r.POST("/auth/refresh", authController.RefreshToken)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "3002"
	}

	log.Printf("Auth service starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
