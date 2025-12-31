#!/bin/bash
set -e

echo "🚀 Polymarket Mirror Bot Setup"
echo "================================"
echo ""

# Check prerequisites
echo "Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm not found. Please install pnpm 8+"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker"
    exit 1
fi

echo "✅ Prerequisites OK"
echo ""

# Copy environment file
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "✅ .env created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and set your Polymarket credentials:"
    echo "   - POLYMARKET_PRIVATE_KEY"
    echo "   - POLYMARKET_FUNDER_ADDRESS"
    echo ""
else
    echo "✅ .env already exists"
fi

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Start infrastructure
echo ""
echo "Starting Docker containers (Postgres + Redis)..."
docker compose up -d

# Wait for postgres
echo "Waiting for Postgres to be ready..."
sleep 5

# Run migrations
echo ""
echo "Running database migrations..."
pnpm --filter api prisma generate
pnpm --filter api prisma migrate dev --name init

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your POLYMARKET_PRIVATE_KEY and POLYMARKET_FUNDER_ADDRESS"
echo "2. Run: pnpm dev"
echo "3. Open: http://localhost:3000"
echo ""
echo "📖 See README.md for full documentation"
