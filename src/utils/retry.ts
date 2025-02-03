import { logger } from './logger';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  exponentialBackoff?: boolean;
  retryableErrors?: Array<string | RegExp>;
}

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  exponentialBackoff: true,
  retryableErrors: [
    // Common blockchain/RPC errors
    'timeout',
    'network',
    'rate limit',
    'too many requests',
    'server error',
    'connection refused',
    'nonce too low',
    /^5\d{2}$/, // HTTP 5XX errors
    /exceeded/i, // Rate limits
    /econnreset/i,
    /econnrefused/i,
    /etimedout/i,
  ]
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...defaultOptions, ...options };
  let lastError: Error;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = config.retryableErrors.some(pattern => {
        if (pattern instanceof RegExp) {
          return pattern.test(error.message);
        }
        return error.message.toLowerCase().includes(pattern.toLowerCase());
      });

      if (!isRetryable || attempt === config.maxAttempts) {
        logger.error('Operation failed permanently', {
          error: error.message,
          attempt,
          maxAttempts: config.maxAttempts
        });
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = config.exponentialBackoff
        ? Math.min(config.initialDelay * Math.pow(2, attempt - 1), config.maxDelay)
        : config.initialDelay;

      logger.warn('Operation failed, retrying', {
        error: error.message,
        attempt,
        nextRetryDelay: delay
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
} 