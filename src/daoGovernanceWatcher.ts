// src/daoGovernorWatcher.ts
import { createPublicClient, webSocket } from 'viem';
import { mainnet } from 'viem/chains';
import { DAO_GOVERNOR_ABI, DAO_GOVERNOR_ADDRESS, ERC20_ADDRESS, ERC20_ABI } from './config'; 
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

  // Watch for new blocks to track proposal status changes
  client.watchBlocks({
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

  // Watch for ProposalCreated events
  client.watchContractEvent({
    address: ERC20_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    eventName: 'Transfer',
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

  // Watch for ProposalQueued events
  client.watchContractEvent({
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

  // Watch for ProposalExecuted events
  client.watchContractEvent({
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
}
