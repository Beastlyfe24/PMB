import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export async function feedRoutes(
  fastify: FastifyInstance,
  options: {
    prisma: PrismaClient;
  }
) {
  const { prisma } = options;

  // Get leader events
  fastify.get<{
    Querystring: {
      leaderId?: string;
      limit?: string;
      offset?: string;
    };
  }>('/events', async (request, reply) => {
    const limit = parseInt(request.query.limit || '50');
    const offset = parseInt(request.query.offset || '0');

    const where: any = {};
    if (request.query.leaderId) {
      where.leaderId = request.query.leaderId;
    }

    const events = await prisma.leaderEvent.findMany({
      where,
      include: {
        leader: {
          select: {
            id: true,
            label: true,
            proxyWallet: true,
          },
        },
        mirrorIntent: {
          include: {
            orders: true,
          },
        },
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return events;
  });

  // Get mirror intents
  fastify.get<{
    Querystring: {
      leaderId?: string;
      limit?: string;
      offset?: string;
    };
  }>('/intents', async (request, reply) => {
    const limit = parseInt(request.query.limit || '50');
    const offset = parseInt(request.query.offset || '0');

    const where: any = {};
    if (request.query.leaderId) {
      where.leaderEvent = {
        leaderId: request.query.leaderId,
      };
    }

    const intents = await prisma.mirrorIntent.findMany({
      where,
      include: {
        leaderEvent: {
          include: {
            leader: {
              select: {
                id: true,
                label: true,
              },
            },
          },
        },
        orders: {
          include: {
            fills: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return intents;
  });

  // Get orders
  fastify.get<{
    Querystring: {
      limit?: string;
      offset?: string;
    };
  }>('/orders', async (request, reply) => {
    const limit = parseInt(request.query.limit || '50');
    const offset = parseInt(request.query.offset || '0');

    const orders = await prisma.order.findMany({
      include: {
        fills: true,
        mirrorIntent: {
          include: {
            leaderEvent: {
              include: {
                leader: {
                  select: {
                    id: true,
                    label: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { placedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return orders;
  });
}
