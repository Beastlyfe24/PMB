import { PrismaClient } from '@prisma/client';
import { RTDSClient, RTDSMessage } from '../lib/polymarket/rtds';
import { DataApiClient, Trade } from '../lib/polymarket/data';
import { EventSource, TIMING, EVENT_TYPES } from '@polymarket-mirror/shared';
import { Queue } from 'bullmq';
import pino from 'pino';

const logger = pino({ name: 'leader-event-stream' });

interface LeaderSubscription {
  leaderId: string;
  proxyWallet: string;
  lastSeenTimestamp: number;
  pollInterval: number;
  isActive: boolean;
  pollTimeout?: NodeJS.Timeout;
}

export class LeaderEventStream {
  private subscriptions: Map<string, LeaderSubscription> = new Map();
  private rtdsClient: RTDSClient | null = null;
  private dataApiClient: DataApiClient;
  private mirrorQueue: Queue;
  private isStarted: boolean = false;

  constructor(
    private prisma: PrismaClient,
    dataApiClient: DataApiClient,
    mirrorQueue: Queue,
    rtdsWssUrl?: string
  ) {
    this.dataApiClient = dataApiClient;
    this.mirrorQueue = mirrorQueue;

    // Initialize RTDS if URL provided
    if (rtdsWssUrl) {
      this.rtdsClient = new RTDSClient(rtdsWssUrl);
    }
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    logger.info('Starting LeaderEventStream service');

    // Connect to RTDS if available
    if (this.rtdsClient) {
      try {
        await this.rtdsClient.connect();
        this.rtdsClient.onMessage((msg) => this.handleRTDSMessage(msg));
        logger.info('RTDS connected');
      } catch (error) {
        logger.warn({ error }, 'RTDS connection failed, using Data API only');
      }
    }

    // Load enabled leaders and subscribe
    await this.loadEnabledLeaders();

    this.isStarted = true;
    logger.info('LeaderEventStream service started');
  }

  private async loadEnabledLeaders(): Promise<void> {
    const leaders = await this.prisma.leader.findMany({
      where: { enabled: true },
    });

    for (const leader of leaders) {
      await this.subscribeToLeader(leader.id, leader.proxyWallet);
    }

    logger.info({ count: leaders.length }, 'Loaded enabled leaders');
  }

  async subscribeToLeader(leaderId: string, proxyWallet: string): Promise<void> {
    if (this.subscriptions.has(leaderId)) {
      logger.debug({ leaderId }, 'Already subscribed');
      return;
    }

    logger.info({ leaderId, proxyWallet }, 'Subscribing to leader');

    const subscription: LeaderSubscription = {
      leaderId,
      proxyWallet,
      lastSeenTimestamp: Date.now(),
      pollInterval: TIMING.ACTIVE_POLL_INTERVAL,
      isActive: true,
    };

    this.subscriptions.set(leaderId, subscription);

    // Subscribe to RTDS if available
    if (this.rtdsClient?.isConnected()) {
      // Note: RTDS subscription format depends on what channels are available
      // This is a placeholder - actual implementation depends on RTDS API
      this.rtdsClient.subscribe(`trades:${proxyWallet}`);
    }

    // Start polling Data API as primary/fallback
    this.startPolling(subscription);
  }

  async unsubscribeFromLeader(leaderId: string): Promise<void> {
    const subscription = this.subscriptions.get(leaderId);
    if (!subscription) {
      return;
    }

    logger.info({ leaderId }, 'Unsubscribing from leader');

    subscription.isActive = false;

    if (subscription.pollTimeout) {
      clearTimeout(subscription.pollTimeout);
    }

    if (this.rtdsClient?.isConnected()) {
      this.rtdsClient.unsubscribe(`trades:${subscription.proxyWallet}`);
    }

    this.subscriptions.delete(leaderId);
  }

  private async handleRTDSMessage(msg: RTDSMessage): Promise<void> {
    try {
      logger.debug({ eventType: msg.eventType }, 'Received RTDS message');

      // Parse RTDS message and extract trade data
      // Format depends on actual RTDS API
      if (msg.eventType === 'trade' || msg.eventType === 'fill') {
        const walletAddress = msg.data.trader_address || msg.data.wallet;

        // Find subscription by wallet
        for (const [leaderId, sub] of this.subscriptions.entries()) {
          if (sub.proxyWallet.toLowerCase() === walletAddress?.toLowerCase()) {
            await this.processTradeEvent(leaderId, msg.data, EventSource.RTDS);
            break;
          }
        }
      }
    } catch (error) {
      logger.error({ error, msg }, 'Failed to process RTDS message');
    }
  }

