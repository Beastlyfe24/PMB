#!/bin/bash

echo "🔐 Polymarket Mirror Bot - Secure Setup Verification"
echo "===================================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    echo "   Run: cp .env.example .env"
    exit 1
fi
echo "✅ .env file exists"

# Check file permissions (Linux/Mac only)
if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "darwin"* ]]; then
    PERMS=$(stat -c %a .env 2>/dev/null || stat -f %A .env 2>/dev/null)
    if [ "$PERMS" = "600" ] || [ "$PERMS" = "400" ]; then
        echo "✅ .env file permissions secure ($PERMS)"
    else
        echo "⚠️  .env file permissions: $PERMS (recommended: 600)"
        echo "   Run: chmod 600 .env"
    fi
fi

# Check if .env is in .gitignore
if grep -q "^\.env$" .gitignore; then
    echo "✅ .env is in .gitignore (will not be committed)"
else
    echo "❌ .env is NOT in .gitignore (SECURITY RISK!)"
fi

# Check if credentials are set (without exposing them)
echo ""
echo "Checking credentials (without exposing values)..."

if [ -f .env ]; then
    # Source .env without printing
    export $(grep -v '^#' .env | xargs -0)

    if [ -n "$POLYMARKET_PRIVATE_KEY" ] && [ "$POLYMARKET_PRIVATE_KEY" != "0x..." ]; then
        echo "✅ POLYMARKET_PRIVATE_KEY is set"

        # Check if it looks like a valid hex key (starts with 0x, 66 chars total)
        if [[ "$POLYMARKET_PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
            echo "✅ POLYMARKET_PRIVATE_KEY format looks valid (66 characters, hex)"
        else
            echo "⚠️  POLYMARKET_PRIVATE_KEY format may be invalid"
            echo "   Expected: 0x followed by 64 hex characters"
        fi
    else
        echo "❌ POLYMARKET_PRIVATE_KEY is not set or using placeholder"
        echo "   Edit .env and add your private key"
    fi

    if [ -n "$POLYMARKET_FUNDER_ADDRESS" ] && [ "$POLYMARKET_FUNDER_ADDRESS" != "0x..." ]; then
        echo "✅ POLYMARKET_FUNDER_ADDRESS is set"

        # Check if it looks like a valid address (starts with 0x, 42 chars total)
        if [[ "$POLYMARKET_FUNDER_ADDRESS" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
            echo "✅ POLYMARKET_FUNDER_ADDRESS format looks valid (42 characters, hex)"
        else
            echo "⚠️  POLYMARKET_FUNDER_ADDRESS format may be invalid"
            echo "   Expected: 0x followed by 40 hex characters"
        fi
    else
        echo "❌ POLYMARKET_FUNDER_ADDRESS is not set or using placeholder"
        echo "   Edit .env and add your wallet address"
    fi

    # Check DRY_RUN mode
    echo ""
    if [ "$DRY_RUN" = "true" ]; then
        echo "✅ DRY_RUN mode enabled (safe testing mode)"
    else
        echo "⚠️  DRY_RUN mode disabled (LIVE TRADING MODE!)"
        echo "   Make sure you've tested thoroughly first!"
    fi

    # Check KILL_SWITCH
    if [ "$KILL_SWITCH" = "false" ]; then
        echo "✅ KILL_SWITCH is off (bot can run)"
    else
        echo "⚠️  KILL_SWITCH is enabled (bot will not place orders)"
    fi
fi

# Check Docker
echo ""
echo "Checking Docker..."
if command -v docker &> /dev/null; then
    echo "✅ Docker is installed"

    # Check if containers are running
    if docker compose ps | grep -q "Up"; then
        echo "✅ Docker containers are running"
    else
        echo "⚠️  Docker containers not running"
        echo "   Run: docker compose up -d"
    fi
else
    echo "❌ Docker is not installed"
fi

# Check Node modules
echo ""
echo "Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "✅ Dependencies installed"
else
    echo "⚠️  Dependencies not installed"
    echo "   Run: pnpm install"
fi

echo ""
echo "===================================================="
echo ""
echo "Next steps:"
echo ""
echo "1. If credentials are not set:"
echo "   nano .env"
echo "   (Add your POLYMARKET_PRIVATE_KEY and POLYMARKET_FUNDER_ADDRESS)"
echo ""
echo "2. If Docker not running:"
echo "   docker compose up -d"
echo ""
echo "3. If dependencies not installed:"
echo "   pnpm install"
echo ""
echo "4. Run database migrations:"
echo "   pnpm --filter api prisma generate"
echo "   pnpm --filter api prisma migrate dev --name init"
echo ""
echo "5. Start the bot:"
echo "   pnpm dev"
echo ""
echo "📖 For detailed security info, see: SECURITY.md"
