import { createPublicClient, webSocket, PublicClient, Transport } from 'viem';
import { mainnet } from 'viem/chains';
import { logger } from '../utils/logger';
import { WS_RPC_URL } from '../constants';
import EventEmitter from 'events';
import { WebSocket } from 'ws';

export class WebSocketManager extends EventEmitter {
  private client: PublicClient | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly initialReconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private isConnected = false;

  constructor() {
    super();
    this.setupClient();
  }

  private setupClient() {
    try {
      const transport = webSocket(WS_RPC_URL, {
        retryCount: 0,
        timeout: 10000,
      }) as Transport;

      this.client = createPublicClient({
        chain: mainnet,
        transport,
      });

      // Setup WebSocket connection monitoring
      const ws = (transport as any).socket;

      ws.on('open', () => {
        this.handleConnectionOpen();
      });

      ws.on('close', () => {
        this.handleConnectionClose();
      });

      ws.on('error', (error: Error) => {
        this.handleConnectionError(error);
      });

      // Setup ping/pong keep-alive
      this.setupKeepAlive(ws);

    } catch (error) {
      logger.error('Failed to setup WebSocket client', { error });
      this.scheduleReconnect();
    }
  }

  private setupKeepAlive(ws: WebSocket) {
    // Clear any existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Send ping every 30 seconds
    this.pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping(() => {
          // Optional: Log successful pings at debug level
          logger.debug('WebSocket ping successful');
        });
      }
    }, 30000);
  }

  private handleConnectionOpen() {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    logger.info('WebSocket connection established');
    this.emit('connected');
  }

  private handleConnectionClose() {
    this.isConnected = false;
    logger.warn('WebSocket connection closed');
    this.emit('disconnected');
    this.scheduleReconnect();
  }

  private handleConnectionError(error: Error) {
    logger.error('WebSocket connection error', { error });
    this.emit('error', error);
    if (this.isConnected) {
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    const delay = Math.min(
      this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    logger.info('Scheduling reconnection', {
      attempt: this.reconnectAttempts + 1,
      delay,
    });

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.setupClient();
    }, delay);
  }

  public getClient(): PublicClient {
    if (!this.client) {
      throw new Error('WebSocket client not initialized');
    }
    return this.client;
  }

  public isClientConnected(): boolean {
    return this.isConnected;
  }

  public cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    // Close the WebSocket connection if it exists
    if (this.client) {
      const transport = (this.client.transport as any);
      if (transport.socket) {
        transport.socket.close();
      }
    }
  }
} 