import { FarcasterBot } from './agent';
import { Proposal } from './models/Proposal';
import { WebSocketManager } from './services/WebSocketManager';
import { logger } from './utils/logger';
import { ProcessedBlock } from './models/ProcessedBlock';

export async function handleProposalCreated(
  wsManager: WebSocketManager,
  farcasterBot: FarcasterBot,
  eventData: {
    proposalId: string;
    proposer: string;
    voteStart: number;
    voteEnd: number;
  },
  isHistorical = false,
  eventHash?: string
) {
  try {
    // Check if this specific event hash was processed
    if (eventHash) {
      const processed = await ProcessedBlock.findOne({
        eventType: 'ProposalCreated',
        'metadata.eventHash': eventHash,
        'metadata.isCasted': true
      });
      
      if (processed) {
        logger.debug(`Proposal ${eventData.proposalId} creation event ${eventHash} already processed, skipping`);
        return;
      }
    }

    const { proposalId } = eventData;
    
    // Check if proposal already exists
    const existingProposal = await Proposal.findOne({ proposalId });
    if (existingProposal) {
      // If proposal exists and has been casted, skip
      if (existingProposal.isCasted) {
        logger.debug(`Proposal ${proposalId} already casted, skipping`);
        return;
      }
      // If proposal exists but hasn't been casted, we'll proceed to cast it
    }

    const currentBlock = await wsManager.getClient().getBlockNumber();

    // Create or update the proposal
    const proposal = existingProposal || await Proposal.create({
      ...eventData,
      currentBlock: Number(currentBlock),
      status: 'created',
      source: 'onchain',
      space: 'unlock-protocol',
      isCasted: false
    });
 
    logger.info(`Proposal ${proposalId} stored in database`, { proposal });

    const tallyUrl = `https://www.tally.xyz/gov/unlock-protocol/proposal/${proposalId}`;

    const missedProposalAnnouncement = `📜 [Historical] Missed Proposal Alert! 
        Proposal ID: ${proposalId}
        Proposer: ${eventData.proposer}
        Voting started at block: ${eventData.voteStart}
        Voting ended at block: ${eventData.voteEnd}

        View proposal: ${tallyUrl}

        This proposal went live while I was asleep... Catching up now so everyone stays informed! #DAOHistory`;
    
    const realTimeProposalAnnouncement = `📜 New Proposal Created!
        ID: ${proposalId}
        Proposer: ${eventData.proposer}
        Voting starts at block: ${eventData.voteStart}
        Voting ends at block: ${eventData.voteEnd}
        Current block: ${currentBlock}

        View and vote on proposal: ${tallyUrl}`;

    const announcement = isHistorical ? missedProposalAnnouncement : realTimeProposalAnnouncement;

    // Publish cast and update isCasted flag
    const castResponse = await farcasterBot.publishCast(announcement);
    await Proposal.findOneAndUpdate(
      { proposalId },
      { isCasted: true },
      { new: true }
    );

    logger.info(`Proposal ${proposalId} cast published and marked as casted`, { castResponse });
    
    // Mark as processed
    if (eventHash) {
      await ProcessedBlock.findOneAndUpdate(
        { 
          eventType: 'ProposalCreated',
          'metadata.eventHash': eventHash
        },
        {
          $set: {
            metadata: {
              proposalId: eventData.proposalId,
              isCasted: true,
              status: 'created',
              eventHash
            }
          }
        },
        { upsert: true }
      );
    }
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
  isHistorical: boolean = false,
  eventHash?: string
) {
  try {
    if (eventHash) {
      const processed = await ProcessedBlock.findOne({
        eventType: 'ProposalQueued',
        'metadata.eventHash': eventHash,
        'metadata.isCasted': true
      });
      
      if (processed) {
        logger.debug(`Proposal ${proposalId} queue event ${eventHash} already processed, skipping`);
        return;
      }
    }

    const proposal = await Proposal.findOne({ proposalId });
    if (proposal?.isCasted && proposal.status === 'queued') {
      logger.debug(`Proposal ${proposalId} queue already casted, skipping`);
      return;
    }

    const updateData = {
      status: 'queued',
      isCasted: true,
      ...(isHistorical ? {} : { queuedTime: Date.now(), executionETA: eta })
    };

    await Proposal.findOneAndUpdate(
      { proposalId },
      updateData
    );

    !isHistorical && await farcasterBot.publishCast(
      `⏳ Proposal ${proposalId} has been queued. Execution ETA: ${new Date(eta * 1000).toUTCString()}`
    );

    if (eventHash) {
      await ProcessedBlock.findOneAndUpdate(
        { 
          eventType: 'ProposalQueued',
          'metadata.eventHash': eventHash
        },
        {
          $set: {
            metadata: {
              proposalId,
              isCasted: true,
              status: 'queued',
              eventHash
            }
          }
        },
        { upsert: true }
      );
    }
  } catch (error) {
    logger.error('Error handling proposal queue:', error);
    throw error;
  }
}

/**
 * Handle a proposal executed event
 */
export async function handleProposalExecuted(
  farcasterBot: FarcasterBot,
  proposalId: string,
  isHistorical: boolean = false,
  eventHash?: string
) {
  try {
    if (eventHash) {
      const processed = await ProcessedBlock.findOne({
        eventType: 'ProposalExecuted',
        'metadata.eventHash': eventHash,
        'metadata.isCasted': true
      });
      
      if (processed) {
        logger.debug(`Proposal ${proposalId} execution event ${eventHash} already processed, skipping`);
        return;
      }
    }

    const proposal = await Proposal.findOne({ proposalId });
    if (proposal?.isCasted && proposal.status === 'executed') {
      logger.debug(`Proposal ${proposalId} execution already casted, skipping`);
      return;
    }

    await Proposal.findOneAndUpdate(
      { proposalId },
      { 
        status: 'executed',
        isCasted: true,
        ...(isHistorical ? {} : { executedTime: Date.now() })
      }
    );

    !isHistorical && await farcasterBot.publishCast(
      `✅ Proposal ${proposalId} has been executed!`
    );

    if (eventHash) {
      await ProcessedBlock.findOneAndUpdate(
        { 
          eventType: 'ProposalExecuted',
          'metadata.eventHash': eventHash
        },
        {
          $set: {
            metadata: {
              proposalId,
              isCasted: true,
              status: 'executed',
              eventHash
            }
          }
        },
        { upsert: true }
      );
    }
  } catch (error) {
    logger.error('Error handling proposal execution:', error);
    throw error;
  }
}
