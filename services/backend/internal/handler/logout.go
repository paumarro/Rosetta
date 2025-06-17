package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func Logout(c *gin.Context) {
	//Clear Cookies
	c.SetCookie("access_token", "", -1, "/", "", true, true)
	c.SetCookie("refresh_token", "", -1, "/", "", true, true)

	//Redirect to login page
	c.JSON(http.StatusOK, gin.H{
		"message": "Logged out successfully",
	})
}
