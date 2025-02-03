import mongoose from 'mongoose';

interface IProcessedBlock {
  eventType: string;
  lastProcessedBlock: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProcessedBlockSchema = new mongoose.Schema<IProcessedBlock>({
  eventType: { type: String, required: true, unique: true },
  lastProcessedBlock: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const ProcessedBlock = mongoose.model<IProcessedBlock>('ProcessedBlock', ProcessedBlockSchema);