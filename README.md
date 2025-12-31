# Polymarket Mirror Bot

Production-grade copy trading bot for Polymarket with real-time dashboard. Mirror trades from public leaders to your account with minimal lag using only official Polymarket APIs.

## Features

- **Leader Resolution**: Support for both wallet addresses (0x...) and usernames
- **Real-time Event Stream**: RTDS primary with Data API fallback for confirmed trades
- **Execution-grade Pricing**: Live orderbook via CLOB Market Channel WebSocket
- **Production Risk Controls**: Per-trade caps, daily limits, exposure tracking, slippage guards
- **DRY_RUN Mode**: Test the full pipeline without placing real orders
- **Live Dashboard**: Next.js UI with SSE for real-time updates
- **Full Observability**: Health monitoring, latency tracking, error reporting

## Architecture

```
┌─────────────┐
│   Next.js   │  Web Dashboard (Port 3000)
│     UI      │  - Leaders management
└──────┬──────┘  - Live feed with SSE
       │         - Positions & health
       ↓
┌─────────────┐
│   Fastify   │  API Server (Port 3001)
│     API     │  - REST endpoints
└──────┬──────┘  - SSE streaming
       │
       ↓
┌─────────────────────────────────────────┐
│           Core Services                 │
├─────────────────────────────────────────┤
│ • LeaderResolver (Gamma API)            │
│ • LeaderEventStream (RTDS + Data API)   │
│ • BookTicker (CLOB Market Channel)      │
│ • MarketCache (Gamma Markets)           │
│ • RiskEvaluator                         │
└──────┬──────────────────────────────────┘
       │
       ↓
┌─────────────┐
│   BullMQ    │  Mirror Worker
│   Worker    │  - Idempotency
└──────┬──────┘  - Risk checks
       │         - Order placement
       ↓
┌─────────────┐
│  Postgres   │  State & history
│   + Redis   │  Queue & cache
└─────────────┘
```

## Tech Stack

- **Monorepo**: pnpm workspaces
- **Backend**: Node.js + TypeScript + Fastify + Pino
- **Frontend**: Next.js 14 App Router + Tailwind CSS
- **Database**: PostgreSQL + Prisma ORM
- **Queue**: Redis + BullMQ
- **Real-time**: Server-Sent Events (SSE)

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd PMB

# Install dependencies
pnpm install

# Start infrastructure (Postgres + Redis)
docker compose up -d

# Copy environment file
cp .env.example .env

# Edit .env with your Polymarket credentials
# IMPORTANT: Set POLYMARKET_PRIVATE_KEY and POLYMARKET_FUNDER_ADDRESS
nano .env

# Run database migrations
pnpm db:migrate

# Start all services (API + Web)
pnpm dev
```

The services will be available at:
- **Web Dashboard**: http://localhost:3000
- **API Server**: http://localhost:3001
- **API Health**: http://localhost:3001/api/health

## Environment Variables

See `.env.example` for all configuration options. Key variables:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/polymarket_mirror

# Redis
REDIS_URL=redis://localhost:6379

# Safety (IMPORTANT!)
DRY_RUN=true          # Set to false for live trading
KILL_SWITCH=false     # Emergency stop

# Polymarket Credentials
POLYMARKET_PRIVATE_KEY=0x...              # Your wallet private key
POLYMARKET_FUNDER_ADDRESS=0x...           # Your wallet address
POLYMARKET_CHAIN_ID=137                   # Polygon mainnet

# Polymarket API Endpoints (defaults should work)
POLYMARKET_CLOB_HOST=https://clob.polymarket.com
POLYMARKET_GAMMA_API_BASE=https://gamma-api.polymarket.com
POLYMARKET_DATA_API_BASE=https://data-api.polymarket.com
```

## Usage

### 1. Add a Leader

Using the Web UI:
1. Navigate to http://localhost:3000/leaders
2. Click "Add Leader"
3. Enter a label and identifier (username or 0x... wallet)
4. Click "Create"

