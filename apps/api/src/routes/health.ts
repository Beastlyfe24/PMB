import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { BookTicker } from '../services/bookTicker';
import { LeaderEventStream } from '../services/leaderEventStream';
import { HealthStatus } from '@polymarket-mirror/shared';

export async function healthRoutes(
  fastify: FastifyInstance,
  options: {
    prisma: PrismaClient;
    queue: Queue;
    bookTicker: BookTicker;
    leaderEventStream: LeaderEventStream;
    dryRun: boolean;
    killSwitch: boolean;
  }
) {
  const { prisma, queue, bookTicker, leaderEventStream, dryRun, killSwitch } = options;

  fastify.get('/health', async (request, reply) => {
    // Get queue metrics
    const queueCounts = await queue.getJobCounts();

    // Get recent events count (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentEventsCount = await prisma.leaderEvent.count({
      where: {
        seenAt: {
          gte: fiveMinutesAgo,
        },
      },
    });

    // Get last event time
    const lastEvent = await prisma.leaderEvent.findFirst({
      orderBy: { seenAt: 'desc' },
      select: { seenAt: true },
    });

    // Get failed jobs count
    const failedCount = queueCounts.failed || 0;

    const health: HealthStatus = {
      timestamp: new Date(),
      dryRun,
      killSwitch,
      websockets: {
        bookTicker: {
          connected: bookTicker.isConnected(),
          subscribedTokens: bookTicker.getSubscribedCount(),
          lastUpdate: bookTicker.getLastUpdate(),
        },
        rtds: {
          connected: leaderEventStream.isRTDSConnected(),
          subscribedLeaders: leaderEventStream.getSubscriptionCount(),
          lastEvent: leaderEventStream.getLastEventTime(),
        },
      },
      queue: {
        waiting: queueCounts.waiting || 0,
        active: queueCounts.active || 0,
        completed: queueCounts.completed || 0,
        failed: failedCount,
      },
      ingest: {
        lastEventAt: lastEvent?.seenAt || null,
        eventsLast5Min: recentEventsCount,
        errorCount: failedCount,
      },
    };

    return health;
  });

  // Simple ping endpoint
  fastify.get('/ping', async (request, reply) => {
    return { status: 'ok', timestamp: new Date() };
  });
}
