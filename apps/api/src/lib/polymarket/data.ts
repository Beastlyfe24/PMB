import pino from 'pino';
import { dataApiTradesResponseSchema } from '@polymarket-mirror/shared';
import { TIMING } from '@polymarket-mirror/shared';

const logger = pino({ name: 'data-api' });

export interface Trade {
  id?: string;
  assetId: string;
  side: string;
  price: string;
  size: string;
  timestamp: number;
  transactionHash?: string;
  outcome?: string;
  traderAddress?: string;
}

export class DataApiClient {
  private baseUrl: string;
  private timeout: number = TIMING.HTTP_TIMEOUT;
  private retryDelays: number[] = TIMING.HTTP_RETRY_DELAYS;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async getTradesByWallet(
    walletAddress: string,
    options: {
      limit?: number;
      cursor?: string;
      startTime?: number;
    } = {}
  ): Promise<{ trades: Trade[]; nextCursor?: string }> {
    const params = new URLSearchParams();
    params.set('address', walletAddress);

    if (options.limit) {
      params.set('limit', options.limit.toString());
    }
    if (options.cursor) {
      params.set('cursor', options.cursor);
    }
    if (options.startTime) {
      params.set('start_ts', options.startTime.toString());
    }

    const url = `${this.baseUrl}/trades?${params.toString()}`;

    logger.debug({ walletAddress, options }, 'Fetching trades by wallet');

    const data = await this.fetchWithRetry(url);
    const validated = dataApiTradesResponseSchema.parse(data);

    // Handle both array format and object format
    const tradesArray = Array.isArray(validated) ? validated : (validated.data ?? []);
    const nextCursor = Array.isArray(validated) ? undefined : validated.next_cursor;

    const trades: Trade[] = tradesArray.map(t => ({
      id: t.id,
      assetId: t.asset_id,
      side: t.side,
      price: t.price,
      size: t.size,
      timestamp: t.timestamp,
      transactionHash: t.transaction_hash,
      outcome: t.outcome,
      traderAddress: t.trader_address,
    }));

    logger.debug({ tradeCount: trades.length, nextCursor }, 'Trades fetched');

    return {
      trades,
      nextCursor,
    };
  }

  private async fetchWithRetry(url: string, attempt: number = 0): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting with exponential backoff
      if (response.status === 429 || response.status >= 500) {
        if (attempt < this.retryDelays.length) {
          const delay = this.retryDelays[attempt];
          // Add jitter (0-20% of delay)
          const jitter = Math.random() * delay * 0.2;
          const waitTime = delay + jitter;

          logger.warn(
            { status: response.status, attempt, waitTime },
            'Retrying after error'
          );

          await new Promise(resolve => setTimeout(resolve, waitTime));
          return this.fetchWithRetry(url, attempt + 1);
        }
      }

      if (!response.ok) {
        throw new Error(`Data API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < this.retryDelays.length) {
          const delay = this.retryDelays[attempt];
          logger.warn({ attempt, delay }, 'Retrying after timeout');
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.fetchWithRetry(url, attempt + 1);
        }
        throw new Error('Data API request timeout');
      }

      throw error;
    }
  }
}
