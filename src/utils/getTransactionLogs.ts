import { createPublicClient, http, TransactionReceipt, Log, decodeEventLog, Abi } from 'viem';
import { mainnet } from 'viem/chains';
import { logger } from './logger';
import { withRetry } from './retry';
import { HTTP_RPC_URL } from '../config';
import { DAO_GOVERNOR_ABI } from '../abi/daoGovernor';

interface TransactionLogsResult {
  receipt: TransactionReceipt;
  logs: Log[];
  blockNumber: bigint;
  timestamp: number;
}

interface DecodedHistoricalLog {
  args: any;
  eventHash: string;
  decodedEventName: string;
}

export function decodeLogData(log: Log) {
  try {
    const decodedLog = decodeEventLog({
        abi: DAO_GOVERNOR_ABI as Abi,
        data: log.data,
        topics: log.topics,
      });
      return {
        eventName: decodedLog.eventName,
        args: decodedLog.args,
        decoded: true,
        contract: 'DAO Governor'
      };
    
  } catch (error) {
    // If ABIs fail, return raw data
    return {
      eventName: 'Unknown',
      args: {
        data: log.data,
        topics: log.topics,
      },
      decoded: false,
      contract: 'Unknown'
    };
  }
}

/**
 * Retrieves transaction logs and details for a given transaction hash
 * @param txHash - The transaction hash to look up
 * @returns Transaction receipt, logs, block number and timestamp
 */
export async function getTransactionLogs(txHash: `0x${string}`): Promise<TransactionLogsResult> {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(HTTP_RPC_URL)
  });

  try {
    // Get transaction receipt with retry logic
    const receipt = await withRetry(
      () => client.getTransactionReceipt({ hash: txHash })
    );

    // Get block details to get timestamp
    const block = await withRetry(
      () => client.getBlock({ blockNumber: receipt.blockNumber })
    );

    // Get logs from the transaction
    const logs = receipt.logs;

    logger.info('Retrieved transaction logs', {
      txHash,
      blockNumber: receipt.blockNumber,
      logsCount: logs.length
    });

    return {
      receipt,
      logs,
      blockNumber: receipt.blockNumber,
      timestamp: Number(block.timestamp)
    };
  } catch (error) {
    logger.error('Error retrieving transaction logs', {
      txHash,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

function formatValue(value: any): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(formatValue).join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value, (_, v) => 
      typeof v === 'bigint' ? v.toString() : v
    );
  }
  return String(value);
}

export function extractLogProperties(log: Log, properties: string[]): Record<string, any> | null {
  const decodedData = decodeLogData(log);
  
  // If decoding failed, return null
  if (!decodedData.decoded) {
    return null;
  }

  // Create an object with only the requested properties
  const result: Record<string, any> = {};
  
  properties.forEach(prop => {
    // Check if the property exists in the decoded args
    if (decodedData.args && prop in decodedData.args) {
      result[prop] = (decodedData.args as Record<string, any>)[prop]
    } else {
      result[prop] = undefined;
    }
  });
  return result;
}

export function decodeHistoricalLog(log: Log, abi: Abi): DecodedHistoricalLog {
  const eventHash = `${log.transactionHash}-${log.logIndex}`;
  const decodedLog = decodeLogData(log);

  return {
    args: decodedLog.args,
    eventHash,
    decodedEventName: decodedLog.eventName || 'Unknown'
  };
}

// CLI execution
async function main() {
  const txHash = process.argv[2];
  
  if (!txHash) {
    console.error('Please provide a transaction hash as an argument');
    console.log('Usage: npm run logs 0x123...');
    process.exit(1);
  }

  if (!txHash.startsWith('0x') || txHash.length !== 66) {
    console.error('Invalid transaction hash format. Must be a 32-byte hex string starting with 0x');
    process.exit(1);
  }

  try {
    const result = await getTransactionLogs(txHash as `0x${string}`);
    // const properties = ['proposalId', 'proposer', 'voteStart', 'voteEnd'];
    // const extractedLog = extractLogProperties(result.logs[0], properties);
    console.log('\n📜 Transaction Details:');
    console.log('------------------------');
    console.log('Block Number:', result.blockNumber.toString());
    console.log('Timestamp:', new Date(result.timestamp * 1000).toISOString());
    console.log('Total Events:', result.logs.length);
    
    if (result.logs.length > 0) {
      console.log('\n🔍 Events:');
      console.log('------------------------');
      result.logs.forEach((log, index) => {
        const decodedData = decodeLogData(log);
        console.log(`\nEvent ${index + 1}:`);
        console.log('Contract:', decodedData.contract);
        console.log('Event Name:', decodedData.eventName);
        console.log('Address:', log.address);
        
        if (decodedData.decoded) {
          console.log('\nDecoded Parameters:');
          Object.entries(decodedData.args as Record<string, any>).forEach(([key, value]) => {
            if (typeof key === 'string' && isNaN(Number(key))) { // Skip numeric keys
              console.log(`${key}:`, formatValue(value));
            }
          });
        } else {
          console.log('\nRaw Data:');
          console.log('Topics:', log.topics);
          console.log('Data:', log.data);
        }
      });
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Execute if called directly (not imported)
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Example usage:
/*
const txHash = '0x123...' as `0x${string}`;
const txLogs = await getTransactionLogs(txHash);

console.log('Transaction details:', {
  blockNumber: txLogs.blockNumber,
  timestamp: new Date(txLogs.timestamp * 1000).toISOString(),
  logsCount: txLogs.logs.length
});

// Print decoded logs if needed
txLogs.logs.forEach((log, index) => {
  console.log(`Log ${index}:`, {
    address: log.address,
    topics: log.topics,
    data: log.data
  });
});
*/ 