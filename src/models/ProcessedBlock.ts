import mongoose from 'mongoose';

interface IProcessedBlock {
  eventType: string;
  lastProcessedBlock: number;
  metadata: {
    isCasted?: boolean;
    proposalId?: string;
    status?: string;
    eventHash?: string;
    processingErrors?: {
      blockNumber: number;
      error: string;
      timestamp: Date;
    }[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const ProcessedBlockSchema = new mongoose.Schema<IProcessedBlock>({
  eventType: { type: String, required: true },
  lastProcessedBlock: { type: Number, required: true },
  metadata: {
    isCasted: { type: Boolean, default: false },
    proposalId: { type: String },
    status: { type: String },
    eventHash: { type: String },
    processingErrors: [{
      blockNumber: Number,
      error: String,
      timestamp: { type: Date, default: Date.now }
    }]
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ProcessedBlockSchema.index({ 
  eventType: 1, 
  'metadata.eventHash': 1 
}, { unique: true });

ProcessedBlockSchema.index({ 
  'metadata.proposalId': 1,
  eventType: 1
});

export const ProcessedBlock = mongoose.model<IProcessedBlock>('ProcessedBlock', ProcessedBlockSchema);