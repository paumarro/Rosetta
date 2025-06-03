package initializer

import (
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectToDB() {
	// Retrieve the DSN (Data Source Name) from the environment variable
	dsn := os.Getenv("PG_DB_URL")
	log.Println(dsn)

	// Attempt to establish the connection to the database
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}

	// Assign the connection to the global DB variable
	DB = db

	// Test the connection by running a simple query
	var result int
	if err := DB.Raw("SELECT 1").Scan(&result).Error; err != nil {
		log.Fatalf("Error executing test query: %v", err)
	}

	log.Println("Database connection established successfully!")
}
