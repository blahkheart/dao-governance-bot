import { createPublicClient, webSocket, PublicClient } from 'viem';
import { mainnet } from 'viem/chains';
import { WS_RPC_URL } from '../constants';
import { logger } from '../utils/logger';
import EventEmitter from 'events';

export class WebSocketManager extends EventEmitter {
  private client: PublicClient;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;

  constructor() {
    super();
    this.client = this.setupClient();
  }

  private setupClient(): PublicClient {
    try {
      const transport = webSocket(WS_RPC_URL, {
        keepAlive: { interval: 30000 },
        retryCount: 10,
        timeout: 10000,
        reconnect: {
          attempts:this.maxReconnectAttempts,
          delay: this.reconnectDelay
        },
        retryDelay: 1000,
      });

      const client = createPublicClient({
        chain: mainnet,
        transport,
      });


      this.handleConnectionOpen();

      return client;
    } catch (error) {
        logger.error('Failed to setup WebSocket client', { error });
        this.handleConnectionError(error as Error);
      throw error;
    }
  }
  private handleConnectionOpen() {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    logger.info('WebSocket connection established [with keepAlive]');
    this.emit('connected');
  }

  private handleConnectionError(error: Error) {
    logger.error(`WebSocket connection error: ${error.message}`, {
      stack: error.stack || 'No stack available',
    });

    this.isConnected = false;
    this.emit('error', error);
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached - Scheduling reconnect');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    logger.warn(`Reconnecting WebSocket... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    setTimeout(() => {
      this.setupClient();
    }, this.reconnectDelay);
  }

  public getClient(): PublicClient {
    return this.client;
  }

  public isClientConnected(): boolean {
    return this.isConnected;
  }

  public cleanup() {
    logger.info('Closing WebSocket connection...');
    this.isConnected = false;
  }
}
