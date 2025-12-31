# Simple Credential Setup (Copy & Paste)

## Method 1: Interactive Script (Easiest)

```bash
./setup-credentials.sh
```

Just run this and follow the prompts. It will ask for your private key and wallet address.

---

## Method 2: Manual Copy-Paste

### Step 1: Open the .env file

Pick ONE of these commands based on what you have:

```bash
# If you have nano (recommended)
nano .env

# OR if you have vim
vim .env

# OR if you have VS Code
code .env

# OR any text editor
open .env
```

### Step 2: Find These Two Lines

Look for:
```
POLYMARKET_PRIVATE_KEY=0x...
POLYMARKET_FUNDER_ADDRESS=0x...
```

### Step 3: Replace With Your Values

Change them to:
```
POLYMARKET_PRIVATE_KEY=0xYOUR_ACTUAL_64_CHARACTER_PRIVATE_KEY_HERE
POLYMARKET_FUNDER_ADDRESS=0xYOUR_ACTUAL_42_CHARACTER_WALLET_ADDRESS_HERE
```

### Step 4: Save

**In nano:**
- Press `Ctrl+O` then `Enter` to save
- Press `Ctrl+X` to exit

**In vim:**
- Press `Esc`
- Type `:wq` and press `Enter`

**In other editors:**
- Click File > Save or press `Ctrl+S` / `Cmd+S`

---

## Where to Get Your Credentials

### Your Private Key (64 hex characters after 0x)

**MetaMask:**
1. Open MetaMask browser extension
2. Click the three dots (⋮) in the top right
3. Click "Account Details"
4. Click "Show Private Key"
5. Enter your password
6. Click to reveal and copy
7. It looks like: `0xabcd1234...` (66 characters total)

### Your Wallet Address (42 characters after 0x)

**MetaMask:**
1. Open MetaMask
2. Your address is shown at the top
3. Click it to copy
4. It looks like: `0x1234...` (42 characters total)

---

## Verify It Worked

Run this:

```bash
./verify-setup.sh
```

You should see:
```
✅ POLYMARKET_PRIVATE_KEY is set
✅ POLYMARKET_FUNDER_ADDRESS is set
```

---

## Still Having Trouble?

Tell me EXACTLY what error message you're seeing or what step isn't working, and I'll help you fix it.

Common issues:

1. **"nano: command not found"**
   - Try: `vim .env` or `code .env` instead

2. **"Permission denied"**
   - Try: `chmod +x setup-credentials.sh`

3. **"Can't find private key in MetaMask"**
   - Make sure you're logged into MetaMask
   - Try Account Details > Show Private Key

4. **"Invalid format"**
   - Private key must be exactly 66 characters (including 0x)
   - Wallet address must be exactly 42 characters (including 0x)
