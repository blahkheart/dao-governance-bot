import { Proposal } from './models/Proposal';
import { DAO_GOVERNOR_ADDRESS, ERC20_ADDRESS, HISTORIC_EVENTS_START_BLOCK } from './config'; 
import { DAO_GOVERNOR_ABI, ERC20_ABI } from './abi';
import {
  handleProposalCreated,
  handleProposalExecuted,
  handleProposalQueued,
} from './eventHandlers';
import { FarcasterBot } from './agent';
import { WebSocketManager } from './services/WebSocketManager';
import { withRetry } from './utils/retry';
import { logger } from './utils/logger';
import { HistoricalEventProcessor } from './services/HistoricalEventProcessor';
import { Abi, Log } from 'viem';
import { decodeLogData, extractLogProperties } from './utils/getTransactionLogs';
import { decodeHistoricalLog } from './utils/getTransactionLogs';
const WATCH_ADDRESS = '0xa0c03bE2Cf62f171e29e0d8766677cF4c50d58F8';

export async function watchGovernorContract(farcasterBot: FarcasterBot) {
  const wsManager = new WebSocketManager();
  const unwatchFunctions: (() => void)[] = [];
  let isProcessingHistorical = false;

  if (!isProcessingHistorical) {
    isProcessingHistorical = true;
    try {
      await processHistoricalEvents(wsManager, farcasterBot);
      logger.info('Historical event processing completed');
    } catch (error) {
      logger.error('Error processing historical events:', error);
    }
  }
  await setupEventWatchers(wsManager, farcasterBot, unwatchFunctions);

  // Cleanup function
  const cleanup = (unwatchFns: (() => void)[]) => {
    unwatchFns.forEach(unwatch => unwatch());
    unwatchFns.length = 0; // Clear the array
    wsManager.cleanup();
  };

  // Handle process termination
  process.on('SIGINT', () => cleanup(unwatchFunctions));
  process.on('SIGTERM', () => cleanup(unwatchFunctions));

  return () => cleanup(unwatchFunctions);
}

async function setupEventWatchers(
  wsManager: WebSocketManager,
  farcasterBot: FarcasterBot,
  unwatchFunctions: (() => void)[]
) {
  const client = wsManager.getClient();
  logger.info('Setting up event watchers');

    // Watch for new blocks to track proposal status changes
  const unwatchBlocks = client.watchBlocks({
    onBlock: async (block) => {
      const currentBlock = block.number;
      const proposals = await Proposal.find({
        status: { $in: ['created', 'active'] }
      });

      for (const proposal of proposals) {
        if (proposal.status === 'created' && currentBlock >= proposal.voteStart) {
          await Proposal.findByIdAndUpdate(proposal._id, { status: 'active' });
          await farcasterBot.publishCast(
            `🗳️ Voting is now active for proposal ${proposal.proposalId}!\n` +
            `Voting ends at block ${proposal.voteEnd}`
          );
        }
        else if (proposal.status === 'active' && currentBlock >= proposal.voteEnd) {
          await Proposal.findByIdAndUpdate(proposal._id, { status: 'ended' });
          await farcasterBot.publishCast(
            `🏁 Voting has ended for proposal ${proposal.proposalId}`
          );
        }
      }
    }
  });
  unwatchFunctions.push(unwatchBlocks);

  // Watch for ProposalCreated events
  const unwatchProposalCreated = client.watchContractEvent({
    address: DAO_GOVERNOR_ADDRESS as `0x${string}`,
    abi: DAO_GOVERNOR_ABI,
    eventName: 'ProposalCreated',
    onLogs: async (logs: any[]) => {
      for (const log of logs) {
        await withRetry(async () => {
          const decodedData = decodeLogData(log);
          
          if (decodedData.decoded && decodedData.eventName === 'ProposalCreated') {
            const {
              proposalId,
              proposer,
              voteStart,
              voteEnd
            } = extractLogProperties(log, ['proposalId', 'proposer', 'voteStart', 'voteEnd']) || {};

            await handleProposalCreated(wsManager, farcasterBot, {
              proposalId: proposalId.toString(),
              proposer,
              voteStart: Number(voteStart),
              voteEnd: Number(voteEnd)
            });
          }
        });
      }
    },
  });
  unwatchFunctions.push(unwatchProposalCreated);

  // Watch for Transfer events on erc20 token 
  const unwatchTransfers = client.watchContractEvent({
    address: ERC20_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    eventName: 'Transfer',
    args: {
      from: WATCH_ADDRESS
    },
    onLogs: async (logs: any[]) => {
      for (const log of logs) {
        console.log(log);
        try {
          const { from, to, value } = log.args;
          
          // Format the amount to a readable number with 2 decimal places
          const formattedAmount = (Number(value) / 1e18).toFixed(2);
          
          const timestamp = new Date().toLocaleString();

          const message = `🔄 Pay no attention to the man behind the curtain:\n` +
            `This is a test of my cool powers 🤓 observing transfers...\n` +
            `💰 ${formattedAmount} tokens transferred\n` +
            `👤 From: ${from.slice(0,6)}...${from.slice(-4)}\n` +
            `👤 To: ${to.slice(0,6)}...${to.slice(-4)}\n` +
            `🕒 Time: ${timestamp}`;

          await farcasterBot.publishCast(message);
          logger.info('Transfer event cast published', { from, to, value: formattedAmount });
        } catch (error) {
          logger.error('Error processing transfer event', error);
        }
      }
    },
  });
  unwatchFunctions.push(unwatchTransfers);

  // Watch for ProposalQueued events
  const unwatchProposalQueued = client.watchContractEvent({
    address: DAO_GOVERNOR_ADDRESS as `0x${string}`,
    abi: DAO_GOVERNOR_ABI,
    eventName: 'ProposalQueued',
    onLogs: async (logs: any[]) => {
      for (const log of logs) {
        await withRetry(async () => {
          const decodedData = decodeLogData(log);
          
          if (decodedData.decoded && decodedData.eventName === 'ProposalQueued') {
            const { proposalId, eta } = extractLogProperties(log, ['proposalId', 'eta']) || {};
            await handleProposalQueued(farcasterBot, proposalId.toString(), Number(eta));
          }
        });
      }
    },
  });
  unwatchFunctions.push(unwatchProposalQueued);

  // Watch for ProposalExecuted events
  const unwatchProposalExecuted = client.watchContractEvent({
    address: DAO_GOVERNOR_ADDRESS as `0x${string}`,
    abi: DAO_GOVERNOR_ABI,
    eventName: 'ProposalExecuted',
    onLogs: async (logs: any[]) => {
      for (const log of logs) {
        const { proposalId } = log.args as { proposalId: bigint };
        await handleProposalExecuted(farcasterBot, proposalId.toString());
      }
    },
  });
  unwatchFunctions.push(unwatchProposalExecuted);
}

