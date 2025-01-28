import express from 'express';
import mongoose from 'mongoose';
import { createFarcasterBot } from './agent';
import { watchGovernorContract } from './daoGovernanceWatcher';
import { setupSnapshotWebhooks } from './snapshotWebhooks';
import { MONGODB_URI, PORT } from './config';

if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
}

async function main() {
    let cleanup: (() => void) | undefined;
    
    // Handle process termination
    const handleShutdown = async () => {
        console.log('Received shutdown signal, cleaning up...');
        
        // Call the cleanup function
        if (cleanup) {
            cleanup();
        }
        
        // Close MongoDB connection
        try {
            await mongoose.connection.close();
            console.log('MongoDB connection closed');
        } catch (err) {
            console.error('Error closing MongoDB connection:', err);
        }
        
        process.exit(0);
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);

    // Connect to MongoDB with retry logic
    const connectWithRetry = async () => {
        try {
            await mongoose.connect(MONGODB_URI);
            console.log('Connected to MongoDB');
        } catch (err) {
            console.error('Failed to connect to MongoDB. Retrying in 5 seconds...', err);
            await new Promise(resolve => setTimeout(resolve, 5000));
            return connectWithRetry();
        }
    };

    await connectWithRetry();

    const app = express();
    app.use(express.json());

    // Create Farcaster bot
    const farcasterBot = createFarcasterBot();

    // Setup webhook endpoints
    setupSnapshotWebhooks(app, farcasterBot);

    // Start blockchain event watchers and store cleanup function
    cleanup = await watchGovernorContract(farcasterBot);

    // Health check endpoint  
    app.get('/health', async (req, res) => {
        res.status(200).send('OK');
    });

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

main().catch(console.error);