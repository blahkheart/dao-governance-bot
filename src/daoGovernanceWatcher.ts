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

const WATCH_ADDRESS = '0xa0c03bE2Cf62f171e29e0d8766677cF4c50d58F8';

export async function watchGovernorContract(farcasterBot: FarcasterBot) {
  const wsManager = new WebSocketManager();
  const unwatchFunctions: (() => void)[] = [];

  // Process historical events first
  await processHistoricalEvents(wsManager, farcasterBot);

  // Setup event handlers for WebSocket connection status
  wsManager.on('connected', async () => {
    logger.info('Setting up contract event watchers');
    await setupEventWatchers(wsManager, farcasterBot, unwatchFunctions);
  });

  wsManager.on('disconnected', () => {
    logger.warn('Cleaning up event watchers due to disconnection');
    cleanup(unwatchFunctions);
  });

  wsManager.on('maxReconnectAttemptsReached', () => {
    logger.error('Failed to maintain WebSocket connection');
    process.exit(1); // Or implement your preferred failure handling
  });

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

    // Watch for new blocks to track proposal status changes
  const unwatchBlocks = client.watchBlocks({
    onBlock: async (block) => {
      const currentBlock = block.number;
      const proposals = await Proposal.find({
        status: { $in: ['created', 'active'] }
      });

      for (const proposal of proposals) {
        if (proposal.status === 'created' && currentBlock >= proposal.startBlock) {
          await Proposal.findByIdAndUpdate(proposal._id, { status: 'active' });
          await farcasterBot.publishCast(
            `🗳️ Voting is now active for proposal ${proposal.proposalId}!\n` +
            `Voting ends at block ${proposal.endBlock}`
          );
        }
        else if (proposal.status === 'active' && currentBlock >= proposal.endBlock) {
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
          const {
            proposalId,
            proposer,
            startBlock,
            endBlock
          } = log.args as {
            proposalId: bigint;
            proposer: `0x${string}`;
            startBlock: bigint;
            endBlock: bigint;
          };

          await handleProposalCreated(farcasterBot, {
            proposalId: proposalId.toString(),
            proposer,
            startBlock: Number(startBlock),
            endBlock: Number(endBlock),
          });
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
        const { proposalId, eta } = log.args as {
          proposalId: bigint;
          eta: bigint;
        };
        await handleProposalQueued(farcasterBot, proposalId.toString(), Number(eta));
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
    Number(HISTORIC_EVENTS_START_BLOCK), // You can set this to the deployment block of your contract
    DAO_GOVERNOR_ADDRESS as `0x${string}`,
    DAO_GOVERNOR_ABI
  );

  // Process historical ProposalCreated events
  await processor.processHistoricalEvents('ProposalCreated', async (logs) => {
    for (const log of logs) {
      const {
        proposalId,
        proposer,
        startBlock,
        endBlock
      } = log.args as {
        proposalId: bigint;
        proposer: `0x${string}`;
        startBlock: bigint;
        endBlock: bigint;
      };

      await handleProposalCreated(farcasterBot, {
        proposalId: proposalId.toString(),
        proposer,
        startBlock: Number(startBlock),
        endBlock: Number(endBlock),
      }, true);
    }
  });

  // Process historical ProposalQueued events
  await processor.processHistoricalEvents('ProposalQueued', async (logs) => {
    for (const log of logs) {
      const { proposalId, eta } = log.args as {
        proposalId: bigint;
        eta: bigint;
      };
      await handleProposalQueued(farcasterBot, proposalId.toString(), Number(eta), true);
    }
  });

  // Process historical ProposalExecuted events
  await processor.processHistoricalEvents('ProposalExecuted', async (logs) => {
    for (const log of logs) {
      const { proposalId } = log.args as { proposalId: bigint };
      await handleProposalExecuted(farcasterBot, proposalId.toString(), true);
    }
  });
}
