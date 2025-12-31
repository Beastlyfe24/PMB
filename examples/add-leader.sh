#!/bin/bash

# Example: Add a leader by username
curl -X POST http://localhost:3001/api/leaders \
  -H "Content-Type: application/json" \
  -d '{"label":"Top Trader","identifier":"polymarket_pro"}'

echo ""
