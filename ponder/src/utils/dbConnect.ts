import mongoose from 'mongoose';
import { logger } from './logger';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dao-governance-bot';

let cached: { conn: typeof mongoose | null } = { conn: null };

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  try {
    const opts = {
      bufferCommands: false,
    };

    cached.conn = await mongoose.connect(MONGODB_URI, opts);
    logger.info('Connected to MongoDB');
    return cached.conn;
  } catch (err) {
    logger.error('Error connecting to MongoDB:', err);
    throw err;
  }
}

connectToDatabase().catch(console.error); 