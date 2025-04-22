import { Hono } from "hono";
import { Proposal } from "../models/Proposal";
import { publishCast } from "../utils/publishCast";
import { logger } from "../utils/logger";
import { connectToDatabase } from "../utils/dbConnect";

// MongoDB is connection
connectToDatabase().catch(err => {
  logger.error('Failed to connect to MongoDB', err);
  process.exit(1);
});

const app = new Hono();

interface SnapshotEvent {
  id: string;
  event: 'proposal/created' | 'proposal/start' | 'proposal/end';
  space: string;
  expire: number;
}

// Snapshot webhook endpoint
app.post("/webhook", async (c) => {
  try {
    const event = await c.req.json() as SnapshotEvent;
    logger.info(`Snapshot webhook ping received for event: ${event.event} from space: ${event.space}`);
    
    switch (event.event) {
      case 'proposal/created': {
        // Save new proposal to MongoDB
        await Proposal.create({
          proposalId: event.id,
          space: event.space,
          proposer: 'snapshot', // Snapshot webhook doesn't provide detailed proposer info
          endTime: event.expire,
          status: 'created',
          source: 'snapshot'
        });

        await publishCast(
          `📜 New Proposal in ${event.space}!\n` +
          `View proposal: https://snapshot.org/#/${event.space}/proposal/${event.id}\n` +
          `#SnapshotDAO #Governance`
        );
        break;
      }

      case 'proposal/start': {
        // Update proposal status in MongoDB
        await Proposal.findOneAndUpdate(
          { proposalId: event.id },
          { status: 'active' }
        );

        await publishCast(
          `🗳️ Voting has started in ${event.space}!\n` +
          `Cast your vote: https://snapshot.org/#/${event.space}/proposal/${event.id}\n` +
          `#SnapshotDAO #Vote`
        );
        break;
      }

      case 'proposal/end': {
        // Update proposal status in MongoDB
        await Proposal.findOneAndUpdate(
          { proposalId: event.id },
          { status: 'ended' }
        );

        await publishCast(
          `🏁 Voting has ended in ${event.space}!\n` +
          `See results: https://snapshot.org/#/${event.space}/proposal/${event.id}\n` +
          `#SnapshotDAO #Results`
        );
        break;
      }
    }

    return c.json({ success: true });
  } catch (error) {
    logger.error('Error handling webhook:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});


export default app;
