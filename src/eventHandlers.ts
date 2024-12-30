// src/eventHandlers.ts
import { FarcasterBot } from './agent';
import { Proposal } from './models/Proposal';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { WS_RPC_URL } from './constants';

const client = createPublicClient({
  chain: mainnet,
  transport: http(WS_RPC_URL)
});

export async function handleProposalCreated(
  farcasterBot: FarcasterBot,
  eventData: {
    proposalId: string;
    proposer: string;
    startBlock: number;
    endBlock: number;
  }
) {
  try {
    const { proposalId, proposer, startBlock, endBlock } = eventData;
    const currentBlock = await client.getBlockNumber();

    await Proposal.create({
      proposalId,
      proposer,
      startBlock,
      endBlock,
      currentBlock: Number(currentBlock),
      status: 'created',
      source: 'onchain',
      space: 'unlock-protocol'
    });

    const announcement = `📜 New Proposal Created!
ID: ${proposalId}
Proposer: ${proposer}
Voting starts at block: ${startBlock}
Voting ends at block: ${endBlock}
Current block: ${currentBlock}`;

    await farcasterBot.publishCast(announcement);
  } catch (error) {
    console.error('Error handling proposal creation:', error);
    throw error;
  }
}

/**
 * Handle a proposal queued event
 */
export async function handleProposalQueued(
  farcasterBot: FarcasterBot,
  proposalId: string,
  eta: number
) {
  try {
    await Proposal.findOneAndUpdate(
      { proposalId },
      { 
        status: 'queued',
        queuedTime: eta 
      }
    );

    await farcasterBot.publishCast(
      `⏳ Proposal ${proposalId} has been queued. Execution ETA: ${new Date(eta * 1000).toUTCString()}`
    );
  } catch (error) {
    console.error('Error handling proposal queue:', error);
    throw error;
  }
}

/**
 * Handle a proposal executed event
 */
export async function handleProposalExecuted(
  farcasterBot: FarcasterBot,
  proposalId: string
) {
  try {
    await Proposal.findOneAndUpdate(
      { proposalId },
      { 
        status: 'executed',
        executedTime: Date.now() 
      }
    );

    await farcasterBot.publishCast(
      `✅ Proposal ${proposalId} has been executed!`
    );
  } catch (error) {
    console.error('Error handling proposal execution:', error);
    throw error;
  }
}
