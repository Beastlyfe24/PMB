import pino from 'pino';
import {
  gammaPublicSearchResponseSchema,
  gammaPublicProfileResponseSchema,
  gammaMarketSchema,
} from '@polymarket-mirror/shared';

const logger = pino({ name: 'gamma-api' });

export class GammaApiClient {
  private baseUrl: string;
  private timeout: number = 10000;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async publicSearch(query: string): Promise<{
    profiles?: Array<{
      proxyWalletAddress: string;
      username?: string;
      pseudonym?: string;
      name?: string;
    }>;
  }> {
    const url = `${this.baseUrl}/public-search?query=${encodeURIComponent(query)}`;

    logger.debug({ query, url }, 'Searching for profile');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Gamma API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const validated = gammaPublicSearchResponseSchema.parse(data);

      logger.debug({ profileCount: validated.profiles?.length ?? 0 }, 'Search completed');

      return validated;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Gamma API request timeout');
      }
      throw error;
    }
  }

  async publicProfile(walletAddress: string): Promise<{
    proxyWalletAddress: string;
    username?: string;
    pseudonym?: string;
    name?: string;
  }> {
    const url = `${this.baseUrl}/public-profile?wallet=${encodeURIComponent(walletAddress)}`;

    logger.debug({ walletAddress, url }, 'Fetching profile');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Gamma API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const validated = gammaPublicProfileResponseSchema.parse(data);

      logger.debug({ proxyWallet: validated.proxyWalletAddress }, 'Profile fetched');

      return validated;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Gamma API request timeout');
      }
      throw error;
    }
  }

  async getMarket(conditionId: string): Promise<any> {
    const url = `${this.baseUrl}/markets?condition_id=${encodeURIComponent(conditionId)}`;

    logger.debug({ conditionId, url }, 'Fetching market');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Gamma API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Response is array of markets, take first one
      const markets = Array.isArray(data) ? data : [data];
      if (markets.length === 0) {
        throw new Error(`No market found for condition ${conditionId}`);
      }

      const validated = gammaMarketSchema.parse(markets[0]);

      logger.debug({ conditionId, question: validated.question }, 'Market fetched');

      return validated;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Gamma API request timeout');
      }
      throw error;
    }
  }
}
