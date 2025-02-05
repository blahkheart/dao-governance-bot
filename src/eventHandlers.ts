import { FarcasterBot } from './agent';
import { Proposal } from './models/Proposal';
import { WebSocketManager } from './services/WebSocketManager';
import { logger } from './utils/logger';

export async function handleProposalCreated(
  wsManager: WebSocketManager,
  farcasterBot: FarcasterBot,
  eventData: {
    proposalId: string;
    proposer: string;
    startBlock: number;
    endBlock: number;
  },
  isHistorical = false
) {
  try {
    const { proposalId } = eventData;
    
    // Check if proposal already exists
    const existingProposal = await Proposal.findOne({ proposalId });
    if (existingProposal) {
      logger.debug(`Proposal ${proposalId} already processed, skipping`);
      return;
    }

    const currentBlock = await wsManager.getClient().getBlockNumber();

    const proposal = await Proposal.create({
      ...eventData,
      currentBlock: Number(currentBlock),
      status: 'created',
      source: 'onchain',
      space: 'unlock-protocol'
    });

    logger.info(`Proposal ${proposalId} stored in database`, { proposal });

    const missedProposalAnnouncement = `📜 [Historical] Missed Proposal Alert! 
        Proposal ID: ${proposalId}
        Proposer: ${eventData.proposer}
        Voting started at block: ${eventData.startBlock}
        Voting ended at block: ${eventData.endBlock}

        This proposal went live while I was asleep... Catching up now so everyone stays informed! #DAOHistory`;
    
    const realTimeProposalAnnouncement = `📜 New Proposal Created!
        ID: ${proposalId}
        Proposer: ${eventData.proposer}
        Voting starts at block: ${eventData.startBlock}
        Voting ends at block: ${eventData.endBlock}
        Current block: ${currentBlock}`;

      const announcement = isHistorical ? missedProposalAnnouncement : realTimeProposalAnnouncement;

    const castResponse = await farcasterBot.publishCast(announcement);

    logger.info(`Proposal ${proposalId} cast published`, { castResponse });
    
  } catch (error) {
    logger.error('Error handling proposal creation:', error);
    throw error;
  }
}

/**
 * Handle a proposal queued event
 */
export async function handleProposalQueued(
  farcasterBot: FarcasterBot,
  proposalId: string,
  eta: number, 
  isHistorical = false
) {
  try {
    const updateData = {
      status: 'queued',
      ...(isHistorical ? {} : { queuedTime: Date.now(), executionETA: eta })
    };
    await Proposal.findOneAndUpdate(
      { proposalId },
      updateData
    );

    !isHistorical && await farcasterBot.publishCast(
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
  proposalId: string,
  isHistorical = false
) {
  try {
    const updateData = {
      status: 'executed',
      ...(isHistorical ? {} : { executedTime: Date.now() })
    };

    await Proposal.findOneAndUpdate(
      { proposalId },
      updateData
    );

    await farcasterBot.publishCast(
     isHistorical ? `📜 [Historical] Proposal ${proposalId} was executed successfully. #DAOHistory` : `✅ Proposal ${proposalId} has been executed!`
    );
  } catch (error) {
    logger.error('Error handling proposal execution:', error);
    throw error;
  }
}
