// Core enums
export enum InputType {
  WALLET = 'WALLET',
  USERNAME = 'USERNAME',
}

export enum EventSource {
  RTDS = 'RTDS',
  DATA_API = 'DATA_API',
}

export enum CopyMode {
  NOTIONAL = 'NOTIONAL',
  FIXED = 'FIXED',
}

export enum MirrorIntentStatus {
  PENDING = 'PENDING',
  SKIPPED = 'SKIPPED',
  SIMULATED = 'SIMULATED',
  PLACED = 'PLACED',
  FILLED = 'FILLED',
  PARTIAL = 'PARTIAL',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

// Leader types
export interface Leader {
  id: string;
  label: string;
  inputValue: string;
  inputType: InputType;
  proxyWallet: string;
  enabled: boolean;
  copyEnabled: boolean;

  // Sizing
  copyMode: CopyMode;
  multiplier: number;
  fixedUsdc: number;

  // Risk limits
  maxUsdcPerTrade: number;
  maxUsdcPerDay: number;
  maxOpenUsdcTotal: number;
  maxOpenUsdcPerMarket: number;

  // Execution parameters
  slippageBps: number;
  maxSpreadBps: number;
  leaderPriceDeviationBps: number;
  minTopOfBookUsdc: number;

  createdAt: Date;
  updatedAt: Date;
}

// Leader event types
export interface LeaderEvent {
  id: string;
  leaderId: string;
  eventUid: string;
  source: EventSource;
  type: string;
  conditionId: string | null;
  tokenId: string | null;
  outcome: string | null;
  side: string | null;
  price: number | null;
  size: number | null;
  usdcSize: number | null;
  txHash: string | null;
  occurredAt: Date;
  seenAt: Date;
  rawJson: any;
}

// Mirror intent types
export interface MirrorIntent {
  id: string;
  leaderEventId: string;
  status: MirrorIntentStatus;
  reason: string | null;
  computed: any;
  createdAt: Date;
  updatedAt: Date;
}

// Order types
export interface Order {
  id: string;
  mirrorIntentId: string;
  clobOrderId: string | null;
  status: string;
  placedAt: Date | null;
  rawJson: any;
  updatedAt: Date;
}

// Fill types
export interface Fill {
  id: string;
  orderId: string;
  fillJson: any;
  filledAt: Date;
}

// Market cache types
export interface MarketCache {
  conditionId: string;
  marketJson: any;
  updatedAt: Date;
}

// Daily counter types
export interface DailyCounter {
  leaderId: string;
  day: Date;
  usdcMirrored: number;
}

// Resolution result
export interface LeaderResolution {
  proxyWallet: string;
  displayName: string | null;
  inputType: InputType;
}

// Book ticker data
export interface BookTickerData {
  tokenId: string;
  bestBid: number | null;
  bestAsk: number | null;
  spreadBps: number | null;
  lastUpdateMs: number;
}

// Risk check result
export interface RiskCheckResult {
  passed: boolean;
  reason?: string;
  computed?: {
    tokenId?: string;
    side?: string;
    usdcSize?: number;
    limitPrice?: number;
    bestBid?: number;
    bestAsk?: number;
    spreadBps?: number;
    slippageBps?: number;
    dailyUsed?: number;
    openExposureTotal?: number;
    openExposureMarket?: number;
  };
}

// API request/response types
export interface CreateLeaderRequest {
  label: string;
  identifier: string;
}

export interface UpdateLeaderRequest {
  label?: string;
  enabled?: boolean;
  copyEnabled?: boolean;
  copyMode?: CopyMode;
  multiplier?: number;
  fixedUsdc?: number;
  maxUsdcPerTrade?: number;
  maxUsdcPerDay?: number;
  maxOpenUsdcTotal?: number;
  maxOpenUsdcPerMarket?: number;
  slippageBps?: number;
  maxSpreadBps?: number;
  leaderPriceDeviationBps?: number;
  minTopOfBookUsdc?: number;
}

export interface HealthStatus {
  timestamp: Date;
  dryRun: boolean;
  killSwitch: boolean;
  websockets: {
    bookTicker: {
      connected: boolean;
      subscribedTokens: number;
      lastUpdate: Date | null;
    };
    rtds: {
      connected: boolean;
      subscribedLeaders: number;
      lastEvent: Date | null;
    };
  };
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  ingest: {
    lastEventAt: Date | null;
    eventsLast5Min: number;
    errorCount: number;
  };
}

// SSE event types
export interface SSEEvent {
  type: 'leader_event' | 'mirror_intent' | 'order' | 'fill';
  data: LeaderEvent | MirrorIntent | Order | Fill;
  timestamp: Date;
}
