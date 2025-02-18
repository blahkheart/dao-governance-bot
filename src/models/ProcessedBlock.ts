import mongoose from 'mongoose';

const processedBlockSchema = new mongoose.Schema({
  eventType: { 
    type: String,
    required: true
  },
  blockNumber: {
    type: Number
  },
  lastProcessedBlock: {
    type: Number
  },
  metadata: {
    proposalId: String,
    eventHash: String,
    isCasted: Boolean,
    status: String
  }
}, { timestamps: true });

// Create a compound unique index
processedBlockSchema.index({ eventType: 1, 'metadata.eventHash': 1 }, { unique: true });

export const ProcessedBlock = mongoose.model('ProcessedBlock', processedBlockSchema);