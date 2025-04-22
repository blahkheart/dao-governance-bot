import mongoose from 'mongoose';

// Define the schema for the proposal
const proposalSchema = new mongoose.Schema({
  proposalId: {
    type: String,
    required: true,
    unique: true
  },
  space: {
    type: String,
    required: true
  },
  proposer: {
    type: String,
    required: true
  },
  endTime: {
    type: Number
  },
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
  isCasted: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create the model from the schema
export const Proposal = mongoose.model('Proposal', proposalSchema); 