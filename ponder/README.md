# DAO Governance Bot with Ponder

This project is a DAO governance bot that monitors blockchain events and posts updates to Farcaster. It uses Ponder to index and react to blockchain events from a DAO Governor contract, and Neynar for interacting with the Farcaster network.

## Features

- Monitors DAO Governor contract for proposal events (created, queued, executed)
- Posts real-time updates to Farcaster when governance events occur
- Uses Ponder for efficient blockchain event indexing and processing
- Stores event data in MongoDB for retrieval and status tracking
- Provides utilities for managing Farcaster casts
- Processes Snapshot webhooks for off-chain governance

## Getting Started

### Prerequisites

- Node.js 18.14+
- Yarn or npm
- A Farcaster account with a mnemonic phrase
- Neynar API key
- RPC URL for Base Mainnet
- MongoDB instance (local or cloud-hosted)

### Setup

1. Clone the repository
2. Copy `.env.example` to `.env.local` and fill in your configuration values
3. Install dependencies:

```bash
cd ponder
npm install
```

### Development

To run the project in development mode:

```bash
npm run dev
```

### Available Scripts

- `npm run dev` - Start development mode with hot reloading
- `npm run start` - Start production mode
- `npm run db` - Open the database explorer
- `npm run view:casts` - View recent casts made by the bot
- `npm run delete:cast <hash>` - Delete a specific cast
- `npm run publish:cast <text>` - Publish a test cast
- `npm run get-approved-signer` - Get an approved signer for Farcaster

## Environment Variables

All environment variables are now unified in a single `.env.local` file. The main required variables are:

### Blockchain Configuration
- `PONDER_RPC_URL_BASE_MAINNET` - RPC URL for Base Mainnet
- `START_BLOCK` - Block number to start indexing from
- `HISTORICAL_EVENTS_CUTOFF` - Block number cutoff for historical events
- `DAO_GOVERNOR_ADDRESS` - Address of the DAO Governor contract
- `TARGET_CHAIN_ID` - Chain ID (8453 for Base Mainnet)

### Farcaster Configuration
- `FARCASTER_BOT_MNEMONIC` - Mnemonic for the Farcaster account
- `SIGNER_UUID` - UUID for the Farcaster signer
- `NEYNAR_API_KEY` - API key for Neynar

### MongoDB Configuration
- `MONGODB_URI` - MongoDB connection string

See `.env.example` for a complete list of available variables and their descriptions.

## Architecture

This project integrates Ponder for blockchain event monitoring with Neynar for Farcaster interactions. The architecture consists of:

1. **Ponder Indexer**: Monitors the blockchain for DAO Governor events
2. **Event Handlers**: Process events and trigger appropriate actions
3. **Snapshot Webhook**: Processes off-chain governance events from Snapshot
4. **Farcaster Service**: Manages communication with the Farcaster network
5. **MongoDB Database**: Stores event data and cast status

## License

MIT 