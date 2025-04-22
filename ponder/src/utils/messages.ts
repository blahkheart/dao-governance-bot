export const proposalMessages = {
  created: (proposalId: string, voteStart: number, voteEnd: number, isHistorical: boolean) => {
    const tallyUrl = `https://www.tally.xyz/gov/unlock-protocol/proposal/${proposalId}`;
    if (isHistorical) {
      return `
        📜 Historical Proposal Alert!! 🗳\n\n
        Proposal ${proposalId}\n 
        was successfully created 🚀\n
        Voting period: ${formatDate(voteStart)} - ${formatDate(voteEnd)}\n
        Activity occured while I was asleep 💤 catching up now...\n\n
        View proposal at ${tallyUrl}
      `;
    }
    return `
        🗳 New proposal created!\n\n
        Proposal ID: ${proposalId}\n
        Voting starts: ${formatDate(voteStart)}\n
        Voting ends: ${formatDate(voteEnd)}\n\n
        View proposal at ${tallyUrl}
    `;
  },

  queued: (proposalId: string, eta: number, isHistorical: boolean) => {
    if (isHistorical) {
        return `📜 Historical Proposal Alert!! ⏳\n\n
        Proposal ${proposalId}\n 
        was queued for execution at ${formatDate(eta)}.`;
    }
    return `⏳ Proposal ${proposalId} has been queued. Execution ETA: ${formatDate(eta)}`;
  },

  executed: (proposalId: string, isHistorical: boolean) => {
    if (isHistorical) {
      return `📜 Historical Proposal Alert!! 🪐\n\n
      Proposal ${proposalId}\n 
      was successfully executed ✅`;
    }
    return `✅ Proposal ${proposalId} has been executed!`;
  },

  votingStarted: (proposalId: string, voteEnd: number) => {
    const tallyUrl = `https://www.tally.xyz/gov/unlock-protocol/proposal/${proposalId}`;
      return `
        🗳️ Voting is now active for proposal ${proposalId}!\n
        Voting ends at block ${voteEnd}\n\n
        Cast your vote at ${tallyUrl}
        `;
  },

  votingEnded: (proposalId: string) =>
    `🏁 Voting has ended for proposal ${proposalId}`
};

export const TransferMessages = {
  transfer: (from: string, to: string, amount: string, timestamp: string) => 
    `🔄 Pay no attention to the man behind the curtain:\n` +
    `This is a test of my cool powers 🤓 observing transfers...\n` +
    `💰 ${amount} tokens transferred\n` +
    `👤 From: ${from.slice(0,6)}...${from.slice(-4)}\n` +
    `👤 To: ${to.slice(0,6)}...${to.slice(-4)}\n` +
    `🕒 Time: ${timestamp}`
};

// Helper function for date formatting
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toUTCString();
} 