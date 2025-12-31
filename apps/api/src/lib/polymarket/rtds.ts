import WebSocket from 'ws';
import pino from 'pino';
import { TIMING } from '@polymarket-mirror/shared';

const logger = pino({ name: 'rtds' });

export interface RTDSMessage {
  eventType: string;
  data: any;
  timestamp?: number;
}

export class RTDSClient {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private reconnectAttempt: number = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isManualClose: boolean = false;
  private messageHandler: ((msg: RTDSMessage) => void) | null = null;
  private subscriptions: Set<string> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      logger.info({ wsUrl: this.wsUrl }, 'Connecting to RTDS');

      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        logger.info('RTDS connected');
        this.reconnectAttempt = 0;

        // Re-subscribe to all previous subscriptions
        for (const sub of this.subscriptions) {
          this.sendSubscription(sub);
        }

        // Start heartbeat
        this.startHeartbeat();

        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'pong') {
            return; // Ignore heartbeat responses
          }

          if (this.messageHandler) {
            const rtdsMessage: RTDSMessage = {
              eventType: message.event_type || message.type || 'unknown',
              data: message.data || message,
              timestamp: message.timestamp || Date.now(),
            };

            this.messageHandler(rtdsMessage);
          }
        } catch (error) {
          logger.error({ error }, 'Failed to parse RTDS message');
        }
      });

      this.ws.on('error', (error) => {
        logger.error({ error }, 'RTDS error');
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        logger.warn({ code, reason: reason.toString() }, 'RTDS disconnected');

        this.stopHeartbeat();

        if (!this.isManualClose) {
          this.scheduleReconnect();
        }
      });
    });
  }

  onMessage(handler: (msg: RTDSMessage) => void): void {
    this.messageHandler = handler;
  }

  subscribe(channel: string): void {
    this.subscriptions.add(channel);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription(channel);
    }
  }

  unsubscribe(channel: string): void {
    this.subscriptions.delete(channel);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendUnsubscription(channel);
    }
  }

  private sendSubscription(channel: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const subscribeMsg = {
      type: 'subscribe',
      channel,
    };

    logger.debug({ channel }, 'Subscribing to RTDS channel');
    this.ws.send(JSON.stringify(subscribeMsg));
  }

  private sendUnsubscription(channel: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const unsubscribeMsg = {
      type: 'unsubscribe',
      channel,
    };

    logger.debug({ channel }, 'Unsubscribing from RTDS channel');
    this.ws.send(JSON.stringify(unsubscribeMsg));
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    if (this.reconnectAttempt >= TIMING.WS_RECONNECT_MAX_ATTEMPTS) {
      logger.error('Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(
      TIMING.WS_RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempt),
      TIMING.WS_RECONNECT_MAX_DELAY
    );

    logger.info({ attempt: this.reconnectAttempt + 1, delay }, 'Scheduling reconnect');

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.reconnectAttempt++;
      this.connect().catch(err => {
        logger.error({ error: err }, 'Reconnect failed');
      });
    }, delay);
  }

  close(): void {
    this.isManualClose = true;
    this.stopHeartbeat();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscriptions.clear();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
