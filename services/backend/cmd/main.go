package main

import (
	"log"

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

	r := gin.Default()

	authRoutes := r.Group("/")
	authRoutes.Use(middleware.Auth())
	{
		authRoutes.GET("/", handler.Dashboard)
	}

	r.GET("/callback", handler.Callback)

	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
