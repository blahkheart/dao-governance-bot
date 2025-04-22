#!/bin/bash

# Build the Docker image
docker build -t dao-governance-bot .

# Run the container
docker run -d \
  --name dao-bot \
  -p 42069:42069 \
  --env-file .env.local \
  dao-governance-bot 