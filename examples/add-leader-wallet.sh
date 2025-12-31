#!/bin/bash

# Example: Add a leader by wallet address
curl -X POST http://localhost:3001/api/leaders \
  -H "Content-Type: application/json" \
  -d '{"label":"Whale Wallet","identifier":"0x1234567890123456789012345678901234567890"}'

echo ""
