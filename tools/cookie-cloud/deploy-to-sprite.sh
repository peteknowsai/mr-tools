#!/bin/bash
# Deploy cookie refresh script to the Fly.io Sprite
#
# Usage:
#   ./deploy-to-sprite.sh                   # Deploy refresh.js
#   ./deploy-to-sprite.sh --with-config     # Also deploy config.json template

set -euo pipefail

SPRITE_NAME="gemini-cookie-refresher"
REMOTE_DIR="/opt/cookie-refresh"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Deploying to sprite: $SPRITE_NAME"

# Copy refresh.js to sprite via exec + stdin
echo "  Copying refresh.js..."
sprite exec -s "$SPRITE_NAME" -- bash -c "cat > $REMOTE_DIR/refresh.js" < "$SCRIPT_DIR/refresh.js"

# Make executable
sprite exec -s "$SPRITE_NAME" -- chmod +x "$REMOTE_DIR/refresh.js"

# Ensure playwright-profile directory exists
sprite exec -s "$SPRITE_NAME" -- mkdir -p "$REMOTE_DIR/playwright-profile"

# Ensure log directory exists
sprite exec -s "$SPRITE_NAME" -- sudo bash -c "touch /var/log/cookie-refresh.log && chown sprite:sprite /var/log/cookie-refresh.log"

# Optionally deploy config template
if [[ "${1:-}" == "--with-config" ]]; then
  if [[ ! -f "$SCRIPT_DIR/config.json" ]]; then
    echo "  Creating config.json template..."
    cat > "$SCRIPT_DIR/config.json" << 'TMPL'
{
  "cloudflare_account_id": "YOUR_ACCOUNT_ID",
  "cloudflare_api_token": "YOUR_API_TOKEN",
  "cloudflare_kv_namespace_id": "YOUR_KV_NAMESPACE_ID"
}
TMPL
    echo "  Edit config.json with your Cloudflare credentials, then re-run."
    exit 1
  fi
  echo "  Copying config.json..."
  sprite exec -s "$SPRITE_NAME" -- bash -c "cat > $REMOTE_DIR/config.json && chmod 600 $REMOTE_DIR/config.json" < "$SCRIPT_DIR/config.json"
fi

# Verify deployment
echo "  Verifying..."
sprite exec -s "$SPRITE_NAME" -- bash -c "ls -la $REMOTE_DIR/refresh.js && node $REMOTE_DIR/refresh.js --help 2>/dev/null || echo 'refresh.js deployed (no --help flag)'"

echo "Done! Script deployed to $SPRITE_NAME:$REMOTE_DIR/refresh.js"
