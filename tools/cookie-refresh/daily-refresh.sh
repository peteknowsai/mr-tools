#!/bin/bash
# Daily cookie refresh for nanobanana
# Called by launchd at 3am
# Strategy: Try lightweight rotation first, fall back to Playwright extraction

LOG_DIR="$HOME/.nanobanana/logs"
mkdir -p "$LOG_DIR"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log "Starting cookie refresh"

# Try lightweight rotation first (no browser needed)
result=$(nanobanana --rotate --json 2>&1)
status=$(echo "$result" | jq -r '.status' 2>/dev/null)
refreshed=$(echo "$result" | jq -r '.refreshed' 2>/dev/null)

if [ "$status" = "rotated" ]; then
  log "Cookie rotation successful (refreshed=$refreshed)"
  exit 0
fi

log "Rotation failed ($result), trying Playwright extraction..."

# Fall back to full Playwright extraction
result=$(cookie-refresh --json 2>&1)
status=$(echo "$result" | jq -r '.status' 2>/dev/null)

if [ "$status" = "complete" ]; then
  log "Playwright extraction successful"
  exit 0
fi

error=$(echo "$result" | jq -r '.error // "unknown"' 2>/dev/null)
log "All refresh methods failed: $error"
exit 1
