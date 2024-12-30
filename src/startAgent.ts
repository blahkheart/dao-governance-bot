import express, { Request, Response } from 'express';
import { createFarcasterBot } from './agent';
import { watchGovernorContract } from './daoGovernanceWatcher';
import { setupSnapshotWebhooks } from './snapshotWebhooks';
import {MONGODB_URI, PORT } from './config';
import mongoose from 'mongoose';

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
  // Post announcement
  //   await farcasterBot.publishCast(
  //     "🏛 Hello! I am Agent Smith, your DAO Governance informant. I'll keep you updated on all proposal activities!"
  //   );
    
  // Start watching the DAO Governor contract
  await watchGovernorContract(farcasterBot);

  // Setup Snapshot webhooks
  setupSnapshotWebhooks(app, farcasterBot);

  // Health check endpoint
  app.get('/health', (_: Request, res: any) => res.status(200).send('OK'));

  // Start the server
  app.listen(PORT || 3000, () => {
    console.log(`Server running on port ${PORT || 3000}`);
  });

  console.log('Unlock Protocol DAO Agent Smith is online...');
}

main().catch((err) => {
  console.error('Error in main:', err);
  process.exit(1);
});
