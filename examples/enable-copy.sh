#!/bin/bash

# First, get the leader ID
echo "Getting leaders..."
curl http://localhost:3001/api/leaders
echo ""
echo ""

# Then run this with the actual leader ID
if [ -z "$1" ]; then
  echo "Usage: ./enable-copy.sh <LEADER_ID>"
  echo "Example: ./enable-copy.sh abc123..."
  exit 1
fi

LEADER_ID=$1

echo "Enabling copy for leader $LEADER_ID..."
curl -X PATCH http://localhost:3001/api/leaders/$LEADER_ID \
  -H "Content-Type: application/json" \
  -d '{"copyEnabled":true}'

echo ""
