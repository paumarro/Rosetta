# Dockerfile for Load Testing Runner
FROM node:20-alpine

# Install curl for healthcheck (if needed)
RUN apk add --no-cache curl bash

WORKDIR /app

# Copy load testing package files
COPY scripts/load-test/package*.json ./
RUN npm ci --production

# Copy load testing scripts
COPY scripts/load-test/ ./

# Make scripts executable
RUN chmod +x *.sh || true

# Create directory for test results
RUN mkdir -p /app/test-results

CMD ["npm", "run", "bots"]
