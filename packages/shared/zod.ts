import { z } from 'zod';
import { InputType, CopyMode, EventSource, MirrorIntentStatus } from './types';

// Leader schemas
export const createLeaderSchema = z.object({
  label: z.string().min(1).max(255),
  identifier: z.string().min(1).max(255),
});

export const updateLeaderSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  enabled: z.boolean().optional(),
  copyEnabled: z.boolean().optional(),
  copyMode: z.nativeEnum(CopyMode).optional(),
  multiplier: z.number().min(0).max(100).optional(),
  fixedUsdc: z.number().min(0).max(10000).optional(),
  maxUsdcPerTrade: z.number().min(0).max(100000).optional(),
  maxUsdcPerDay: z.number().min(0).max(1000000).optional(),
  maxOpenUsdcTotal: z.number().min(0).max(1000000).optional(),
  maxOpenUsdcPerMarket: z.number().min(0).max(100000).optional(),
  slippageBps: z.number().int().min(0).max(1000).optional(),
  maxSpreadBps: z.number().int().min(0).max(2000).optional(),
  leaderPriceDeviationBps: z.number().int().min(0).max(2000).optional(),
  minTopOfBookUsdc: z.number().min(0).max(100000).optional(),
});

// Gamma API response schemas
export const gammaProfileResultSchema = z.object({
  id: z.string().optional(),
  username: z.string().optional(),
  name: z.string().optional(),
  bio: z.string().optional(),
  profilePicture: z.string().optional(),
  bannerPicture: z.string().optional(),
  website: z.string().optional(),
  twitter: z.string().optional(),
  pseudonym: z.string().optional(),
  walletAddress: z.string().optional(),
  proxyWalletAddress: z.string(),
});

export const gammaPublicSearchResponseSchema = z.object({
  profiles: z.array(gammaProfileResultSchema).optional(),
  markets: z.array(z.any()).optional(),
  events: z.array(z.any()).optional(),
});

export const gammaPublicProfileResponseSchema = gammaProfileResultSchema;

export const gammaMarketSchema = z.object({
  id: z.string().optional(),
  question: z.string(),
  conditionId: z.string(),
  slug: z.string().optional(),
  endDate: z.string().optional(),
  gameStartTime: z.string().optional(),
  description: z.string().optional(),
  outcomes: z.array(z.string()),
  outcomePrices: z.array(z.string()).optional(),
  volume: z.string().optional(),
  active: z.boolean().optional(),
  closed: z.boolean().optional(),
  archived: z.boolean().optional(),
  marketMakerAddress: z.string().optional(),
  collateralTokenAddress: z.string().optional(),
  tokens: z.array(z.object({
    tokenId: z.string(),
    outcome: z.string(),
    price: z.string().optional(),
  })).optional(),
});

// CLOB API response schemas
export const clobOrderBookSchema = z.object({
  market: z.string(),
  asset_id: z.string().optional(),
  bids: z.array(z.object({
    price: z.string(),
    size: z.string(),
  })).optional(),
  asks: z.array(z.object({
    price: z.string(),
    size: z.string(),
  })).optional(),
  timestamp: z.number().optional(),
});

export const clobMarketChannelMessageSchema = z.object({
  event_type: z.string(),
  market: z.string().optional(),
  asset_id: z.string(),
  timestamp: z.number(),
  price: z.string().optional(),
  side: z.string().optional(),
  size: z.string().optional(),
  hash: z.string().optional(),
});

export const clobUserChannelMessageSchema = z.object({
  event_type: z.string(),
  order_id: z.string().optional(),
  market: z.string().optional(),
  asset_id: z.string().optional(),
  side: z.string().optional(),
  price: z.string().optional(),
  size: z.string().optional(),
  status: z.string().optional(),
  timestamp: z.number(),
});

// Data API response schemas
export const dataApiTradeSchema = z.object({
  id: z.string().optional(),
  market: z.string().optional(),
  asset_id: z.string(),
  side: z.string(),
  price: z.string(),
  size: z.string(),
  fee_rate_bps: z.string().optional(),
  trader_address: z.string().optional(),
  timestamp: z.number(),
  transaction_hash: z.string().optional(),
  outcome: z.string().optional(),
});

export const dataApiTradesResponseSchema = z.object({
  data: z.array(dataApiTradeSchema).optional(),
  next_cursor: z.string().optional(),
});

// RTDS message schemas
export const rtdsMessageSchema = z.object({
  event_type: z.string(),
  data: z.any(),
  timestamp: z.number().optional(),
});

// Environment variable schema
export const envSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),

  DRY_RUN: z.string().transform(v => v === 'true').default('true'),
  KILL_SWITCH: z.string().transform(v => v === 'true').default('false'),

  POLYMARKET_PRIVATE_KEY: z.string().optional(),
  POLYMARKET_FUNDER_ADDRESS: z.string().optional(),
  POLYMARKET_CHAIN_ID: z.string().default('137'),

  POLYMARKET_CLOB_HOST: z.string().default('https://clob.polymarket.com'),
  POLYMARKET_GAMMA_API_BASE: z.string().default('https://gamma-api.polymarket.com'),
  POLYMARKET_DATA_API_BASE: z.string().default('https://data-api.polymarket.com'),
  POLYMARKET_RTDS_WSS: z.string().optional(),

  API_PORT: z.string().default('3001'),
  WEB_PORT: z.string().default('3000'),
});

export type Env = z.infer<typeof envSchema>;
