
#### Build stage
# Use an official Node.js runtime as a parent image
FROM node:20-alpine3.21 AS build

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies using npm
RUN npm ci

# Copy the rest of the application code
COPY ./ ./

# Build the React application for production
RUN npm run build

### Production stage
#Starts a new stage using nginx
FROM nginx:stable-alpine AS production


# Copy the nginx configuration inside conf.d folder
COPY nginx/ /etc/nginx/conf.d/

# Copy the build output from the dist folder into the Nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html



#Expose port: Informs Docker that the container listens on port 80 at runtime.
EXPOSE 80
