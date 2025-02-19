import { ponder } from "ponder:registry";
import {
  proposalCreated,
  proposalQueued,
  proposalExecuted,
} from "ponder:schema";
import { publishCast } from "../../src/utils/publishCast";
import { proposalMessages } from '../../src/utils/messages';

const { HISTORICAL_EVENTS_CUTOFF } = process.env;
const isHistoricalEvent = (event: any): boolean => Number(event.block.number) < Number(HISTORICAL_EVENTS_CUTOFF);

ponder.on("DAOGovernor:ProposalCreated", async ({ event, context }) => {
    const { db } = context;
    const isHistorical = isHistoricalEvent(event);
    const row = await db.find(proposalCreated, { proposalId: event.args.proposalId.toString() });
    if (row) {
        if(row.isCasted) {
            return;
        }
        const isCastSuccess = await publishCast(proposalMessages.created(event.args.proposalId.toString(), Number(event.args.voteStart), Number(event.args.voteEnd), isHistorical));
        await db.update(proposalCreated, { proposalId: event.args.proposalId.toString() }).set({ isCasted: isCastSuccess });
        return;
    }
    const isCastSuccess = await publishCast(proposalMessages.created(event.args.proposalId.toString(), Number(event.args.voteStart), Number(event.args.voteEnd), isHistorical));;

    await db.insert(proposalCreated).values({
        id: event.transaction.hash,
        proposalId: event.args.proposalId.toString(),
        proposer: event.args.proposer,
        voteStart: event.args.voteStart,
        voteEnd: event.args.voteEnd,
        status: "created",
        isCasted: isCastSuccess,
        source: "onchain",
        timestamp: event.block.timestamp,
    });
});

// Handler for NewAffiliate event
ponder.on("DAOGovernor:ProposalQueued", async ({ event, context }) => {
    const { db } = context;
    const isHistorical = isHistoricalEvent(event);
    const row = await db.find(proposalQueued, { proposalId: event.args.proposalId.toString() });
    if (row) {
        if(row.isCasted) {
            return;
        }
        const isCastSuccess = await publishCast(proposalMessages.queued(event.args.proposalId.toString(), Number(event.args.eta), isHistorical));
        await db.update(proposalQueued, { proposalId: event.args.proposalId.toString() }).set({ isCasted: isCastSuccess });
        return;
    }
    const isCasted = await publishCast(proposalMessages.queued(event.args.proposalId.toString(), Number(event.args.eta), isHistorical));

    await db.insert(proposalQueued).values({
        id: event.transaction.hash,
        proposalId: event.args.proposalId.toString(),
        status: "queued",
        isCasted,
        eta: event.args.eta,
        timestamp: event.block.timestamp,
    });
});

ponder.on("DAOGovernor:ProposalExecuted", async ({ event, context }) => {
  const { db } = context;
  const isHistorical = isHistoricalEvent(event);
  const row = await db.find(proposalExecuted, { proposalId: event.args.proposalId.toString() });
  if (row) {
    if(row.isCasted) {
        return;
    }
    const isCastSuccess = await publishCast(proposalMessages.executed(event.args.proposalId.toString(), isHistorical));
    await db.update(proposalCreated, { proposalId: event.args.proposalId.toString() }).set({ isCasted: isCastSuccess });
    return;
  }
  const isCasted = await publishCast(proposalMessages.executed(event.args.proposalId.toString(), isHistorical));

  await db.insert(proposalExecuted).values({
    id: event.transaction.hash,
    proposalId: event.args.proposalId.toString(),
    status: "executed",
    isCasted,
    timestamp: event.block.timestamp,
  });
});


