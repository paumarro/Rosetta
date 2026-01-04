#!/bin/bash

# Manual Docker Build and Push Script

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the repository root (parent of scripts directory)
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Change to repository root to ensure relative paths work
cd "${REPO_ROOT}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Manual Docker Build & Push Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Working directory: ${REPO_ROOT}${NC}"

# Variables
ACR_NAME="rosettaacr"
ACR_URL="rosettaacr.azurecr.io"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Function to get next version number
get_next_version() {
  local repo=$1
  local latest_tag=$(az acr repository show-tags --name ${ACR_NAME} --repository ${repo} --orderby time_desc --output tsv 2>/dev/null | grep "^v[0-9]*$" | head -n 1)

  if [ -z "$latest_tag" ]; then
    echo "v1"
  else
    local version_num=$(echo $latest_tag | sed 's/v//')
    local next_version=$((version_num + 1))
    echo "v${next_version}"
  fi
}

# Step 1: Login to ACR
echo -e "\n${BLUE}Step 1: Logging in to Azure Container Registry...${NC}"
az acr login --name ${ACR_NAME}

# Step 2: Get version numbers
echo -e "\n${BLUE}Step 2: Determining version numbers...${NC}"
BACKEND_VERSION=$(get_next_version "rosetta/backend")
BACKEND_EDITOR_VERSION=$(get_next_version "rosetta/backend-editor")
AUTH_VERSION=$(get_next_version "rosetta/auth-service")
FRONTEND_VERSION=$(get_next_version "frontend")
FRONTEND_EDITOR_VERSION=$(get_next_version "frontend-editor")

echo -e "${YELLOW}Backend: ${BACKEND_VERSION}${NC}"
echo -e "${YELLOW}Backend-editor: ${BACKEND_EDITOR_VERSION}${NC}"
echo -e "${YELLOW}Auth-service: ${AUTH_VERSION}${NC}"
echo -e "${YELLOW}Frontend: ${FRONTEND_VERSION}${NC}"
echo -e "${YELLOW}Frontend-editor: ${FRONTEND_EDITOR_VERSION}${NC}"

# Step 3: Build all images
echo -e "\n${BLUE}Step 3: Building Docker images...${NC}"

echo -e "${GREEN}Building backend...${NC}"
docker buildx build --platform linux/amd64 \
  -t ${ACR_URL}/rosetta/backend:${BACKEND_VERSION} \
  -t ${ACR_URL}/rosetta/backend:latest \
  --load \
  services/backend

echo -e "${GREEN}Building backend-editor...${NC}"
docker buildx build --platform linux/amd64 \
  -t ${ACR_URL}/rosetta/backend-editor:${BACKEND_EDITOR_VERSION} \
  -t ${ACR_URL}/rosetta/backend-editor:latest \
  --load \
  services/backend-editor

echo -e "${GREEN}Building auth-service...${NC}"
docker buildx build --platform linux/amd64 \
  -t ${ACR_URL}/rosetta/auth-service:${AUTH_VERSION} \
  -t ${ACR_URL}/rosetta/auth-service:latest \
  --load \
  services/auth-service

echo -e "${GREEN}Building frontend...${NC}"
docker buildx build --platform linux/amd64 \
  -t ${ACR_URL}/frontend:${FRONTEND_VERSION} \
  -t ${ACR_URL}/frontend:latest \
  --load \
  -f apps/frontend/Dockerfile .

echo -e "${GREEN}Building frontend-editor...${NC}"
docker buildx build --platform linux/amd64 \
  -t ${ACR_URL}/frontend-editor:${FRONTEND_EDITOR_VERSION} \
  -t ${ACR_URL}/frontend-editor:latest \
  --load \
  -f apps/frontend-editor/Dockerfile .

# Step 4: Push all images
echo -e "\n${BLUE}Step 4: Pushing images to ACR...${NC}"

echo -e "${GREEN}Pushing backend...${NC}"
docker push ${ACR_URL}/rosetta/backend:${BACKEND_VERSION}
docker push ${ACR_URL}/rosetta/backend:latest

echo -e "${GREEN}Pushing backend-editor...${NC}"
docker push ${ACR_URL}/rosetta/backend-editor:${BACKEND_EDITOR_VERSION}
docker push ${ACR_URL}/rosetta/backend-editor:latest

echo -e "${GREEN}Pushing auth-service...${NC}"
docker push ${ACR_URL}/rosetta/auth-service:${AUTH_VERSION}
docker push ${ACR_URL}/rosetta/auth-service:latest

echo -e "${GREEN}Pushing frontend...${NC}"
docker push ${ACR_URL}/frontend:${FRONTEND_VERSION}
docker push ${ACR_URL}/frontend:latest

echo -e "${GREEN}Pushing frontend-editor...${NC}"
docker push ${ACR_URL}/frontend-editor:${FRONTEND_EDITOR_VERSION}
docker push ${ACR_URL}/frontend-editor:latest

# Step 5: Verify
echo -e "\n${BLUE}Step 5: Verifying images in ACR...${NC}"
az acr repository list --name ${ACR_NAME} --output table

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ All images built and pushed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n${YELLOW}Versions created:${NC}"
echo -e "  Backend: ${BACKEND_VERSION}"
echo -e "  Backend-editor: ${BACKEND_EDITOR_VERSION}"
echo -e "  Auth-service: ${AUTH_VERSION}"
echo -e "  Frontend: ${FRONTEND_VERSION}"
echo -e "  Frontend-editor: ${FRONTEND_EDITOR_VERSION}"

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Step 6: Updating Container Apps...${NC}"
echo -e "${BLUE}========================================${NC}"

# Update backend services with rosetta/ prefix
echo -e "${GREEN}Updating backend...${NC}"
az containerapp update \
  --name backend \
  --resource-group rg-rosetta \
  --image ${ACR_URL}/rosetta/backend:${BACKEND_VERSION}

echo -e "${GREEN}Updating backend-editor...${NC}"
az containerapp update \
  --name backend-editor \
  --resource-group rg-rosetta \
  --image ${ACR_URL}/rosetta/backend-editor:${BACKEND_EDITOR_VERSION}

echo -e "${GREEN}Updating auth-service...${NC}"
az containerapp update \
  --name auth-service \
  --resource-group rg-rosetta \
  --image ${ACR_URL}/rosetta/auth-service:${AUTH_VERSION}

# Update frontend services without rosetta/ prefix
echo -e "${GREEN}Updating frontend...${NC}"
az containerapp update \
  --name frontend \
  --resource-group rg-rosetta \
  --image ${ACR_URL}/frontend:${FRONTEND_VERSION}

echo -e "${GREEN}Updating frontend-editor...${NC}"
az containerapp update \
  --name frontend-editor \
  --resource-group rg-rosetta \
  --image ${ACR_URL}/frontend-editor:${FRONTEND_EDITOR_VERSION}

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ All Container Apps updated successfully!${NC}"
echo -e "${GREEN}========================================${NC}"