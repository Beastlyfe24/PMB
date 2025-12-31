import { Worker, Job, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { RiskEvaluator } from '../lib/risk';
import { BookTicker } from '../services/bookTicker';
import { MarketCache } from '../services/marketCache';
import { PolymarketClobClient } from '../lib/polymarket/clob';
import { MirrorIntentStatus, EVENT_TYPES, QUEUE } from '@polymarket-mirror/shared';
import pino from 'pino';

const logger = pino({ name: 'mirror-worker' });

export class MirrorWorker {
  private worker: Worker | null = null;

  constructor(
    private prisma: PrismaClient,
    private queue: Queue,
    private riskEvaluator: RiskEvaluator,
    private bookTicker: BookTicker,
    private marketCache: MarketCache,
    private clobClient: PolymarketClobClient,
    private dryRun: boolean,
    private killSwitch: boolean
  ) {}

  start(): void {
    logger.info({ dryRun: this.dryRun, killSwitch: this.killSwitch }, 'Starting MirrorWorker');

    this.worker = new Worker(
      QUEUE.MIRROR_QUEUE_NAME,
      async (job: Job) => {
        return await this.processJob(job);
      },
      {
        connection: this.queue.opts.connection,
        concurrency: 5,
      }
    );

    this.worker.on('completed', (job) => {
      logger.info({ jobId: job.id }, 'Job completed');
    });

    this.worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, error: err }, 'Job failed');
    });

    logger.info('MirrorWorker started');
  }

  private async processJob(job: Job): Promise<void> {
    const { leaderEventId } = job.data;

    logger.debug({ jobId: job.id, leaderEventId }, 'Processing mirror job');

    // 1. Load leader event with leader
    const event = await this.prisma.leaderEvent.findUnique({
      where: { id: leaderEventId },
      include: { leader: true },
    });

    if (!event) {
      throw new Error(`Leader event ${leaderEventId} not found`);
    }

    if (event.type !== EVENT_TYPES.TRADE) {
      logger.debug({ eventId: event.id, type: event.type }, 'Skipping non-trade event');
      return;
    }

    // 2. Idempotency check - create mirror intent
    let intent;
    try {
      intent = await this.prisma.mirrorIntent.create({
        data: {
          leaderEventId: event.id,
          status: MirrorIntentStatus.PENDING,
          reason: null,
          computed: null,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        logger.debug({ eventId: event.id }, 'Mirror intent already exists');
        return;
      }
      throw error;
    }

    try {
      // 3. Resolve token ID
      let tokenId = event.tokenId;

      if (!tokenId && event.conditionId && event.outcome) {
        tokenId = await this.marketCache.resolveTokenId(event.conditionId, event.outcome);
      }

      if (!tokenId) {
        await this.updateIntent(intent.id, MirrorIntentStatus.SKIPPED, 'Could not resolve token ID', null);
        return;
      }

      // Subscribe to book ticker for this token
      this.bookTicker.subscribe(tokenId);

      // 4. Get book ticker data
      const ticker = this.bookTicker.getTicker(tokenId);

      // 5. Risk evaluation
      const riskCheck = await this.riskEvaluator.evaluateMirror(
        event.leader,
        event,
        ticker,
        tokenId
      );

      if (!riskCheck.passed) {
        await this.updateIntent(
          intent.id,
          MirrorIntentStatus.SKIPPED,
          riskCheck.reason || 'Risk check failed',
          riskCheck.computed
        );
        return;
      }

      // 6. Check kill switch or dry run
      if (this.killSwitch) {
        await this.updateIntent(
          intent.id,
          MirrorIntentStatus.SKIPPED,
          'Kill switch enabled',
          riskCheck.computed
        );
        return;
      }

      if (this.dryRun) {
        await this.updateIntent(
          intent.id,
          MirrorIntentStatus.SIMULATED,
          'DRY_RUN mode',
          riskCheck.computed
        );

        logger.info(
          {
            eventId: event.id,
            intentId: intent.id,
            computed: riskCheck.computed,
          },
          'SIMULATED order (DRY_RUN)'
        );

        return;
      }

      // 7. Place order
      const orderRequest = {
        tokenId: riskCheck.computed!.tokenId!,
        side: riskCheck.computed!.side! as 'BUY' | 'SELL',
        price: riskCheck.computed!.limitPrice!,
        size: riskCheck.computed!.usdcSize! / riskCheck.computed!.limitPrice!,
      };

      logger.info({ orderRequest }, 'Placing order');

      const orderResult = await this.clobClient.createMarketableOrder(orderRequest);

      // Save order
      const order = await this.prisma.order.create({
        data: {
          mirrorIntentId: intent.id,
          clobOrderId: orderResult.orderID,
          status: 'PENDING',
          placedAt: new Date(),
          rawJson: orderResult,
        },
      });

      // Update intent status
      await this.updateIntent(intent.id, MirrorIntentStatus.PLACED, null, riskCheck.computed);

      // Update daily counter
      await this.updateDailyCounter(event.leader.id, riskCheck.computed!.usdcSize!);

      logger.info(
        {
          eventId: event.id,
          intentId: intent.id,
          orderId: order.id,
          clobOrderId: orderResult.orderID,
        },
        'Order placed'
      );

      // TODO: Monitor order status and fills via User Channel or polling
    } catch (error) {
      logger.error({ error, intentId: intent.id }, 'Mirror job error');

      await this.updateIntent(
        intent.id,
        MirrorIntentStatus.FAILED,
        error instanceof Error ? error.message : 'Unknown error',
        null
      );

      throw error;
    }
  }

  private async updateIntent(
    intentId: string,
    status: MirrorIntentStatus,
    reason: string | null,
    computed: any
  ): Promise<void> {
    await this.prisma.mirrorIntent.update({
      where: { id: intentId },
      data: {
        status,
        reason,
        computed: computed ?? undefined,
        updatedAt: new Date(),
      },
    });
  }

  private async updateDailyCounter(leaderId: string, usdcMirrored: number): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.dailyCounter.upsert({
      where: {
        leaderId_day: {
          leaderId,
          day: today,
        },
      },
      update: {
        usdcMirrored: {
          increment: usdcMirrored,
        },
      },
      create: {
        leaderId,
        day: today,
        usdcMirrored,
      },
    });
  }

  stop(): void {
    logger.info('Stopping MirrorWorker');

    if (this.worker) {
      this.worker.close();
      this.worker = null;
    }

    logger.info('MirrorWorker stopped');
  }
}
