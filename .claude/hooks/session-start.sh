#!/bin/bash
set -euo pipefail

# Only run in remote (web) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-/home/user/josephine-app}"

# --- 1. Install npm dependencies ---
cd "$PROJECT_DIR"
npm install

# --- 2. Create .env.local if missing ---
if [ ! -f "$PROJECT_DIR/.env.local" ]; then
  cat > "$PROJECT_DIR/.env.local" << 'ENVEOF'
VITE_SUPABASE_PROJECT_ID="qzrbvjklgorfoqersdpx"
VITE_SUPABASE_URL="https://qzrbvjklgorfoqersdpx.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6cmJ2amtsZ29yZm9xZXJzZHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyOTQ2MDMsImV4cCI6MjA4NTg3MDYwM30.Abt4boq0ahpq-w8sITXMmICB0VdfjasciYD97uW1pyA"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6cmJ2amtsZ29yZm9xZXJzZHB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI5NDYwMywiZXhwIjoyMDg1ODcwNjAzfQ.UgpxcrpVnrxaOlQHCcs4-5c4LABnHvFAysCbTrFLy3c"
ENVEOF
fi

# --- 3. Install gh CLI if missing ---
if ! command -v gh &> /dev/null; then
  mkdir -p /tmp/gh-install
  curl -fsSL -o /tmp/gh-install/gh.tar.gz "https://github.com/cli/cli/releases/download/v2.63.2/gh_2.63.2_linux_amd64.tar.gz"
  tar xzf /tmp/gh-install/gh.tar.gz -C /tmp/gh-install
  cp /tmp/gh-install/gh_2.63.2_linux_amd64/bin/gh /usr/local/bin/gh 2>/dev/null || sudo cp /tmp/gh-install/gh_2.63.2_linux_amd64/bin/gh /usr/local/bin/gh
  rm -rf /tmp/gh-install
fi

# --- 4. Authenticate gh CLI if not already ---
if ! gh auth status &> /dev/null; then
  echo "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" | gh auth login --with-token
fi
