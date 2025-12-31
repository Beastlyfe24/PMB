#!/bin/bash

echo "🔐 Secure Credential Setup for Polymarket Mirror Bot"
echo "====================================================="
echo ""
echo "This script will help you safely configure your API credentials."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
fi

echo "IMPORTANT SECURITY NOTES:"
echo "------------------------"
echo "1. Your private key should start with '0x' and be 66 characters total"
echo "2. Your wallet address should start with '0x' and be 42 characters total"
echo "3. NEVER share your private key with anyone"
echo "4. These credentials will be stored ONLY in your local .env file"
echo "5. The .env file will NEVER be committed to git"
echo ""

read -p "Do you want to continue? (yes/no): " CONTINUE
if [ "$CONTINUE" != "yes" ]; then
    echo "Setup cancelled."
    exit 0
fi

echo ""
echo "Please enter your Polymarket credentials:"
echo ""

# Read private key securely (without echo)
read -s -p "Enter your PRIVATE KEY (starts with 0x): " PRIVATE_KEY
echo ""

# Read wallet address
read -p "Enter your WALLET ADDRESS (starts with 0x): " WALLET_ADDRESS
echo ""

# Validate format
if [[ ! "$PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
    echo "⚠️  Warning: Private key format looks unusual"
    echo "   Expected: 0x followed by 64 hexadecimal characters"
    echo "   Got: ${#PRIVATE_KEY} characters total"
    read -p "Continue anyway? (yes/no): " FORCE
    if [ "$FORCE" != "yes" ]; then
        echo "Setup cancelled."
        exit 1
    fi
fi

if [[ ! "$WALLET_ADDRESS" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
    echo "⚠️  Warning: Wallet address format looks unusual"
    echo "   Expected: 0x followed by 40 hexadecimal characters"
    echo "   Got: ${#WALLET_ADDRESS} characters total"
    read -p "Continue anyway? (yes/no): " FORCE
    if [ "$FORCE" != "yes" ]; then
        echo "Setup cancelled."
        exit 1
    fi
fi

# Update .env file
echo ""
echo "Updating .env file..."

# Create a temporary file
TMP_FILE=$(mktemp)

# Read .env and replace credentials
while IFS= read -r line; do
    if [[ $line == POLYMARKET_PRIVATE_KEY=* ]]; then
        echo "POLYMARKET_PRIVATE_KEY=$PRIVATE_KEY" >> "$TMP_FILE"
    elif [[ $line == POLYMARKET_FUNDER_ADDRESS=* ]]; then
        echo "POLYMARKET_FUNDER_ADDRESS=$WALLET_ADDRESS" >> "$TMP_FILE"
    else
        echo "$line" >> "$TMP_FILE"
    fi
done < .env

# Replace .env with updated version
mv "$TMP_FILE" .env

# Set secure permissions (Linux/Mac)
if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "darwin"* ]]; then
    chmod 600 .env
    echo "✅ Set secure file permissions (600)"
fi

echo "✅ Credentials updated successfully!"
echo ""
echo "Your credentials are now stored in .env"
echo ""
echo "SECURITY REMINDER:"
echo "- Your .env file is protected and will NOT be committed to git"
echo "- Never share your .env file or private key"
echo "- The bot will start in DRY_RUN mode (safe testing)"
echo ""
echo "Next steps:"
echo "1. Run: docker compose up -d"
echo "2. Run: pnpm install"
echo "3. Run: pnpm --filter api prisma migrate dev --name init"
echo "4. Run: pnpm dev"
echo ""
echo "Or simply run: ./setup.sh"
