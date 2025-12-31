import dotenv from 'dotenv';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';
import { envSchema, QUEUE } from '@polymarket-mirror/shared';

// Import clients and services
import { GammaApiClient } from './lib/polymarket/gamma';
import { DataApiClient } from './lib/polymarket/data';
import { PolymarketClobClient } from './lib/polymarket/clob';
import { RiskEvaluator } from './lib/risk';
import { LeaderResolver } from './services/leaderResolver';
import { MarketCache } from './services/marketCache';
import { BookTicker } from './services/bookTicker';
import { LeaderEventStream } from './services/leaderEventStream';
import { MirrorWorker } from './workers/mirrorWorker';

// Import routes
import { leadersRoutes } from './routes/leaders';
import { feedRoutes } from './routes/feed';
import { healthRoutes } from './routes/health';
import { sseRoutes } from './routes/sse';

// Load environment variables
dotenv.config();

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

async function main() {
  // Validate and parse environment
  const env = envSchema.parse(process.env);

  logger.info(
    {
      dryRun: env.DRY_RUN,
      killSwitch: env.KILL_SWITCH,
      chainId: env.POLYMARKET_CHAIN_ID,
    },
    'Starting Polymarket Mirror Bot API'
  );

  // Initialize database
  const prisma = new PrismaClient({
    log: [
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' },
    ],
  });

  prisma.$on('warn', (e) => logger.warn(e));
  prisma.$on('error', (e) => logger.error(e));

  await prisma.$connect();
  logger.info('Database connected');

  // Initialize Redis
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  await redis.ping();
  logger.info('Redis connected');

  // Initialize BullMQ queue
  const mirrorQueue = new Queue(QUEUE.MIRROR_QUEUE_NAME, {
    connection: redis,
  });

  logger.info('BullMQ queue initialized');

  // Initialize Polymarket clients
  const gammaApi = new GammaApiClient(env.POLYMARKET_GAMMA_API_BASE);
  const dataApi = new DataApiClient(env.POLYMARKET_DATA_API_BASE);

  const clobClient = new PolymarketClobClient({
    host: env.POLYMARKET_CLOB_HOST,
    chainId: parseInt(env.POLYMARKET_CHAIN_ID),
    privateKey: env.POLYMARKET_PRIVATE_KEY,
    funderAddress: env.POLYMARKET_FUNDER_ADDRESS,
  });

  if (env.POLYMARKET_PRIVATE_KEY) {
    await clobClient.initialize();
    logger.info('CLOB client initialized with L2 auth');
  } else {
    logger.warn('No private key provided, trading disabled');
  }

  // Initialize services
  const leaderResolver = new LeaderResolver(gammaApi);
  const marketCache = new MarketCache(prisma, gammaApi);
  const riskEvaluator = new RiskEvaluator(prisma);

  const bookTicker = new BookTicker(clobClient);
  await bookTicker.start();
  logger.info('BookTicker started');

  const leaderEventStream = new LeaderEventStream(
    prisma,
    dataApi,
    mirrorQueue,
    env.POLYMARKET_RTDS_WSS
  );
  await leaderEventStream.start();
  logger.info('LeaderEventStream started');

  // Initialize worker
  const mirrorWorker = new MirrorWorker(
    prisma,
    mirrorQueue,
    riskEvaluator,
    bookTicker,
    marketCache,
    clobClient,
    env.DRY_RUN,
    env.KILL_SWITCH
  );
  mirrorWorker.start();
  logger.info('MirrorWorker started');

  // Initialize Fastify
  const fastify = Fastify({
    logger,
  });

  // Register routes
  await fastify.register(leadersRoutes, {
    prefix: '/api',
    prisma,
    leaderResolver,
    leaderEventStream,
  });

  await fastify.register(feedRoutes, {
    prefix: '/api',
    prisma,
  });

  await fastify.register(healthRoutes, {
    prefix: '/api',
    prisma,
    queue: mirrorQueue,
    bookTicker,
    leaderEventStream,
    dryRun: env.DRY_RUN,
    killSwitch: env.KILL_SWITCH,
  });

  await fastify.register(sseRoutes, {
    prefix: '/api',
    prisma,
  });

  // Start server
  const port = parseInt(env.API_PORT);
  await fastify.listen({ port, host: '0.0.0.0' });

  logger.info({ port }, 'API server listening');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');

    mirrorWorker.stop();
    leaderEventStream.stop();
    clobClient.close();

    await fastify.close();
    await prisma.$disconnect();
    await redis.quit();

    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
