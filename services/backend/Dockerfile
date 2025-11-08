# Use the official Go image as the base image
FROM golang:latest

# Set the working directory for the service
WORKDIR /BE

# Install air for hot reloading
RUN go install github.com/air-verse/air@latest

# Copy go.mod and go.sum for dependency caching
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Command to run the application with hot reloading
CMD ["air", "-c", ".air.toml"]
