// Timing constants (milliseconds)
export const TIMING = {
  // Polling intervals
  ACTIVE_POLL_INTERVAL: 1500,
  IDLE_POLL_INTERVAL: 3500,

  // Websocket reconnection
  WS_RECONNECT_BASE_DELAY: 1000,
  WS_RECONNECT_MAX_DELAY: 30000,
  WS_RECONNECT_MAX_ATTEMPTS: 10,

  // HTTP retry
  HTTP_RETRY_DELAYS: [2000, 4000, 8000, 16000],
  HTTP_TIMEOUT: 10000,

  // Order lifecycle
  ORDER_STATUS_POLL_INTERVAL: 500,
  ORDER_MAX_WAIT_TIME: 1500,

  // Book ticker staleness
  BOOK_TICKER_STALE_THRESHOLD: 3000,

  // Market cache TTL
  MARKET_CACHE_TTL: 300000, // 5 minutes
} as const;

// Default risk parameters
export const DEFAULT_RISK = {
  MAX_USDC_PER_TRADE: 25,
  MAX_USDC_PER_DAY: 250,
  MAX_OPEN_USDC_TOTAL: 500,
  MAX_OPEN_USDC_PER_MARKET: 100,

  SLIPPAGE_BPS: 50, // 0.5%
  MAX_SPREAD_BPS: 300, // 3%
  LEADER_PRICE_DEVIATION_BPS: 200, // 2%
  MIN_TOP_OF_BOOK_USDC: 50,

  MULTIPLIER: 1.0,
  FIXED_USDC: 10,
} as const;

// Polymarket constants
export const POLYMARKET = {
  CHAIN_ID: 137, // Polygon
  MIN_PRICE: 0.01,
  MAX_PRICE: 0.99,
  PRICE_DECIMALS: 4,
  SIZE_DECIMALS: 2,

  // Token IDs are condition_id with outcome suffix
  OUTCOME_YES: 'YES',
  OUTCOME_NO: 'NO',
} as const;

// Event types
export const EVENT_TYPES = {
  TRADE: 'TRADE',
  ORDER_PLACED: 'ORDER_PLACED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_FILLED: 'ORDER_FILLED',
} as const;

// SSE configuration
export const SSE = {
  HEARTBEAT_INTERVAL: 30000,
  RECONNECT_DELAY: 1000,
} as const;

// BullMQ configuration
export const QUEUE = {
  MIRROR_QUEUE_NAME: 'mirror-intents',
  MAX_ATTEMPTS: 3,
  BACKOFF_DELAY: 5000,
  BACKOFF_TYPE: 'exponential' as const,
} as const;