Using curl:

```bash
# Add leader by username
curl -X POST http://localhost:3001/api/leaders \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Top Trader",
    "identifier": "polymarket_pro"
  }'

# Add leader by wallet address
curl -X POST http://localhost:3001/api/leaders \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Whale Wallet",
    "identifier": "0x1234567890123456789012345678901234567890"
  }'
```

### 2. Enable Copy Trading

Using the Web UI:
1. Click the "Paused" button to toggle to "Copying"

Using curl:

```bash
# Get leader ID from the list
curl http://localhost:3001/api/leaders

# Enable copy trading
curl -X PATCH http://localhost:3001/api/leaders/<LEADER_ID> \
  -H "Content-Type: application/json" \
  -d '{
    "copyEnabled": true
  }'
```

### 3. Configure Risk Parameters

```bash
curl -X PATCH http://localhost:3001/api/leaders/<LEADER_ID> \
  -H "Content-Type: application/json" \
  -d '{
    "copyMode": "NOTIONAL",
    "multiplier": 0.5,
    "maxUsdcPerTrade": 50,
    "maxUsdcPerDay": 500,
    "maxOpenUsdcTotal": 1000,
    "slippageBps": 50,
    "maxSpreadBps": 300
  }'
```

### 4. Monitor Activity

```bash
# Get recent events
curl http://localhost:3001/api/events?limit=20

# Get mirror intents
curl http://localhost:3001/api/intents?limit=20

# Get orders
curl http://localhost:3001/api/orders?limit=20

# Check system health
curl http://localhost:3001/api/health
```

### 5. View Live Feed

The dashboard provides real-time updates via Server-Sent Events:
- Navigate to http://localhost:3000/feed
- New events appear automatically with latency metrics

## API Endpoints

### Leaders

```bash
# Create leader
POST /api/leaders
Body: { "label": string, "identifier": string }

# List leaders
GET /api/leaders

# Get leader
GET /api/leaders/:id

# Update leader
PATCH /api/leaders/:id
Body: { "copyEnabled"?: bool, "multiplier"?: number, ... }

# Delete leader
DELETE /api/leaders/:id
```

### Feed

```bash
# Get events
GET /api/events?leaderId=<ID>&limit=50&offset=0

# Get intents
GET /api/intents?leaderId=<ID>&limit=50&offset=0

# Get orders
GET /api/orders?limit=50&offset=0
```

### Health & Monitoring

```bash
# Health check
GET /api/health

# Ping
GET /api/ping

# SSE feed (for web clients)
GET /api/sse/feed
```

## Risk Parameters Explained

