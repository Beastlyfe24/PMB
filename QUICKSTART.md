# Quick Start Guide

## Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose

## Automated Setup

```bash
./setup.sh
```

This will:
1. Install dependencies
2. Start Docker containers (Postgres + Redis)
3. Create .env file
4. Run database migrations

## Manual Setup (if script fails)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Infrastructure

```bash
docker compose up -d
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:
- `POLYMARKET_PRIVATE_KEY=0x...` (your wallet private key)
- `POLYMARKET_FUNDER_ADDRESS=0x...` (your wallet address)

### 4. Database Setup

```bash
pnpm --filter api prisma generate
pnpm --filter api prisma migrate dev --name init
```

### 5. Start Services

```bash
pnpm dev
```

## Access the Application

- **Web Dashboard**: http://localhost:3000
- **API Server**: http://localhost:3001
- **Health Check**: http://localhost:3001/api/health

## First Steps

### 1. Add a Leader (Web UI)

1. Go to http://localhost:3000/leaders
2. Click "Add Leader"
3. Enter:
   - **Label**: "My First Leader"
   - **Identifier**: Enter a username (e.g., "polymarket_pro") or wallet address (0x...)
4. Click "Create"

### 2. Enable Copy Trading

1. The leader will be added with copy trading **disabled** (safe default)
2. Click the "Paused" button to change it to "Copying"
3. Monitor the Feed page for events

### 3. Add a Leader (API)

Create a file `add-leader.json`:

```json
{
  "label": "Top Trader",
  "identifier": "polymarket_pro"
}
```

Then run:

```bash
curl -X POST http://localhost:3001/api/leaders \
  -H "Content-Type: application/json" \
  -d @add-leader.json
```

### 4. Enable Copy Trading (API)

First, get the leader ID:

```bash
curl http://localhost:3001/api/leaders
```

Then enable copying (replace LEADER_ID):

```bash
curl -X PATCH http://localhost:3001/api/leaders/LEADER_ID \
  -H "Content-Type: application/json" \
  -d '{"copyEnabled":true}'
```

### 5. Monitor Activity

```bash
# View recent events
curl http://localhost:3001/api/events

# View mirror intents
curl http://localhost:3001/api/intents

# Check system health
curl http://localhost:3001/api/health
```

## Important Safety Notes

### DRY_RUN Mode (Default)

By default, `DRY_RUN=true` in your `.env` file. This means:
- ✅ Full pipeline executes
- ✅ Events are ingested
- ✅ Risk checks run
- ✅ Orders are **simulated** (not placed)
- ✅ Mirror intents show status `SIMULATED`

**Only set `DRY_RUN=false` after thorough testing!**

### Risk Parameters

Default conservative limits (per leader):
- Max per trade: $25 USDC
- Max per day: $250 USDC
- Max total open: $500 USDC
- Max per market: $100 USDC

Adjust in the Leaders page or via API.

## Troubleshooting

### Docker containers won't start

```bash
# Check if ports are in use
docker compose down
docker compose up -d
```

### Database migration fails

```bash
# Reset database
docker compose down -v
docker compose up -d
sleep 5
pnpm --filter api prisma migrate dev --name init
```

### No events appearing

1. Check leader is enabled:
   ```bash
   curl http://localhost:3001/api/leaders
   ```

2. Check system health:
   ```bash
   curl http://localhost:3001/api/health
   ```

3. Verify the leader has recent trades on Polymarket.com

### API not responding

```bash
# Check logs
docker compose logs

# Restart services
pnpm dev
```

## Development Commands

```bash
# Start development servers
pnpm dev

# Build for production
pnpm build

# Start production servers
pnpm start

# Open Prisma Studio (database GUI)
pnpm db:studio

# View database
pnpm --filter api prisma studio
```

## Next Steps

- Read the full [README.md](README.md) for complete documentation
- Explore the Web Dashboard at http://localhost:3000
- Check the API health endpoint for system status
- Review the Risk Parameters section in README.md
- Test in DRY_RUN mode before live trading

## Getting Help

If you encounter issues:

1. Check the logs in your terminal
2. Visit http://localhost:3001/api/health
3. Review the Troubleshooting section above
4. Check the full README.md for detailed information
