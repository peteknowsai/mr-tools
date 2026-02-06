# slack-read

Read messages from Slack channels from the command line.

## Installation

```bash
cd /Users/pete/Projects/mr-tools
bun build ./tools/slack-read/slack-read.ts --compile --outfile ./bin/slack-read
./install-tool.sh slack-read
```

## Configuration

Set your Slack bot token:

```bash
slack-read config set bot-token xoxb-your-token-here
```

Or use environment variable:

```bash
export SLACK_BOT_TOKEN=xoxb-your-token-here
```

View current configuration:

```bash
slack-read config show
```

## Required Slack Bot Scopes

Your Slack bot must have these scopes:
- `channels:history` - Read message history
- `channels:read` - List and find channels

## Usage

### Read last 10 messages (default)

```bash
slack-read "#mr-comms"
```

### Read messages from last 2 hours

```bash
slack-read "#mr-comms" --since "2h"
```

### Read last 20 messages

```bash
slack-read "#mr-comms" --limit 20
```

### Get JSON output

```bash
slack-read "#mr-comms" --json
```

### Use channel ID

```bash
slack-read "C1234567890" --limit 5
```

## Time Format

The `--since` flag supports:
- Minutes: `30m`, `45m`
- Hours: `1h`, `2h`, `12h`
- Days: `1d`, `3d`, `7d`

Examples:
```bash
slack-read "#mr-tools" --since "30m"  # Last 30 minutes
slack-read "#mr-comms" --since "2h"   # Last 2 hours
slack-read "#captain32" --since "1d"  # Last 24 hours
```

## Output Format

### Human-Readable (default)

```
📬 Messages from #mr-comms (3 found)

[10/13/2025, 7:30:45 PM] U12345:
  Build complete, ready for deployment

[10/13/2025, 7:35:22 PM] U67890:
  Thanks! Starting email draft now

[10/13/2025, 7:40:10 PM] U12345:
  Great, let me know when it's ready for review
```

### JSON Output

```bash
slack-read "#mr-comms" --json
```

Returns full Slack API response with all message metadata.

## Agent-to-Agent Communication

This tool enables different Claude Code sessions to communicate:

**Mr. Comms checking for new tasks:**
```bash
slack-read "#mr-comms" --since 1h
```

**Mr. Tools monitoring build notifications:**
```bash
slack-read "#mr-tools" --limit 5
```

## API Details

Uses Slack's APIs:
- `conversations.list` - Get channel ID from name
- `conversations.history` - Fetch message history

Authentication: Bearer token

## Configuration Storage

Token stored in: `~/.config/mr-tools/secrets.json`

```json
{
  "slack-read": {
    "bot_token": "xoxb-..."
  }
}
```

## Notes

- Messages are displayed oldest-first for better readability
- Thread messages show their thread timestamp
- Bot and user messages are both supported
- Maximum limit per request: 100 messages
