import mongoose from 'mongoose';

interface IProposal {
  proposalId: string;
  space?: string;
  proposer?: string;
  startBlock: number;
  endBlock: number;
  currentBlock: number;
  queuedTime?: number;
  executedTime?: number;
  endTime?: number;
  status: 'created' | 'active' | 'ended' | 'queued' | 'executed';
  source: 'snapshot' | 'onchain';
  createdAt: Date;
}

const ProposalSchema = new mongoose.Schema<IProposal>({
  proposalId: { type: String, required: true, unique: true },
  space: { type: String },
  proposer: { type: String },
  startBlock: { type: Number },
  endBlock: { type: Number },
  currentBlock: { type: Number },
  queuedTime: { type: Number },
  executedTime: { type: Number },
  endTime: { type: Number },
  status: {
    type: String,
    enum: ['created', 'active', 'ended', 'queued', 'executed'],
    default: 'created'
  },
  source: {
    type: String,
    enum: ['snapshot', 'onchain'],
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

export const Proposal = mongoose.model<IProposal>('Proposal', ProposalSchema); 