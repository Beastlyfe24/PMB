import { FastifyInstance, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { SSE } from '@polymarket-mirror/shared';

export async function sseRoutes(
  fastify: FastifyInstance,
  options: {
    prisma: PrismaClient;
  }
) {
  const { prisma } = options;

  fastify.get('/sse/feed', async (request, reply: FastifyReply) => {
    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial connection event
    reply.raw.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date() })}\n\n`);

    // Set up heartbeat
    const heartbeat = setInterval(() => {
      reply.raw.write(`:heartbeat\n\n`);
    }, SSE.HEARTBEAT_INTERVAL);

    // Track last seen IDs
    let lastEventId: string | null = null;
    let lastIntentId: string | null = null;
    let lastOrderId: string | null = null;

    // Poll for new data
    const pollInterval = setInterval(async () => {
      try {
        // Get new events
        const newEvents = await prisma.leaderEvent.findMany({
          where: lastEventId
            ? {
                id: { gt: lastEventId },
              }
            : undefined,
          include: {
            leader: {
              select: { id: true, label: true },
            },
          },
          orderBy: { seenAt: 'asc' },
          take: 10,
        });

        for (const event of newEvents) {
          const sseEvent = {
            type: 'leader_event',
            data: event,
            timestamp: new Date(),
          };
          reply.raw.write(`data: ${JSON.stringify(sseEvent)}\n\n`);
          lastEventId = event.id;
        }

        // Get new intents
        const newIntents = await prisma.mirrorIntent.findMany({
          where: lastIntentId
            ? {
                id: { gt: lastIntentId },
              }
            : undefined,
          include: {
            leaderEvent: {
              include: {
                leader: {
                  select: { id: true, label: true },
                },
              },
            },
            orders: true,
          },
          orderBy: { createdAt: 'asc' },
          take: 10,
        });

        for (const intent of newIntents) {
          const sseEvent = {
            type: 'mirror_intent',
            data: intent,
            timestamp: new Date(),
          };
          reply.raw.write(`data: ${JSON.stringify(sseEvent)}\n\n`);
          lastIntentId = intent.id;
        }

        // Get new orders
        const newOrders = await prisma.order.findMany({
          where: lastOrderId
            ? {
                id: { gt: lastOrderId },
              }
            : undefined,
          include: {
            fills: true,
            mirrorIntent: {
              include: {
                leaderEvent: {
                  include: {
                    leader: {
                      select: { id: true, label: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: { placedAt: 'asc' },
          take: 10,
        });

        for (const order of newOrders) {
          const sseEvent = {
            type: 'order',
            data: order,
            timestamp: new Date(),
          };
          reply.raw.write(`data: ${JSON.stringify(sseEvent)}\n\n`);
          lastOrderId = order.id;
        }
      } catch (error) {
        fastify.log.error({ error }, 'SSE poll error');
      }
    }, 1000); // Poll every second

    // Clean up on close
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      clearInterval(pollInterval);
      reply.raw.end();
    });
  });
}
