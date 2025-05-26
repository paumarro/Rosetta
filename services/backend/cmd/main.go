package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/handler"
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/middleware"
)

func init() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading environment variables")
	}
}
func main() {

	r := gin.Default()

	authRoutes := r.Group("/")
	authRoutes.Use(middleware.Auth())
	{
		authRoutes.GET("/", handler.Dashboard)
	}

	r.GET("/callback", handler.Callback)

	log.Println("Server starting at :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
