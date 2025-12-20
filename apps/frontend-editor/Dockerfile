
#### Build stage
# Use an official Node.js runtime as a parent image
FROM node:20-alpine3.21 AS build

# Set the working directory in the container
WORKDIR /app

# Copy shared folder from monorepo root
COPY shared/ ./shared/

# Copy package.json and package-lock.json
COPY apps/frontend-editor/package*.json ./

# Install dependencies using npm
RUN npm ci

# Copy the rest of the application code
COPY apps/frontend-editor/ ./

# Build the React application for production
RUN npm run build

### Production stage
# Starts a new stage using nginx
FROM nginx:stable-alpine AS production

# Copy the nginx configuration inside conf.d folder
COPY apps/frontend-editor/nginx/ /etc/nginx/conf.d/

# Copy the build output from the dist folder into the Nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80 for nginx
EXPOSE 80
