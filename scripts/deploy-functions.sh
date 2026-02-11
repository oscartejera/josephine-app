#!/bin/bash
# Deploy all Supabase Edge Functions
#
# Usage:
#   ./scripts/deploy-functions.sh <SUPABASE_ACCESS_TOKEN>
#
# Get your token at: https://supabase.com/dashboard/account/tokens

set -euo pipefail

PROJECT_REF="qzrbvjklgorfoqersdpx"

if [ -z "${1:-}" ] && [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Usage: ./scripts/deploy-functions.sh <SUPABASE_ACCESS_TOKEN>"
  echo ""
  echo "Get your token at: https://supabase.com/dashboard/account/tokens"
  exit 1
fi

export SUPABASE_ACCESS_TOKEN="${1:-$SUPABASE_ACCESS_TOKEN}"

echo "Deploying all Edge Functions to project $PROJECT_REF..."
supabase functions deploy --project-ref "$PROJECT_REF"
echo "Done! All functions deployed."
