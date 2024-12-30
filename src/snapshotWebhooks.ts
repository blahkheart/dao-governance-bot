import express from 'express';
import { FarcasterBot } from './agent';
import { Proposal } from './models/Proposal';

interface SnapshotEvent {
  id: string;
  event: 'proposal/created' | 'proposal/start' | 'proposal/end';
  space: string;
  expire: number;
}

export function setupSnapshotWebhooks(app: express.Express, farcasterBot: FarcasterBot) {
  app.post('/webhook', async (req, res) => {
    const event = req.body as SnapshotEvent;
    
    try {
      switch (event.event) {
        case 'proposal/created':
          // Save new proposal to MongoDB
          await Proposal.create({
            proposalId: event.id,
            space: event.space,
            proposer: 'undefined', // Snapshot webhook doesn't provide proposer
            endTime: event.expire,
            status: 'created',
            source: 'snapshot'
          });

          await farcasterBot.publishCast(
            `📜 New Proposal in ${event.space}!\n` +
            `View proposal: https://snapshot.org/#/${event.space}/proposal/${event.id}\n` +
            `#SnapshotDAO #Governance`
          );
          break;

        case 'proposal/start':
          // Update proposal status in MongoDB
          await Proposal.findOneAndUpdate(
            { proposalId: event.id },
            { status: 'active' }
          );

          await farcasterBot.publishCast(
            `🗳️ Voting has started in ${event.space}!\n` +
            `Cast your vote: https://snapshot.org/#/${event.space}/proposal/${event.id}\n` +
            `#SnapshotDAO #Vote`
          );
          break;

        case 'proposal/end':
          // Update proposal status in MongoDB
          await Proposal.findOneAndUpdate(
            { proposalId: event.id },
            { status: 'ended' }
          );

          await farcasterBot.publishCast(
            `🏁 Voting has ended in ${event.space}!\n` +
            `See results: https://snapshot.org/#/${event.space}/proposal/${event.id}\n` +
            `#SnapshotDAO #Results`
          );
          break;
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error handling webhook:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
} 