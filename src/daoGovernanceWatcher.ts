import { createPublicClient, webSocket } from 'viem';
import { mainnet } from 'viem/chains';
import { DAO_GOVERNOR_ADDRESS, ERC20_ADDRESS } from './config'; 
import { DAO_GOVERNOR_ABI, ERC20_ABI } from './abi';
import { WS_RPC_URL } from './constants';
import {
  handleProposalCreated,
  handleProposalExecuted,
  handleProposalQueued,
} from './eventHandlers';
import { FarcasterBot } from './agent';
import { Proposal } from './models/Proposal';

export async function watchGovernorContract(farcasterBot: FarcasterBot) {
  const client = createPublicClient({
    chain: mainnet,
    transport: webSocket(WS_RPC_URL),
  });

  // Store unwatch functions
  const unwatchFunctions: (() => void)[] = [];

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

  // Watch for Transfer events on erc20 token 
  const unwatchTransfers = client.watchContractEvent({
    address: ERC20_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    eventName: 'Transfer',
    onLogs: async (logs: any[]) => {
      for (const log of logs) {
        console.log(log);
      }
    },
  });
  unwatchFunctions.push(unwatchTransfers);

  // Watch for ProposalCreated events
  const unwatchProposalCreated = client.watchContractEvent({
    address: DAO_GOVERNOR_ADDRESS as `0x${string}`,
    abi: DAO_GOVERNOR_ABI,
    eventName: 'ProposalCreated',
    onLogs: async (logs: any[]) => {
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
        });
      }
    },
  });
  unwatchFunctions.push(unwatchProposalCreated);

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

  // Cleanup function
  const cleanup = () => {
    // Unwatch all event subscriptions
    unwatchFunctions.forEach(unwatch => unwatch());
  };

  // Handle process termination
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  return cleanup;
}
