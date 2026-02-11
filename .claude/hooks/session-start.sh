#!/bin/bash
set -euo pipefail

# Only run in remote (web) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-/home/user/josephine-app}"

# --- 1. Install npm dependencies ---
cd "$PROJECT_DIR"
if [ ! -d "node_modules" ]; then
  npm install
else
  npm install
fi

# --- 2. Create .env.local if missing ---
if [ ! -f "$PROJECT_DIR/.env.local" ]; then
  cat > "$PROJECT_DIR/.env.local" << 'ENVEOF'
VITE_SUPABASE_PROJECT_ID="gbddbubzvhmgnwyowucd"
VITE_SUPABASE_URL="https://gbddbubzvhmgnwyowucd.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZGRidWJ6dmhtZ253eW93dWNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NTI1ODIsImV4cCI6MjA4NDQyODU4Mn0.VG331pWLTJ1Ma8peIA9_uvrJ2iZZ4JXwl1l6rHYne4Y"
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
