import { FarcasterBot } from './agent';
import { Proposal } from './models/Proposal';
import { WebSocketManager } from './services/WebSocketManager';
import { logger } from './utils/logger';
import { ProcessedBlock } from './models/ProcessedBlock';

async function createProcessedBlock(
  eventType: string,
  proposalId: string,
  status: string,
  eventHash?: string
) {
  return ProcessedBlock.findOneAndUpdate(
    { 
      eventType,
      'metadata.eventHash': eventHash
    },
    {
      $set: {
        metadata: {
          proposalId,
          eventHash,
          isCasted: true,
          status
        }
      }
    },
    { 
      upsert: true,
      new: true
    }
  );
}

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
    if (eventHash) {
      const processed = await ProcessedBlock.findOne({
        eventType: 'ProposalCreated',
        'metadata.eventHash': eventHash
      });
      
      if (processed) {
        logger.debug(`Proposal ${eventData.proposalId} creation event ${eventHash} already processed, skipping`);
        return;
      }
    }

    const { proposalId } = eventData;
    const existingProposal = await Proposal.findOne({ proposalId });
    
    if (existingProposal?.isCasted) {
      logger.debug(`Proposal ${proposalId} already casted, skipping`);
      return;
    }

    const currentBlock = await wsManager.getClient().getBlockNumber();
    
    await Proposal.findOneAndUpdate(
      { proposalId },
      {
        ...eventData,
        currentBlock: Number(currentBlock),
        status: 'created',
        source: 'onchain',
        space: 'unlock-protocol',
        isCasted: true
      },
      { upsert: true }
    );

    if (eventHash) {
      await createProcessedBlock('ProposalCreated', proposalId, 'created', eventHash);
    }

    if (!isHistorical) {
      const tallyUrl = `https://www.tally.xyz/gov/unlock-protocol/proposal/${proposalId}`;
      await farcasterBot.publishCast(
        `🗳 New proposal created!\n\nProposal ID: ${proposalId}\nVoting starts: ${new Date(eventData.voteStart * 1000).toUTCString()}\nVoting ends: ${new Date(eventData.voteEnd * 1000).toUTCString()}\n\nCast your vote at ${tallyUrl}`
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

    !isHistorical && await farcasterBot.publishCast(
      `⏳ Proposal ${proposalId} has been queued. Execution ETA: ${new Date(eta * 1000).toUTCString()}`
    );
    
    await Proposal.findOneAndUpdate(
      { proposalId },
      updateData
    );

    if (eventHash || !isHistorical) {
      await ProcessedBlock.findOneAndUpdate(
        { 
          eventType: 'ProposalQueued',
          'metadata.proposalId': proposalId
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

    !isHistorical && await farcasterBot.publishCast(
      `✅ Proposal ${proposalId} has been executed!`
    );
    
    await Proposal.findOneAndUpdate(
      { proposalId },
      { 
        status: 'executed',
        isCasted: true,
        ...(isHistorical ? {} : { executedTime: Date.now() })
      }
    );

    if (eventHash || !isHistorical) {
      await ProcessedBlock.findOneAndUpdate(
        { 
          eventType: 'ProposalExecuted',
          'metadata.proposalId': proposalId
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
