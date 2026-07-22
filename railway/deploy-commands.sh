#!/usr/bin/env bash
# railway/deploy-commands.sh
# Helper script to register UmaKraft slash commands via Railway Run.
#
# Usage (from repo root):
#   bash railway/deploy-commands.sh          — guild commands (instant)
#   bash railway/deploy-commands.sh --global — global commands (up to 1h)
#
# Requires: Railway CLI installed and logged in (`railway login`)

set -euo pipefail

MODE=${1:-""}

if [ "$MODE" = "--global" ]; then
  echo "Registering global slash commands (may take up to 1 hour)..."
  railway run node Distribution/Discord/deploy-commands.js --global
else
  echo "Registering guild slash commands (instant)..."
  railway run node Distribution/Discord/deploy-commands.js
fi
