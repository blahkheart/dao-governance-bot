import mongoose from 'mongoose';

export interface IProposal {
  proposalId: string;
  space?: string;
  proposer?: string;
  voteStart: number;
  voteEnd: number;
  currentBlock: number;
  queuedTime?: number;
  executedTime?: number;
  endTime?: number;
  status: 'created' | 'active' | 'ended' | 'queued' | 'executed';
  source: 'snapshot' | 'onchain';
  createdAt: Date;
  isCasted: boolean;
}

const ProposalSchema = new mongoose.Schema<IProposal>({
  proposalId: { type: String, required: true, unique: true },
  space: { type: String },
  proposer: { type: String },
  voteStart: { type: Number },
  voteEnd: { type: Number },
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
  isCasted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const Proposal = mongoose.model<IProposal>('Proposal', ProposalSchema); 