async function processHistoricalEvents(
  wsManager: WebSocketManager,
  farcasterBot: FarcasterBot
) {
  const client = wsManager.getClient();
  const processor = new HistoricalEventProcessor(
    client,
    Number(HISTORIC_EVENTS_START_BLOCK),
    DAO_GOVERNOR_ADDRESS as `0x${string}`,
    DAO_GOVERNOR_ABI as Abi
  );

  // Generic function to process event logs
  const processLogs = async <TEventName extends string>(
    eventName: TEventName,
    handler: (decodedArgs: any, eventHash: string) => Promise<void>
  ) => {
    await processor.processHistoricalEvents(eventName, async (logs) => {
      for (const log of logs) {
        try {
          const { args, eventHash, decodedEventName } = decodeHistoricalLog(log, DAO_GOVERNOR_ABI as Abi);
          
          if (decodedEventName === 'Unknown') {
            logger.error(`Failed to decode ${eventName} event`, { log });
            continue;
          }

          if (decodedEventName !== eventName) {
            logger.debug(`Skipping ${decodedEventName} event during ${eventName} processing`);
            continue;
          }

          await handler(args, eventHash);
        } catch (error) {
          logger.error(`Error processing ${eventName} event`, { error, log });
        }
      }
    });
  };

  // Process historical ProposalCreated events
  await processLogs('ProposalCreated', async (decodedArgs, eventHash) => {
    const {
      proposalId,
      proposer,
      voteStart,
      voteEnd
    } = decodedArgs;

    await handleProposalCreated(wsManager, farcasterBot, {
      proposalId: proposalId.toString(),
      proposer,
      voteStart: Number(voteStart),
      voteEnd: Number(voteEnd)
    }, true, eventHash);
  });

  // Process historical ProposalQueued events
  await processLogs('ProposalQueued', async (decodedArgs, eventHash) => {
    const { proposalId, eta } = decodedArgs;
    await handleProposalQueued(farcasterBot, proposalId.toString(), Number(eta), true, eventHash);
  });

  // Process historical ProposalExecuted events
  await processLogs('ProposalExecuted', async (decodedArgs, eventHash) => {
    const { proposalId } = decodedArgs as { proposalId: bigint };
    await handleProposalExecuted(farcasterBot, proposalId.toString(), true, eventHash);
  });
}
