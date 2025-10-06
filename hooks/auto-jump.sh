#!/bin/bash
# auto-jump.sh - Auto-capture checkpoints with AI labels
#
# This hook runs after every Claude response (Stop hook).
# It captures a checkpoint with an AI-generated label.

# Read JSON from stdin
INPUT=$(cat)

# Parse hook data
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active')
PROJECT_DIR="$CLAUDE_PROJECT_DIR"

# Skip if stop hook already active (prevent infinite loops)
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

# Validate required inputs
if [ -z "$SESSION_ID" ] || [ -z "$TRANSCRIPT_PATH" ]; then
  exit 0
fi

# Expand tilde in transcript path
TRANSCRIPT_PATH="${TRANSCRIPT_PATH/#\~/$HOME}"

# Extract last assistant message ID from JSONL
MESSAGE_ID=$(grep '"type":"assistant"' "$TRANSCRIPT_PATH" 2>/dev/null | tail -1 | jq -r '.message.id' 2>/dev/null)

if [ -z "$MESSAGE_ID" ]; then
  exit 0
fi

# Run checkpoint-auto-capture in background to avoid blocking Claude
{
  /Users/pete/.local/bin/checkpoint-auto-capture \
    --session "$SESSION_ID" \
    --message "$MESSAGE_ID" \
    --transcript "$TRANSCRIPT_PATH" \
    --project "$PROJECT_DIR" 2>/dev/null
} &

exit 0
