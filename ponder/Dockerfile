# Base image
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install dependencies
RUN npm install

# Environment variables
ENV NODE_ENV=production

# Expose port (Ponder uses 42069 by default)
EXPOSE 42069

# Start command
CMD ["npm", "run", "start"] 