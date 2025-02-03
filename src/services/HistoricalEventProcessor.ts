import { PublicClient } from 'viem';
import { ProcessedBlock } from '../models/ProcessedBlock';
import { Proposal } from '../models/Proposal';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';

export class HistoricalEventProcessor {
  private readonly INITIAL_BATCH_SIZE = 1000;
  private readonly MIN_BATCH_SIZE = 100;
  private readonly MAX_BATCH_SIZE = 5000;
  private batchSize: number;

  constructor(
    private readonly client: PublicClient,
    private readonly startBlock: number,
    private readonly contractAddress: `0x${string}`,
    private readonly abi: any
  ) {
    this.batchSize = this.INITIAL_BATCH_SIZE;
  }

  private adjustBatchSize(processingTime: number) {
    const targetTime = 5000; // 5 seconds
    const ratio = targetTime / processingTime;
    
    this.batchSize = Math.floor(this.batchSize * ratio);
    this.batchSize = Math.max(this.MIN_BATCH_SIZE, Math.min(this.MAX_BATCH_SIZE, this.batchSize));
    
    logger.debug(`Adjusted batch size to ${this.batchSize}`);
  }

  async processHistoricalEvents(
    eventName: string,
    processor: (logs: any[]) => Promise<void>
  ) {
    const lastProcessed = await ProcessedBlock.findOne({ eventType: eventName });
    const fromBlock = lastProcessed?.lastProcessedBlock || this.startBlock;
    const currentBlock = await this.client.getBlockNumber();

    logger.info(`Processing historical ${eventName} events`, {
      fromBlock,
      currentBlock: Number(currentBlock),
      batchSize: this.batchSize
    });

    for (let from = fromBlock; from <= currentBlock; from += this.batchSize) {
      const to = Math.min(from + this.batchSize - 1, Number(currentBlock));
      
      const startTime = Date.now();
      
      try {
        const logs = await withRetry(() => this.client.getLogs({
          address: this.contractAddress,
          event: this.abi.find((e: any) => e.name === eventName),
          fromBlock: BigInt(from),
          toBlock: BigInt(to)
        }));

        if (logs.length > 0) {
          await processor(logs);
        }

        await ProcessedBlock.findOneAndUpdate(
          { eventType: eventName },
          { 
            lastProcessedBlock: to,
            updatedAt: new Date()
          },
          { upsert: true }
        );

        const processingTime = Date.now() - startTime;
        this.adjustBatchSize(processingTime);

        logger.info(`Processed ${eventName} events batch`, {
          fromBlock: from,
          toBlock: to,
          eventsCount: logs.length,
          processingTime
        });
      } catch (error) {
        logger.error(`Error processing ${eventName} events batch`, {
          fromBlock: from,
          toBlock: to,
          error
        });
        throw error;
      }
    }
  }
}