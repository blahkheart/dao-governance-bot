#!/bin/bash

# Build the Docker image
docker build -t dao-governance-bot .

# Run the container
docker run -d \
  --name dao-bot \
  -p 3000:3000 \
  --env-file .env \
  dao-governance-bot 