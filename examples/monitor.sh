#!/bin/bash

echo "=== Recent Events ==="
curl -s http://localhost:3001/api/events?limit=5 | jq '.'
echo ""

echo "=== Mirror Intents ==="
curl -s http://localhost:3001/api/intents?limit=5 | jq '.'
echo ""

echo "=== System Health ==="
curl -s http://localhost:3001/api/health | jq '.'
echo ""
