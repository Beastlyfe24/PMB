# Secure Credential Setup Guide

## What Credentials Do You Need?

The Polymarket Mirror Bot needs two pieces of information to trade on your behalf:

1. **POLYMARKET_PRIVATE_KEY** - Your wallet's private key (for signing transactions)
2. **POLYMARKET_FUNDER_ADDRESS** - Your wallet's public address

## Step-by-Step Secure Setup

### Step 1: Verify Your Environment File is Protected

First, confirm `.env` is in `.gitignore` (already done):

```bash
# This should show .env is ignored
grep "^\.env$" .gitignore
```

✅ Your `.env` file will **never** be committed to git.

### Step 2: Create Your Environment File

```bash
cp .env.example .env
```

### Step 3: Edit Safely (Choose One Method)

#### Method A: Using nano (Recommended for Beginners)

```bash
nano .env
```

Once in nano:
1. Use arrow keys to navigate to the credential lines
2. Replace the placeholder values
3. Press `Ctrl + X` to exit
4. Press `Y` to save
5. Press `Enter` to confirm

#### Method B: Using vim

```bash
vim .env
```

Once in vim:
1. Press `i` to enter insert mode
2. Navigate and edit the credentials
3. Press `Esc` to exit insert mode
4. Type `:wq` and press `Enter` to save and quit

#### Method C: Using VS Code (Most User-Friendly)

```bash
code .env
```

Or open the file in any text editor you prefer.

### Step 4: Enter Your Credentials

In the `.env` file, find these lines and update them:

```bash
# BEFORE (example values):
POLYMARKET_PRIVATE_KEY=0x...
POLYMARKET_FUNDER_ADDRESS=0x...

# AFTER (your actual values):
POLYMARKET_PRIVATE_KEY=0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
POLYMARKET_FUNDER_ADDRESS=0x1234567890123456789012345678901234567890
```

### Step 5: Verify File Permissions (Linux/Mac)

Make sure only you can read the file:

```bash
chmod 600 .env
ls -la .env
```

You should see: `-rw-------` (only owner can read/write)

### Step 6: Verify Credentials Are Loaded (Without Exposing Them)

```bash
# This will show if variables are set WITHOUT printing the actual values
node -e "require('dotenv').config(); console.log('PRIVATE_KEY set:', !!process.env.POLYMARKET_PRIVATE_KEY); console.log('FUNDER_ADDRESS set:', !!process.env.POLYMARKET_FUNDER_ADDRESS);"
```

Should output:
```
PRIVATE_KEY set: true
FUNDER_ADDRESS set: true
```

## Where to Get Your Credentials

### Getting Your Private Key

⚠️ **NEVER share your private key with anyone!**

#### From MetaMask:
1. Open MetaMask
2. Click the three dots menu
3. Select "Account Details"
4. Click "Show Private Key"
5. Enter your MetaMask password
6. Copy the private key (starts with 0x)

#### From Other Wallets:
- Most wallets have an "Export Private Key" or "Show Private Key" option
- Look in Settings > Security or Account Details

### Getting Your Wallet Address

This is your **public** address (safe to share):

#### From MetaMask:
1. Open MetaMask
2. Click on your account name at the top
3. Click the copy icon to copy your address
4. It starts with `0x` and is 42 characters long

## Security Best Practices

### ✅ DO:

1. **Keep `.env` file local only** (never commit to git)
2. **Use a dedicated wallet** for trading (not your main wallet)
3. **Start with DRY_RUN=true** to test without real trades
4. **Set conservative limits** initially
5. **Use file permissions** (`chmod 600 .env`) on Linux/Mac
6. **Backup your private key** securely (password manager, encrypted file)
7. **Revoke access** if you suspect compromise (transfer funds to new wallet)

### ❌ DON'T:

