import { PrismaClient } from '@prisma/client';
import { RiskCheckResult, Leader, LeaderEvent, BookTickerData } from '@polymarket-mirror/shared';
import pino from 'pino';

const logger = pino({ name: 'risk' });

export class RiskEvaluator {
  constructor(private prisma: PrismaClient) {}

  async evaluateMirror(
    leader: Leader,
    event: LeaderEvent,
    bookTicker: BookTickerData | null,
    tokenId: string
  ): Promise<RiskCheckResult> {
    // 1. Check if copy is enabled
    if (!leader.copyEnabled) {
      return {
        passed: false,
        reason: 'Copy trading not enabled for this leader',
      };
    }

    // 2. Determine side
    const side = event.side;
    if (!side || (side !== 'BUY' && side !== 'SELL')) {
      return {
        passed: false,
        reason: 'Invalid or missing trade side',
      };
    }

    // 3. Check book ticker availability and freshness
    if (!bookTicker) {
      return {
        passed: false,
        reason: 'No book ticker data available',
      };
    }

    const staleness = Date.now() - bookTicker.lastUpdateMs;
    if (staleness > 3000) {
      return {
        passed: false,
        reason: `Book ticker stale (${staleness}ms old)`,
      };
    }

    if (bookTicker.bestBid === null || bookTicker.bestAsk === null) {
      return {
        passed: false,
        reason: 'Missing best bid or ask',
      };
    }

    // 4. Check spread
    const spreadBps = bookTicker.spreadBps ?? this.calculateSpreadBps(bookTicker.bestBid, bookTicker.bestAsk);
    if (spreadBps > leader.maxSpreadBps) {
      return {
        passed: false,
        reason: `Spread too wide: ${spreadBps} bps > ${leader.maxSpreadBps} bps`,
        computed: { spreadBps },
      };
    }

    // 5. Calculate sizing
    const usdcSize = this.calculateUsdcSize(leader, event);
    if (usdcSize <= 0) {
      return {
        passed: false,
        reason: 'Calculated USDC size is zero or negative',
      };
    }

    // 6. Check per-trade limit
    if (usdcSize > leader.maxUsdcPerTrade) {
      return {
        passed: false,
        reason: `Trade size ${usdcSize} exceeds max per trade ${leader.maxUsdcPerTrade}`,
        computed: { usdcSize },
      };
    }

    // 7. Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyCounter = await this.prisma.dailyCounter.findUnique({
      where: {
        leaderId_day: {
          leaderId: leader.id,
          day: today,
        },
      },
    });

    const dailyUsed = dailyCounter?.usdcMirrored ?? 0;
    if (dailyUsed + usdcSize > leader.maxUsdcPerDay) {
      return {
        passed: false,
        reason: `Daily limit exceeded: ${dailyUsed} + ${usdcSize} > ${leader.maxUsdcPerDay}`,
        computed: { dailyUsed, usdcSize },
      };
    }

    // 8. Check open exposure limits
    const openExposure = await this.calculateOpenExposure(leader.id);
    if (openExposure.total + usdcSize > leader.maxOpenUsdcTotal) {
      return {
        passed: false,
        reason: `Total open exposure limit exceeded: ${openExposure.total} + ${usdcSize} > ${leader.maxOpenUsdcTotal}`,
        computed: { openExposureTotal: openExposure.total, usdcSize },
      };
    }

    // Check per-market exposure
    const conditionId = event.conditionId;
    if (conditionId) {
      const marketExposure = openExposure.byMarket.get(conditionId) ?? 0;
      if (marketExposure + usdcSize > leader.maxOpenUsdcPerMarket) {
        return {
          passed: false,
          reason: `Market exposure limit exceeded: ${marketExposure} + ${usdcSize} > ${leader.maxOpenUsdcPerMarket}`,
          computed: { openExposureMarket: marketExposure, usdcSize },
        };
      }
    }

    // 9. Calculate limit price with slippage
    const limitPrice = this.calculateLimitPrice(
      side as 'BUY' | 'SELL',
      bookTicker,
      leader.slippageBps
    );

    // 10. Check leader price deviation (if leader price available)
    if (event.price !== null && event.price !== undefined) {
      const deviationBps = this.calculateDeviationBps(event.price, limitPrice);
      if (deviationBps > leader.leaderPriceDeviationBps) {
        return {
          passed: false,
          reason: `Price deviation too large: ${deviationBps} bps > ${leader.leaderPriceDeviationBps} bps`,
          computed: { deviationBps, leaderPrice: event.price, limitPrice },
        };
      }
    }

    // All checks passed
    logger.debug({ leader: leader.id, event: event.id, usdcSize, limitPrice }, 'Risk checks passed');

    return {
      passed: true,
      computed: {
        tokenId,
        side,
        usdcSize,
        limitPrice,
        bestBid: bookTicker.bestBid,
        bestAsk: bookTicker.bestAsk,
        spreadBps,
        slippageBps: leader.slippageBps,
        dailyUsed,
        openExposureTotal: openExposure.total,
      },
    };
  }

  private calculateUsdcSize(leader: Leader, event: LeaderEvent): number {
    if (leader.copyMode === 'NOTIONAL') {
      // Use leader's USDC size times multiplier
      const baseSize = event.usdcSize ?? 0;
      return baseSize * leader.multiplier;
    } else {
      // FIXED mode
      return leader.fixedUsdc * leader.multiplier;
    }
  }

  private calculateLimitPrice(
    side: 'BUY' | 'SELL',
    bookTicker: BookTickerData,
    slippageBps: number
  ): number {
    if (side === 'BUY') {
      // For buy, use best ask + slippage
      const ask = bookTicker.bestAsk!;
      return ask * (1 + slippageBps / 10000);
    } else {
      // For sell, use best bid - slippage
      const bid = bookTicker.bestBid!;
      return bid * (1 - slippageBps / 10000);
    }
  }

  private calculateSpreadBps(bid: number, ask: number): number {
    if (bid <= 0 || ask <= 0) return Infinity;
    const mid = (bid + ask) / 2;
    return ((ask - bid) / mid) * 10000;
  }

  private calculateDeviationBps(leaderPrice: number, ourPrice: number): number {
    if (leaderPrice <= 0) return Infinity;
    return Math.abs((ourPrice - leaderPrice) / leaderPrice) * 10000;
  }

  private async calculateOpenExposure(leaderId: string): Promise<{
    total: number;
    byMarket: Map<string, number>;
  }> {
    // Get all PLACED/PARTIAL mirror intents (not yet fully FILLED or CANCELLED)
    const openIntents = await this.prisma.mirrorIntent.findMany({
      where: {
        leaderEvent: {
          leaderId,
        },
        status: {
          in: ['PLACED', 'PARTIAL'],
        },
      },
      include: {
        leaderEvent: true,
      },
    });

    let total = 0;
    const byMarket = new Map<string, number>();

    for (const intent of openIntents) {
      const usdcSize = (intent.computed as any)?.usdcSize ?? 0;
      total += usdcSize;

      const conditionId = intent.leaderEvent.conditionId;
      if (conditionId) {
        byMarket.set(conditionId, (byMarket.get(conditionId) ?? 0) + usdcSize);
      }
    }

    return { total, byMarket };
  }
}
