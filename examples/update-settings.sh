#!/bin/bash

# Example: Update risk settings for a leader

if [ -z "$1" ]; then
  echo "Usage: ./update-settings.sh <LEADER_ID>"
  exit 1
fi

LEADER_ID=$1

curl -X PATCH http://localhost:3001/api/leaders/$LEADER_ID \
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

echo ""
