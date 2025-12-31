import { PrismaClient } from '@prisma/client';
import { GammaApiClient } from '../lib/polymarket/gamma';
import { TIMING } from '@polymarket-mirror/shared';
import pino from 'pino';

const logger = pino({ name: 'market-cache' });

export class MarketCache {
  constructor(
    private prisma: PrismaClient,
    private gammaApi: GammaApiClient
  ) {}

  async getMarket(conditionId: string): Promise<any> {
    // Check cache first
    const cached = await this.prisma.marketCache.findUnique({
      where: { conditionId },
    });

    if (cached) {
      const age = Date.now() - cached.updatedAt.getTime();
      if (age < TIMING.MARKET_CACHE_TTL) {
        logger.debug({ conditionId, age }, 'Using cached market');
        return cached.marketJson;
      }
    }

    // Fetch from API
    logger.debug({ conditionId }, 'Fetching market from API');
    const market = await this.gammaApi.getMarket(conditionId);

    // Update cache
    await this.prisma.marketCache.upsert({
      where: { conditionId },
      update: {
        marketJson: market,
        updatedAt: new Date(),
      },
      create: {
        conditionId,
        marketJson: market,
      },
    });

    return market;
  }

  async resolveTokenId(conditionId: string, outcome: string): Promise<string | null> {
    const market = await this.getMarket(conditionId);

    if (!market.tokens || !Array.isArray(market.tokens)) {
      logger.warn({ conditionId }, 'Market has no tokens array');
      return null;
    }

    const outcomeNormalized = outcome.toUpperCase();

    for (const token of market.tokens) {
      if (token.outcome && token.outcome.toUpperCase() === outcomeNormalized) {
        logger.debug({ conditionId, outcome, tokenId: token.tokenId }, 'Resolved token ID');
        return token.tokenId;
      }
    }

    logger.warn({ conditionId, outcome, tokens: market.tokens }, 'No matching token found');
    return null;
  }
}
