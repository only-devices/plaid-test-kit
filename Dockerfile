# Use Node 24 Alpine image for smaller footprint
FROM node:24-alpine

# Set the working directory
WORKDIR /app

# Copy only package files first for better caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy the rest of the app
COPY . .

# Expose the default port for Northflank (set this in the UI too)
EXPOSE 3000

# Run your start script (calls "node app.js")
CMD ["npm", "start"]