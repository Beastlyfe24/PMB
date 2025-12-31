import { ClobClient, ApiKeyCreds, Chain, Side, OrderType } from '@polymarket/clob-client';
import { ethers } from 'ethers';
import pino from 'pino';
import WebSocket from 'ws';
import { TIMING } from '@polymarket-mirror/shared';

const logger = pino({ name: 'clob' });

export interface ClobConfig {
  host: string;
  chainId: number;
  privateKey?: string;
  funderAddress?: string;
}

export interface BookTickerUpdate {
  assetId: string;
  bestBid: number | null;
  bestAsk: number | null;
  timestamp: number;
}

export interface OrderRequest {
  tokenId: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
}

export class PolymarketClobClient {
  private client: ClobClient | null = null;
  private config: ClobConfig;
  private marketWs: WebSocket | null = null;
  private userWs: WebSocket | null = null;
  private marketTickerHandler: ((update: BookTickerUpdate) => void) | null = null;
  private userUpdateHandler: ((update: any) => void) | null = null;
  private subscribedAssets: Set<string> = new Set();

  constructor(config: ClobConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.config.privateKey) {
      logger.warn('No private key provided, initializing in read-only mode');
      this.client = new ClobClient(
        this.config.host,
        this.config.chainId as Chain
      );
      return;
    }

    logger.info('Initializing CLOB client with L2 auth');

    const wallet = new ethers.Wallet(this.config.privateKey);

    // Step 1: Create client with L1 credentials
    const clientL1 = new ClobClient(
      this.config.host,
      this.config.chainId as Chain,
      wallet
    );

    // Step 2: Derive or create API key (L2 credentials)
    logger.debug('Creating or deriving API key');
    const apiCreds = await clientL1.createOrDeriveApiKey();

    // Step 3: Re-initialize with L2 credentials
    this.client = new ClobClient(
      this.config.host,
      this.config.chainId as Chain,
      wallet,
      apiCreds as ApiKeyCreds
    );

    logger.info('CLOB client initialized with L2 auth');
  }

  async connectMarketChannel(): Promise<void> {
    const wsUrl = this.config.host.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws/market';

    logger.info({ wsUrl }, 'Connecting to market channel');

    this.marketWs = new WebSocket(wsUrl);

    this.marketWs.on('open', () => {
      logger.info('Market channel connected');

      // Re-subscribe to all assets
      for (const assetId of this.subscribedAssets) {
        this.subscribeToAsset(assetId);
      }
    });

    this.marketWs.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.event_type === 'price_change' || message.event_type === 'last_trade_price') {
          if (this.marketTickerHandler) {
            const update: BookTickerUpdate = {
              assetId: message.asset_id,
              bestBid: message.best_bid ? parseFloat(message.best_bid) : null,
              bestAsk: message.best_ask ? parseFloat(message.best_ask) : null,
              timestamp: message.timestamp || Date.now(),
            };

            this.marketTickerHandler(update);
          }
        }
      } catch (error) {
        logger.error({ error }, 'Failed to parse market message');
      }
    });

    this.marketWs.on('error', (error) => {
      logger.error({ error }, 'Market channel error');
    });

    this.marketWs.on('close', () => {
      logger.warn('Market channel disconnected, reconnecting...');
      setTimeout(() => this.connectMarketChannel(), TIMING.WS_RECONNECT_BASE_DELAY);
    });
  }

  subscribeToAsset(assetId: string): void {
    this.subscribedAssets.add(assetId);

    if (this.marketWs?.readyState === WebSocket.OPEN) {
      const subscribeMsg = {
        type: 'subscribe',
        market: assetId,
        assets_ids: [assetId],
      };

      logger.debug({ assetId }, 'Subscribing to asset');
      this.marketWs.send(JSON.stringify(subscribeMsg));
    }
  }

  unsubscribeFromAsset(assetId: string): void {
    this.subscribedAssets.delete(assetId);

    if (this.marketWs?.readyState === WebSocket.OPEN) {
      const unsubscribeMsg = {
        type: 'unsubscribe',
        market: assetId,
      };

      logger.debug({ assetId }, 'Unsubscribing from asset');
      this.marketWs.send(JSON.stringify(unsubscribeMsg));
    }
  }

  onMarketTicker(handler: (update: BookTickerUpdate) => void): void {
    this.marketTickerHandler = handler;
  }

  async createMarketableOrder(request: OrderRequest): Promise<any> {
    if (!this.client) {
      throw new Error('CLOB client not initialized');
    }

    logger.info({ request }, 'Creating marketable limit order');

    const side = request.side === 'BUY' ? Side.BUY : Side.SELL;

    // Create marketable limit order
    const order = await this.client.createOrder({
      tokenID: request.tokenId,
      price: request.price,
      size: request.size,
      side,
      orderType: OrderType.GTD, // Good till date (acts as limit)
      feeRateBps: '0', // Will be calculated by server
      nonce: Date.now(), // Use timestamp as nonce
      expiration: Math.floor(Date.now() / 1000) + 300, // 5 minutes
    });

    logger.info({ orderId: order.orderID }, 'Order created');

    return order;
  }

  async getOrderBook(tokenId: string): Promise<{ bids: any[]; asks: any[] }> {
    if (!this.client) {
      throw new Error('CLOB client not initialized');
    }

    const book = await this.client.getOrderBook(tokenId);

    return {
      bids: book.bids || [],
      asks: book.asks || [],
    };
  }

  async cancelOrder(orderId: string): Promise<void> {
    if (!this.client) {
      throw new Error('CLOB client not initialized');
    }

    logger.info({ orderId }, 'Cancelling order');
    await this.client.cancelOrder(orderId);
  }

  close(): void {
    if (this.marketWs) {
      this.marketWs.close();
      this.marketWs = null;
    }

    if (this.userWs) {
      this.userWs.close();
      this.userWs = null;
    }
  }
}
