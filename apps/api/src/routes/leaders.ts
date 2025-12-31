import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { LeaderResolver } from '../services/leaderResolver';
import { LeaderEventStream } from '../services/leaderEventStream';
import {
  createLeaderSchema,
  updateLeaderSchema,
  InputType,
  CopyMode,
  DEFAULT_RISK,
} from '@polymarket-mirror/shared';

export async function leadersRoutes(
  fastify: FastifyInstance,
  options: {
    prisma: PrismaClient;
    leaderResolver: LeaderResolver;
    leaderEventStream: LeaderEventStream;
  }
) {
  const { prisma, leaderResolver, leaderEventStream } = options;

  // Create leader
  fastify.post('/leaders', async (request, reply) => {
    const body = createLeaderSchema.parse(request.body);

    // Resolve identifier to proxy wallet
    const resolution = await leaderResolver.resolveLeader(body.identifier);

    // Create leader in database
    const leader = await prisma.leader.create({
      data: {
        label: body.label,
        inputValue: body.identifier,
        inputType: resolution.inputType,
        proxyWallet: resolution.proxyWallet,
        enabled: true,
        copyEnabled: false,

        copyMode: CopyMode.NOTIONAL,
        multiplier: DEFAULT_RISK.MULTIPLIER,
        fixedUsdc: DEFAULT_RISK.FIXED_USDC,

        maxUsdcPerTrade: DEFAULT_RISK.MAX_USDC_PER_TRADE,
        maxUsdcPerDay: DEFAULT_RISK.MAX_USDC_PER_DAY,
        maxOpenUsdcTotal: DEFAULT_RISK.MAX_OPEN_USDC_TOTAL,
        maxOpenUsdcPerMarket: DEFAULT_RISK.MAX_OPEN_USDC_PER_MARKET,

        slippageBps: DEFAULT_RISK.SLIPPAGE_BPS,
        maxSpreadBps: DEFAULT_RISK.MAX_SPREAD_BPS,
        leaderPriceDeviationBps: DEFAULT_RISK.LEADER_PRICE_DEVIATION_BPS,
        minTopOfBookUsdc: DEFAULT_RISK.MIN_TOP_OF_BOOK_USDC,
      },
    });

    // Subscribe to leader events
    await leaderEventStream.subscribeToLeader(leader.id, leader.proxyWallet);

    return {
      ...leader,
      displayName: resolution.displayName,
    };
  });

  // Get all leaders
  fastify.get('/leaders', async (request, reply) => {
    const leaders = await prisma.leader.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return leaders;
  });

  // Get single leader
  fastify.get<{ Params: { id: string } }>('/leaders/:id', async (request, reply) => {
    const leader = await prisma.leader.findUnique({
      where: { id: request.params.id },
    });

    if (!leader) {
      return reply.status(404).send({ error: 'Leader not found' });
    }

    return leader;
  });

  // Update leader
  fastify.patch<{ Params: { id: string } }>('/leaders/:id', async (request, reply) => {
    const body = updateLeaderSchema.parse(request.body);

    const leader = await prisma.leader.update({
      where: { id: request.params.id },
      data: body,
    });

    // If enabled status changed, update subscription
    if (body.enabled !== undefined) {
      if (body.enabled) {
        await leaderEventStream.subscribeToLeader(leader.id, leader.proxyWallet);
      } else {
        await leaderEventStream.unsubscribeFromLeader(leader.id);
      }
    }

    return leader;
  });

  // Delete leader
  fastify.delete<{ Params: { id: string } }>('/leaders/:id', async (request, reply) => {
    // Unsubscribe first
    await leaderEventStream.unsubscribeFromLeader(request.params.id);

    await prisma.leader.delete({
      where: { id: request.params.id },
    });

    return { success: true };
  });
}
