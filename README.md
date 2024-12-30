# dao-governance-bot

## Introduction

`dao-governance-bot` is an automated messaging bot designed to monitor DAO governance activities and broadcast updates to Farcaster. It tracks proposal creation, voting periods, and execution states, providing real-time updates to the community. The bot leverages the [Neynar API](https://docs.neynar.com/) for Farcaster interactions and integrates with both on-chain governance and Snapshot.

## Features

- Monitors on-chain governance proposals
- Tracks Snapshot proposals through webhooks
- Announces proposal creation, voting start/end, queuing, and execution
- Persists proposal data in MongoDB
- Supports both local and containerized deployment

## Prerequisites

- [Node.js](https://nodejs.org/en/) (v20 or later)
- [Docker](https://www.docker.com/) (if using containerized deployment)
- [MongoDB](https://www.mongodb.com/) instance
- Optimism (OP) Mainnet wallet with funds for signer registration

## Installation

### Setting Up the Environment

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/dao-governance-bot.git
   cd dao-governance-bot
   ```

2. Install dependencies:
   ```bash
   yarn install
   # or
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

   Required environment variables:
   - `MONGODB_URI`: MongoDB connection string
   - `NEYNAR_API_KEY`: Your Neynar API key
   - `FARCASTER_BOT_MNEMONIC`: Bot's Farcaster mnemonic
   - `ALCHEMY_API_KEY`: Alchemy API key for blockchain interactions
   - `DAO_GOVERNOR_ADDRESS`: Address of the DAO governor contract
   - `ERC20_ADDRESS`: Address of the governance token
   - `SIGNER_UUID`: (Will be generated in next step)

### Generating a Signer

Before running the bot, generate and approve a signer:

1. Run the signer generation script:
   ```bash
   yarn get-approved-signer
   ```

2. Follow the terminal instructions to approve the signer on Optimism mainnet through the KeyGateway contract.

## Running the Bot

### Local Development

1. Start in development mode:
   ```bash
   yarn watch
   ```

2. In a separate terminal, run:
   ```bash
   yarn start:gov
   ```

### Using Docker

1. For development:
   ```bash
   docker-compose up --build
   ```

2. For production:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

## Architecture

- Express server handling Snapshot webhooks
- MongoDB for proposal state persistence
- Viem for blockchain event monitoring
- Neynar SDK for Farcaster interactions
- Node-cron for scheduled tasks

## Monitoring

- Health check endpoint available at `/health`
- Docker logs accessible via `docker logs dao-bot`
- MongoDB collections for proposal tracking

## Troubleshooting

- **Q: Bot not receiving Snapshot updates?**
  - Ensure webhook endpoints are properly configured in Snapshot
  - Check MongoDB connection
  - Verify webhook route accessibility

- **Q: Missing blockchain events?**
  - Verify Alchemy API key
  - Check contract addresses in environment variables
  - Ensure proper network connectivity

- **Q: Farcaster posts not appearing?**
  - Verify Neynar API key
  - Check signer approval status
  - Confirm SIGNER_UUID in environment variables

## License

Released under the MIT License. See LICENSE file for details.
