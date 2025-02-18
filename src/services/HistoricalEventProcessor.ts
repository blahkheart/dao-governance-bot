import {
  PublicClient,
  GetLogsParameters,
  Log,
  Address,
  Abi,
  parseAbi,
} from 'viem';
import { ProcessedBlock } from '../models/ProcessedBlock';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { decodeHistoricalLog, extractLogProperties } from '../utils/getTransactionLogs';

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

const TARGET_EVENTS = parseAbi([ 
  'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)',
  'event ProposalQueued(uint256 proposalId, uint256 eta)',
  'event ProposalExecuted(uint256 proposalId)'
])

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
    private readonly voteStart: number,
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
    return withRetry(() => this.client.getLogs(
      {
        ...params,
        events: TARGET_EVENTS // scope events to the TARGET_EVENTS
      }));
  }

  private async updateProcessedBlock(eventName: string, blockNumber: number): Promise<void> {
    await ProcessedBlock.findOneAndUpdate(
      { 
        eventType: eventName,
        'metadata.eventHash': { $exists: true }  // Only update records with an event hash
      },
      {
        $set: { lastProcessedBlock: blockNumber }
      },
      { upsert: false }  // Don't create new records here
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
    
  private async isEventProcessed(
    eventType: string,
    eventHash: string,
    proposalId?: string
  ): Promise<boolean> {
    const processed = await ProcessedBlock.findOne({
      eventType,
      'metadata.proposalId': proposalId,
      'metadata.isCasted': true
    });
    if (!!processed) {
      logger.warn(`Skipping already processed event: ${eventType} - ${eventHash}`);
      return true;
    }
    return false;
  }

  private async markEventProcessed(
    eventType: string,
    proposalId: string,
    blockNumber: number,
    metadata: {
      eventHash: string;
      proposalId?: string;
      status?: string;
    }
  ): Promise<void> {
    try {
      await ProcessedBlock.findOneAndUpdate(
        { 
          eventType,
          'metadata.proposalId': proposalId
        },
        {
          $set: {
            lastProcessedBlock: blockNumber,
            metadata: {
              ...metadata,
              isCasted: true
            }
          }
        },
        { upsert: true }
      );
    } catch (error: any) {
      if (error.code === 11000) {
        logger.warn(`Duplicate event detected: ${eventType} - ${metadata.eventHash}. Skipping insert.`);
      } else {
        throw error; // Rethrow for other errors
      }
    }
  }

  private async processEventBatch(
    eventName: string,
    from: number,
    to: number,
    processEvent: (args: any, eventHash: string) => Promise<void>
  ): Promise<void> {
    try {
      const logs = await this.getLogsWithRetry({
        address: this.contractAddress,
        fromBlock: BigInt(from),
        toBlock: BigInt(to),
      });
      
      for (const log of logs) {
        try {
          const { args, eventHash, decodedEventName } = decodeHistoricalLog(log, this.abi);
          
          // Skip if event type doesn't match what we're currently processing
          if (decodedEventName !== eventName) {
            logger.debug(`Skipping ${decodedEventName} event during ${eventName} processing`);
            continue;
          }

          await processEvent(args, eventHash);
        } catch (error) {
          logger.error(`Error processing individual event`, {
            eventHash: log.transactionHash + '-' + log.logIndex,
            error
          });
        }
      }

      // Update last processed block
      await ProcessedBlock.findOneAndUpdate(
        { eventType: eventName },
        { 
          $set: { lastProcessedBlock: to }
        },
        { upsert: true }
      );
    } catch (error) {
      throw error;
    }
  }

  async processHistoricalEvents<TEventName extends string>(
    eventName: TEventName,
    processor: (logs: Log[]) => Promise<void>
  ): Promise<void> {
    const lastProcessed = await ProcessedBlock.findOne({
      eventType: eventName,
    });
    const fromBlock = lastProcessed?.lastProcessedBlock || this.voteStart;
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
        await this.processEventBatch(eventName, from, to, async (args, eventHash) => {
          // Check if this event was already processed
          if (await this.isEventProcessed(eventName, eventHash)) {
            logger.debug(`Event ${eventHash} already processed, skipping`);
            return;
          }

          try {
            await processor([{ ...args, transactionHash: eventHash }]);
            
            // Mark event as processed after successful processing
            await this.markEventProcessed(eventName, args.proposalId?.toString() || '', Number(to), {
              eventHash,
              proposalId: args.proposalId?.toString(),
              status: 'processed'
            });
          } catch (error) {
            logger.error(`Error processing individual event`, {
              eventHash,
              proposalId: args.proposalId?.toString(),
              error: (error as Error).message
            });
            
            // Update ProcessedBlock with error information
            await ProcessedBlock.findOneAndUpdate(
              { 
                eventType: eventName,
                'metadata.eventHash': eventHash
              },
              {
                $push: {
                  'metadata.processingErrors': {
                    blockNumber: Number(args.blockNumber),
                    error: (error as Error).message,
                    timestamp: new Date()
                  }
                }
              },
              { upsert: true }
            );
          }
        });

        // Update the last processed block
        await this.updateProcessedBlock(eventName, to);

        const processingTime = Date.now() - startTime;
        // Adjust batch size based on processing time
        this.adjustBatchSize(processingTime);
        // Log batch metrics
        this.logBatchMetrics(eventName, {
          fromBlock: from,
          toBlock: to,
          eventsCount: this.batchSize,
          processingTime
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
      lastProcessedBlock: lastProcessed?.lastProcessedBlock || this.voteStart,
      currentBlock,
      remaining:
        currentBlock -
        (lastProcessed?.lastProcessedBlock || this.voteStart),
    };
  }
}