| Parameter | Default | Description |
|-----------|---------|-------------|
| `copyMode` | NOTIONAL | NOTIONAL (mirror leader's $ size) or FIXED (fixed $ per trade) |
| `multiplier` | 1.0 | Multiply leader's size (0.5 = half size, 2.0 = double) |
| `fixedUsdc` | 10 | Fixed USDC per trade (when copyMode=FIXED) |
| `maxUsdcPerTrade` | 25 | Maximum USDC per single trade |
| `maxUsdcPerDay` | 250 | Maximum USDC mirrored per day |
| `maxOpenUsdcTotal` | 500 | Maximum total open exposure |
| `maxOpenUsdcPerMarket` | 100 | Maximum exposure per market |
| `slippageBps` | 50 | Slippage tolerance (50 = 0.5%) |
| `maxSpreadBps` | 300 | Skip if spread > this (300 = 3%) |
| `leaderPriceDeviationBps` | 200 | Skip if our price deviates > this from leader's |
| `minTopOfBookUsdc` | 50 | Minimum liquidity at top of book |

## DRY_RUN Mode

When `DRY_RUN=true` (default):
- Full pipeline executes (event ingestion, risk checks, sizing)
- Orders are **simulated** but not placed on CLOB
- Mirror intents saved with status `SIMULATED`
- All computed values (size, price, slippage) are logged
- Perfect for testing and validation

Set `DRY_RUN=false` for live trading.

## Safety Features

1. **Idempotency**: Each leader event processed exactly once
2. **Confirmed Only**: Only mirror trades visible via RTDS/Data API (no unconfirmed)
3. **Multi-layer Risk**: Per-trade, daily, and total exposure caps
4. **Kill Switch**: `KILL_SWITCH=true` immediately stops all mirroring
5. **Stale Data Protection**: Skip trades if orderbook data is stale (>3s)
6. **Spread Protection**: Skip trades if spread exceeds threshold
7. **Price Deviation**: Skip if execution price deviates too much from leader's

## Troubleshooting

### No events appearing

1. Check leader is enabled: `curl http://localhost:3001/api/leaders`
2. Check system health: `curl http://localhost:3001/api/health`
3. Verify leader has recent trades on Polymarket
4. Check API logs for errors

### Orders not placing (DRY_RUN=false)

1. Verify `POLYMARKET_PRIVATE_KEY` is set correctly
2. Check wallet has USDC balance on Polygon
3. Verify API initialization succeeded (check logs for "CLOB client initialized with L2 auth")
4. Check order failures in database or logs

### High latency

- RTDS provides lowest latency; verify RTDS connection in health page
- Check network latency to Polymarket APIs
- Review queue backlog in health page

## Development

### Project Structure

```
PMB/
├── apps/
│   ├── api/               # Fastify backend
│   │   ├── src/
│   │   │   ├── routes/    # API endpoints
│   │   │   ├── services/  # Business logic
│   │   │   ├── workers/   # BullMQ workers
│   │   │   ├── lib/       # Polymarket clients
│   │   │   └── index.ts   # Server entry
│   │   └── prisma/
│   │       └── schema.prisma
│   └── web/               # Next.js frontend
│       └── app/           # App Router pages
├── packages/
│   └── shared/            # Shared types & constants
└── docker-compose.yml
```

### Running Tests

```bash
# TODO: Add tests
pnpm test
```

### Database Management

```bash
# Create migration
pnpm --filter api prisma migrate dev --name <migration_name>

# Reset database
pnpm --filter api prisma migrate reset

# Open Prisma Studio
pnpm db:studio
```

### Logs

Logs use Pino with pretty printing. Key log sources:
- `gamma-api`: Leader resolution
- `data-api`: Trade polling
- `rtds`: Real-time event stream
- `clob`: Order execution
- `book-ticker`: Orderbook updates
- `leader-event-stream`: Event ingestion
- `mirror-worker`: Order processing
- `risk`: Risk evaluation

## Production Deployment

1. **Set DRY_RUN=false** only after thorough testing
2. Use managed Postgres and Redis (not Docker containers)
3. Set up monitoring and alerting on health endpoints
4. Configure proper logging aggregation
5. Set conservative risk limits initially
6. Use environment-specific secrets management
7. Consider running multiple workers for redundancy

## Security

- **Never commit `.env` file**
- **Never log private keys**
- Store `POLYMARKET_PRIVATE_KEY` securely (use secrets manager in production)
- Use read-only API keys where possible
- Validate all external inputs
- Keep dependencies updated

## Performance Tips

- RTDS provides lowest latency for event detection
- BookTicker uses in-memory cache for sub-millisecond pricing
- BullMQ workers can scale horizontally
- Consider rate limiting for Gamma/Data API polling
- Monitor queue depth and adjust concurrency

## Known Limitations

1. **Execution Lag**: "Minimal lag" is best-effort; cannot guarantee identical fills
2. **No Scraping**: Only uses official APIs (trades must be confirmed)
3. **Liquidity**: May skip trades if insufficient liquidity or wide spreads
4. **RTDS Availability**: Falls back to Data API polling if RTDS unavailable

## License

MIT

## Disclaimer

This software is for educational purposes. Use at your own risk. Trading involves risk of loss. Always test in DRY_RUN mode first.
