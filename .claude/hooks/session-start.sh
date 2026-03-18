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
# IMPORTANT: Set these env vars in your CI/remote environment BEFORE this runs:
#   SUPABASE_ANON_KEY         — Supabase publishable/anon key
#   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (NEVER commit this)
#   GH_TOKEN                  — GitHub personal access token (NEVER commit this)
if [ ! -f "$PROJECT_DIR/.env.local" ]; then
  cat > "$PROJECT_DIR/.env.local" << ENVEOF
VITE_SUPABASE_PROJECT_ID="qixipveebfhurbarksib"
VITE_SUPABASE_URL="https://qixipveebfhurbarksib.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="${SUPABASE_ANON_KEY:?ERROR: SUPABASE_ANON_KEY not set}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?ERROR: SUPABASE_SERVICE_ROLE_KEY not set}"
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
  if [ -z "${GH_TOKEN:-}" ]; then
    echo "WARNING: GH_TOKEN not set — gh CLI will not be authenticated."
  else
    echo "$GH_TOKEN" | gh auth login --with-token
  fi
fi
