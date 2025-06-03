package env

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

func LoadEnvVariables(envFile string) {
	log.Println("Loading environment variables...")

	// Check if running in a Docker container
	if os.Getenv("RUNNING_IN_DOCKER") == "true" {
		log.Println("Running inside Docker container. Skipping .env file loading.")
		return
	}

	// Load .env file
	err := godotenv.Load(envFile)
	if err != nil {
		log.Fatalf("Error loading %s file: %v", envFile, err)
	}

	log.Println("Environment variables loaded successfully!")
}
