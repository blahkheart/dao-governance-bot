import { onchainEnum, onchainTable } from "ponder";

export const proposalStatus = onchainEnum("proposal_status", ["created", "queued", "executed"]);
export const proposalSource = onchainEnum("proposal_source", ["snapshot", "onchain"]);

// Table to store campaign details
export const proposalCreated = onchainTable("proposal_created", (t) => ({
  id: t.text().notNull(),
  proposalId: t.text().primaryKey(),
  proposer: t.text().notNull(),
  voteStart: t.bigint().notNull(),
  voteEnd: t.bigint().notNull(),
  status: proposalStatus().notNull(),
  isCasted: t.boolean(),
  queuedAt: t.bigint(),
  executedAt: t.bigint(),
  source: proposalSource().notNull(),
  timestamp: t.bigint().notNull(),
}));

// Table to store affiliate details
export const proposalQueued = onchainTable("proposal_queued", (t) => ({
  id: t.text().notNull(),
  proposalId: t.text().primaryKey(),
  status: proposalStatus().notNull(),
  isCasted: t.boolean(),
  eta:t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

// Table to store referee details
export const proposalExecuted = onchainTable("proposal_executed", (t) => ({
  id: t.text().notNull(),
  proposalId: t.text().primaryKey(),
  status: proposalStatus().notNull(),
  isCasted: t.boolean(),
  timestamp: t.bigint().notNull(),
}));
