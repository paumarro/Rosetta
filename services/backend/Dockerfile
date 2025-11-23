# Use the official Go image as the base image
FROM golang:latest

# Set the working directory for the service
WORKDIR /app

# Copy go.mod and go.sum for dependency caching
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy all source code
COPY . .

# Build the application
RUN go build -o main ./cmd/main.go

# Command to run the application
CMD ["./main"]
