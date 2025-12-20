#### Build stage
# Use an official Node.js runtime as a parent image
FROM node:20-alpine3.21 AS build

# Set the working directory in the container
WORKDIR /app

# Build arguments for Vite environment variables
ARG VITE_BE_API_URL
ARG VITE_DEV_EDITOR_FE_URL
ARG VITE_AUTH_URL

# Set as environment variables (Vite reads these at build time)
ENV VITE_BE_API_URL=$VITE_BE_API_URL
ENV VITE_DEV_EDITOR_FE_URL=$VITE_DEV_EDITOR_FE_URL
ENV VITE_AUTH_URL=$VITE_AUTH_URL

# Copy shared folder from monorepo root
COPY shared/ ./shared/

# Copy package.json and package-lock.json
COPY apps/frontend/package*.json ./

# Install dependencies using npm
RUN npm ci

# Copy the rest of the application code
COPY apps/frontend/ ./

# Build the React application for production
RUN npm run build

### Production stage
#Starts a new stage using nginx
FROM nginx:stable-alpine AS production


# Copy the nginx configuration inside conf.d folder
COPY apps/frontend/nginx/ /etc/nginx/conf.d/

# Copy the build output from the dist folder into the Nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html



#Expose port: Informs Docker that the container listens on port 80 at runtime.
EXPOSE 80