1. **Never commit `.env` to git**
2. **Never share your private key** in chat, email, or screenshots
3. **Never paste private key** in public forums or Discord
4. **Don't use your main wallet** with all your funds
5. **Don't skip testing** in DRY_RUN mode first
6. **Don't store private keys** in cloud storage unencrypted
7. **Don't screenshot your .env file**

## Testing Your Setup Safely

### 1. Start in DRY_RUN Mode (Default)

Your `.env` should have:
```bash
DRY_RUN=true
```

This simulates orders **without placing them**.

### 2. Check Logs for Private Key Exposure

Start the API and check logs:

```bash
pnpm --filter api dev 2>&1 | grep -i "0x"
```

You should NOT see your full private key in logs. Our code is designed to never log secrets.

### 3. Verify CLOB Authentication

Start the API and watch for this log message:

```bash
pnpm --filter api dev
```

Look for:
```
CLOB client initialized with L2 auth
```

If you see this, your credentials are working!

### 4. Test the Health Endpoint

```bash
curl http://localhost:3001/api/health
```

This will show system status without exposing any secrets.

## Example .env File (Safely Redacted)

Here's what your `.env` should look like (with your actual values):

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/polymarket_mirror

# Redis
REDIS_URL=redis://localhost:6379

# Safety Controls (KEEP THESE FOR TESTING!)
DRY_RUN=true
KILL_SWITCH=false

# Polymarket Credentials (REPLACE WITH YOUR VALUES)
POLYMARKET_PRIVATE_KEY=0x1234...your-64-character-hex-key...7890
POLYMARKET_FUNDER_ADDRESS=0xabcd...your-42-character-address...ef01

# Polymarket Configuration (DEFAULTS ARE FINE)
POLYMARKET_CHAIN_ID=137
POLYMARKET_CLOB_HOST=https://clob.polymarket.com
POLYMARKET_GAMMA_API_BASE=https://gamma-api.polymarket.com
POLYMARKET_DATA_API_BASE=https://data-api.polymarket.com

# Server Ports (DEFAULTS ARE FINE)
API_PORT=3001
WEB_PORT=3000
```

## Verification Checklist

Before starting the bot, verify:

- [ ] `.env` file exists and has your credentials
- [ ] `.env` is in `.gitignore` (already done)
- [ ] File permissions are `600` or similar (Linux/Mac)
- [ ] `DRY_RUN=true` for initial testing
- [ ] Your wallet has some USDC on Polygon for testing
- [ ] You're using a dedicated wallet (not your main one)
- [ ] You've tested with `./examples/monitor.sh` to verify API works

## What If My Private Key Is Compromised?

If you suspect your private key has been exposed:

1. **Immediately transfer all funds** from that wallet to a new wallet
2. **Stop the bot** (`Ctrl+C` in terminal)
3. **Generate a new wallet** with a new private key
4. **Update `.env`** with the new credentials
5. **Never use the compromised key again**

## Using a Hardware Wallet (Advanced)

For maximum security, you can use a hardware wallet (Ledger, Trezor):

1. The bot would need to support hardware wallet signing (not currently implemented)
2. This would require extending the CLOB client to use hardware wallet provider
3. This is a future enhancement for production deployments

## Questions?

### "Can I use the same wallet I use on Polymarket.com?"

Yes, but it's **recommended to use a separate wallet** with limited funds for the bot.

### "How much USDC should I fund the wallet with?"

Start with a small amount for testing:
- DRY_RUN mode: $0 (no trades placed)
- Live testing: $100-500 USDC to test with conservative limits

### "Will the bot drain my wallet?"

No! The risk limits (`maxUsdcPerTrade`, `maxUsdcPerDay`, etc.) protect you. Set conservative limits initially.

### "Can I change my private key later?"

Yes, just update the `.env` file and restart the bot.

## Ready to Start?

Once your credentials are safely configured:

```bash
# Verify setup
./examples/monitor.sh

# Start the bot
pnpm dev

# Open dashboard
# http://localhost:3000
```

Remember: **Start with DRY_RUN=true** and test thoroughly before live trading!
