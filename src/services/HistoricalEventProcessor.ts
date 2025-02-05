import {
  PublicClient,
  GetLogsParameters,
  Log,
  Address,
  Abi,
  AbiEvent,
} from 'viem';
import { ProcessedBlock } from '../models/ProcessedBlock';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';

interface BatchProcessingMetrics {
  fromBlock: number;
  toBlock: number;
  eventsCount: number;
  processingTime: number;
}

interface ProcessingConfig {
  readonly INITIAL_BATCH_SIZE: number;
  readonly MIN_BATCH_SIZE: number;
  readonly MAX_BATCH_SIZE: number;
  readonly TARGET_PROCESSING_TIME: number;
}

export class HistoricalEventProcessor<TAbi extends Abi> {
  private batchSize: number;
  private readonly config: ProcessingConfig = {
    INITIAL_BATCH_SIZE: 1000,
    MIN_BATCH_SIZE: 100,
    MAX_BATCH_SIZE: 5000,
    TARGET_PROCESSING_TIME: 5000, // 5 seconds
  };

  constructor(
    private readonly client: PublicClient,
    private readonly startBlock: number,
    private readonly contractAddress: Address,
    private readonly abi: TAbi
  ) {
    this.batchSize = this.config.INITIAL_BATCH_SIZE;
  }

  private adjustBatchSize(processingTime: number): void {
    const ratio = this.config.TARGET_PROCESSING_TIME / processingTime;

    this.batchSize = Math.floor(this.batchSize * ratio);
    this.batchSize = Math.max(
      this.config.MIN_BATCH_SIZE,
      Math.min(this.config.MAX_BATCH_SIZE, this.batchSize)
    );

    logger.debug('Batch size adjusted', {
      newBatchSize: this.batchSize,
      processingTime,
    });
  }

  private async getLogsWithRetry(
    params: GetLogsParameters
  ): Promise<Log[]> {
    return withRetry(() => this.client.getLogs(params));
  }

  private async updateProcessedBlock(
    eventType: string,
    blockNumber: number
  ): Promise<void> {
    await ProcessedBlock.findOneAndUpdate(
      { eventType },
      {
        lastProcessedBlock: blockNumber,
        updatedAt: new Date(),
      },
      { upsert: true }
    );
  }

  private logBatchMetrics(
    eventName: string,
    metrics: BatchProcessingMetrics
  ): void {
    logger.info(`Processed ${eventName} events batch`, {
      fromBlock: metrics.fromBlock,
      toBlock: metrics.toBlock,
      eventsCount: metrics.eventsCount,
      processingTime: metrics.processingTime,
    });
  }

  async processHistoricalEvents<TEventName extends string>(
    eventName: TEventName,
    processor: (logs: Log[]) => Promise<void>
  ): Promise<void> {
    const lastProcessed = await ProcessedBlock.findOne({
      eventType: eventName,
    });
    const fromBlock = lastProcessed?.lastProcessedBlock || this.startBlock;
    const currentBlock = Number(await this.client.getBlockNumber());

    logger.info(`Processing historical ${eventName} events`, {
      fromBlock,
      currentBlock,
      batchSize: this.batchSize,
    });

    for (let from = fromBlock; from <= currentBlock; ) {
      const to = Math.min(from + this.batchSize - 1, currentBlock);
      const startTime = Date.now();

      try {
        const logs = await this.getLogsWithRetry({
          address: this.contractAddress,
          fromBlock: BigInt(from),
          toBlock: BigInt(to),
        });

        if (logs.length > 0) {
          await processor(logs);
        }

        await this.updateProcessedBlock(eventName, to);

        const processingTime = Date.now() - startTime;
        this.adjustBatchSize(processingTime);

        this.logBatchMetrics(eventName, {
          fromBlock: from,
          toBlock: to,
          eventsCount: logs.length,
          processingTime,
        });

        from = to + 1;
      } catch (error) {
        // Reduce batch size on error and retry
        this.batchSize = Math.max(
          this.config.MIN_BATCH_SIZE,
          Math.floor(this.batchSize / 2)
        );

        logger.error(`Error processing ${eventName} events batch`, {
          fromBlock: from,
          toBlock: to,
          error: {
            name: (error as Error).name,
            message: (error as Error).message?.replace(
              /https?:\/\/[^\/]*\/v[0-9]+\/[^\/]*\/[a-zA-Z0-9]{30,}/g,
              '[REDACTED_URL]'
            ),
          },
          newBatchSize: this.batchSize,
        });

        // Don't advance the block number on error
        continue;
      }
    }
  }

  // Helper method to get the current processing state
  async getProcessingState(eventName: string): Promise<{
    lastProcessedBlock: number;
    currentBlock: number;
    remaining: number;
  }> {
    const lastProcessed = await ProcessedBlock.findOne({
      eventType: eventName,
    });
    const currentBlock = Number(await this.client.getBlockNumber());

    return {
      lastProcessedBlock: lastProcessed?.lastProcessedBlock || this.startBlock,
      currentBlock,
      remaining:
        currentBlock -
        (lastProcessed?.lastProcessedBlock || this.startBlock),
    };
  }
}
