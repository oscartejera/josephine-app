#!/bin/bash
# Fix restaurant data via Supabase REST API (curl)
# Generates realistic casual dining Madrid data for all 7 daily tables

SB_URL="https://qixipveebfhurbarksib.supabase.co"
SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpeGlwdmVlYmZodXJiYXJrc2liIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA4OTg5MywiZXhwIjoyMDg2NjY1ODkzfQ.12A4ocHkOX86VnVA2nRm4oxZVL6jEHYE02-rJlVj9Qg"

HEADERS=(-H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY" -H "Content-Type: application/json" -H "Prefer: return=minimal")

LOC_CENTRO="65686b5a-87f1-49b8-a443-aca9936f7a2e"
LOC_CHAMBERI="bdd43146-fabb-4f3b-af00-c22eea83ccac"
LOC_MALASANA="2f1bc293-20e3-46a0-aff7-ecd9948c4249"
LOCS="($LOC_CENTRO,$LOC_CHAMBERI,$LOC_MALASANA)"

echo "🧹 Step 1: Deleting existing daily data..."
for TABLE in pos_daily_metrics forecast_daily_metrics pos_daily_finance labour_daily cogs_daily budgets_daily cash_counts_daily; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
    "$SB_URL/rest/v1/$TABLE?location_id=in.$LOCS" \
    "${HEADERS[@]}")
  echo "  $TABLE: HTTP $HTTP_CODE"
done

echo ""
echo "✅ Step 1 complete. Now generating data..."
