# Backend Editor Dockerfile
FROM node:20-slim

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files
COPY services/backend-editor/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY services/backend-editor/ ./

# Build TypeScript code
RUN npm run build

# Expose port
EXPOSE 3001

# Start the server
CMD ["npm", "start"]
