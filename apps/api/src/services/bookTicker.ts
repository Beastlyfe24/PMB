import { PolymarketClobClient, BookTickerUpdate } from '../lib/polymarket/clob';
import { BookTickerData } from '@polymarket-mirror/shared';
import pino from 'pino';

const logger = pino({ name: 'book-ticker' });

export class BookTicker {
  private tickers: Map<string, BookTickerData> = new Map();
  private subscribedTokens: Set<string> = new Set();
  private maxCacheSize: number = 200; // LRU cache size

  constructor(private clobClient: PolymarketClobClient) {}

  async start(): Promise<void> {
    logger.info('Starting BookTicker service');

    // Connect to market channel
    await this.clobClient.connectMarketChannel();

    // Set up message handler
    this.clobClient.onMarketTicker((update: BookTickerUpdate) => {
      this.handleUpdate(update);
    });

    logger.info('BookTicker service started');
  }

  private handleUpdate(update: BookTickerUpdate): void {
    const existing = this.tickers.get(update.assetId);

    const bestBid = update.bestBid ?? existing?.bestBid ?? null;
    const bestAsk = update.bestAsk ?? existing?.bestAsk ?? null;

    let spreadBps: number | null = null;
    if (bestBid !== null && bestAsk !== null && bestBid > 0) {
      const mid = (bestBid + bestAsk) / 2;
      spreadBps = ((bestAsk - bestBid) / mid) * 10000;
    }

    const tickerData: BookTickerData = {
      tokenId: update.assetId,
      bestBid,
      bestAsk,
      spreadBps,
      lastUpdateMs: update.timestamp || Date.now(),
    };

    this.tickers.set(update.assetId, tickerData);

    logger.debug(
      {
        tokenId: update.assetId,
        bestBid,
        bestAsk,
        spreadBps: spreadBps?.toFixed(2),
      },
      'Book ticker updated'
    );

    // LRU eviction if cache too large
    if (this.tickers.size > this.maxCacheSize) {
      this.evictOldest();
    }
  }

  private evictOldest(): void {
    let oldest: { tokenId: string; timestamp: number } | null = null;

    for (const [tokenId, data] of this.tickers.entries()) {
      if (!oldest || data.lastUpdateMs < oldest.timestamp) {
        oldest = { tokenId, timestamp: data.lastUpdateMs };
      }
    }

    if (oldest) {
      this.tickers.delete(oldest.tokenId);
      this.subscribedTokens.delete(oldest.tokenId);
      this.clobClient.unsubscribeFromAsset(oldest.tokenId);
      logger.debug({ tokenId: oldest.tokenId }, 'Evicted oldest ticker');
    }
  }

  subscribe(tokenId: string): void {
    if (this.subscribedTokens.has(tokenId)) {
      return;
    }

    logger.debug({ tokenId }, 'Subscribing to token');
    this.subscribedTokens.add(tokenId);
    this.clobClient.subscribeToAsset(tokenId);
  }

  getTicker(tokenId: string): BookTickerData | null {
    return this.tickers.get(tokenId) || null;
  }

  getSubscribedCount(): number {
    return this.subscribedTokens.size;
  }

  getLastUpdate(): Date | null {
    let latest = 0;
    for (const ticker of this.tickers.values()) {
      if (ticker.lastUpdateMs > latest) {
        latest = ticker.lastUpdateMs;
      }
    }
    return latest > 0 ? new Date(latest) : null;
  }

  isConnected(): boolean {
    // Check if websocket is connected (implementation depends on CLOB client)
    return this.subscribedTokens.size > 0;
  }
}
