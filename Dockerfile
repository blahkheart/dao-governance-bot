# Base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (better caching)
COPY package.json yarn.lock ./
RUN yarn install

# Copy source code
COPY . .

# Build TypeScript
RUN yarn build

# Set Node options for increased memory
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start command
CMD ["yarn", "start:gov"]