  private startPolling(subscription: LeaderSubscription): void {
    const poll = async () => {
      if (!subscription.isActive) {
        return;
      }

      try {
        // Fetch recent trades from Data API
        const startTime = Math.floor(subscription.lastSeenTimestamp / 1000) - 60; // 1 min overlap

        const result = await this.dataApiClient.getTradesByWallet(subscription.proxyWallet, {
          limit: 100,
          startTime,
        });

        if (result.trades.length > 0) {
          // Update to active polling
          subscription.pollInterval = TIMING.ACTIVE_POLL_INTERVAL;

          for (const trade of result.trades) {
            await this.processTradeEvent(subscription.leaderId, trade, EventSource.DATA_API);

            // Update last seen timestamp
            if (trade.timestamp > subscription.lastSeenTimestamp) {
              subscription.lastSeenTimestamp = trade.timestamp;
            }
          }
        } else {
          // No trades, slow down polling
          subscription.pollInterval = Math.min(
            subscription.pollInterval * 1.5,
            TIMING.IDLE_POLL_INTERVAL
          );
        }
      } catch (error) {
        logger.error({ error, leaderId: subscription.leaderId }, 'Polling error');

        // Exponential backoff on error
        subscription.pollInterval = Math.min(
          subscription.pollInterval * 2,
          TIMING.IDLE_POLL_INTERVAL * 2
        );
      }

      // Schedule next poll
      if (subscription.isActive) {
        subscription.pollTimeout = setTimeout(poll, subscription.pollInterval);
      }
    };

    // Start polling
    poll();
  }

  private async processTradeEvent(
    leaderId: string,
    data: any,
    source: EventSource
  ): Promise<void> {
    try {
      // Build event UID for deduplication
      const eventUid = this.buildEventUid(data, source);

      // Extract trade data
      const conditionId = data.market || data.condition_id || null;
      const tokenId = data.asset_id || data.token_id || null;
      const side = (data.side || '').toUpperCase();
      const price = parseFloat(data.price || '0');
      const size = parseFloat(data.size || '0');
      const usdcSize = price * size;
      const txHash = data.transaction_hash || data.tx_hash || null;
      const timestamp = data.timestamp || Date.now();
      const outcome = data.outcome || null;

      // Insert event (with unique constraint for dedup)
      const event = await this.prisma.leaderEvent.create({
        data: {
          leaderId,
          eventUid,
          source,
          type: EVENT_TYPES.TRADE,
          conditionId,
          tokenId,
          outcome,
          side,
          price,
          size,
          usdcSize,
          txHash,
          occurredAt: new Date(timestamp),
          seenAt: new Date(),
          rawJson: data,
        },
      });

      logger.info(
        {
          leaderId,
          eventId: event.id,
          tokenId,
          side,
          usdcSize: usdcSize.toFixed(2),
          source,
        },
        'Leader event created'
      );

      // Enqueue mirror job
      await this.mirrorQueue.add(
        'mirror-trade',
        { leaderEventId: event.id },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        }
      );

      logger.debug({ eventId: event.id }, 'Mirror job enqueued');
    } catch (error: any) {
      // Ignore duplicate key errors (already processed)
      if (error.code === 'P2002') {
        logger.debug({ eventUid: this.buildEventUid(data, source) }, 'Duplicate event ignored');
        return;
      }

      throw error;
    }
  }

  private buildEventUid(data: any, source: EventSource): string {
    // Build a unique ID from trade data
    const txHash = data.transaction_hash || data.tx_hash || '';
    const tokenId = data.asset_id || data.token_id || '';
    const side = data.side || '';
    const timestamp = data.timestamp || Date.now();
    const size = data.size || '';

    return `${source}:${txHash}:${tokenId}:${side}:${size}:${timestamp}`;
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  getLastEventTime(): Date | null {
    // Get most recent event from DB
    // This is a simplified version - in production you'd cache this
    return null;
  }

  isRTDSConnected(): boolean {
    return this.rtdsClient?.isConnected() ?? false;
  }

  stop(): void {
    logger.info('Stopping LeaderEventStream service');

    // Stop all subscriptions
    for (const subscription of this.subscriptions.values()) {
      subscription.isActive = false;
      if (subscription.pollTimeout) {
        clearTimeout(subscription.pollTimeout);
      }
    }

    // Close RTDS
    if (this.rtdsClient) {
      this.rtdsClient.close();
    }

    this.subscriptions.clear();
    this.isStarted = false;

    logger.info('LeaderEventStream service stopped');
  }
}
