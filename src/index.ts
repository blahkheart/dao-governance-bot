import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { createFarcasterBot } from './agent';
import { watchGovernorContract } from './daoGovernanceWatcher';
import { setupSnapshotWebhooks } from './snapshotWebhooks';
import { MONGODB_URI, PORT } from './config';

if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
}

async function main() {
    // Connect to MongoDB
    try { 
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');
    } catch (e) {
        throw new Error('Failed to connect to MongoDB');
    }

  const app = express();
  app.use(express.json());

  // Create Farcaster bot
  const farcasterBot = createFarcasterBot();

  // Setup webhook endpoints
  setupSnapshotWebhooks(app, farcasterBot);

  // Start blockchain event watchers
  await watchGovernorContract(farcasterBot);

  // Health check endpoint  
  app.get('/health', async (req, res) => {
    res.status(200).send('OK');
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main().catch(console.error);