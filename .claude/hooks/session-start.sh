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
VITE_SUPABASE_PROJECT_ID="qixipveebfhurbarksib"
VITE_SUPABASE_URL="https://qixipveebfhurbarksib.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpeGlwdmVlYmZodXJiYXJrc2liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwODk4OTMsImV4cCI6MjA4NjY2NTg5M30.twpFHzJqDL-M37THYNs1oC23ZktjGTYodcSJkxHUyR8"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpeGlwdmVlYmZodXJiYXJrc2liIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA4OTg5MywiZXhwIjoyMDg2NjY1ODkzfQ.12A4ocHkOX86VnVA2nRm4oxZVL6jEHYE02-rJlVj9Qg"
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
