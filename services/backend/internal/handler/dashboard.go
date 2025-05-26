package handler

import (
	"log"

	"github.com/gin-gonic/gin"
)

func Dashboard(c *gin.Context) {
	log.Println("Welcome to the Dashboard")

}
