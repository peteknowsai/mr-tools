# slack-send

Post messages to Slack channels from the command line.

## Installation

```bash
cd /Users/pete/Projects/mr-tools
bun build ./tools/slack-send/slack-send.ts --compile --outfile ./bin/slack-send
./install-tool.sh slack-send
```

## Configuration

Set your Slack bot token:

```bash
slack-send config set bot-token xoxb-your-token-here
```

Or use environment variable:

```bash
export SLACK_BOT_TOKEN=xoxb-your-token-here
```

View current configuration:

```bash
slack-send config show
```

## Required Slack Bot Scopes

Your Slack bot must have these scopes:
- `chat:write` - Post messages
- `chat:write.public` - Post to any public channel

## Usage

### Send a message to a channel

```bash
slack-send "#mr-comms" "Hey, please send email about deployment"
slack-send "#mr-tools" "Build completed successfully"
```

### Reply in a thread

```bash
slack-send "#mr-comms" "Follow-up message" --thread "1234567890.123456"
```

### Use channel ID instead of name

```bash
slack-send "C1234567890" "Message by channel ID"
```

### Get JSON response

```bash
slack-send "#mr-comms" "Test message" --json
```

## Agent-to-Agent Communication

This tool enables different Claude Code sessions to communicate:

**Mr. Tools (you) finishing a build:**
```bash
slack-send "#mr-comms" "Build complete, ready for email announcement"
```

**Mr. Comms checking for messages:**
```bash
slack-read "#mr-comms" --since 1h
```

Pete can monitor all messages in Slack and intervene when needed.

## API Details

Uses Slack's `chat.postMessage` API:
- Endpoint: `https://slack.com/api/chat.postMessage`
- Authentication: Bearer token
- Parameters: `channel`, `text`, `thread_ts` (optional)

## Configuration Storage

Token stored in: `~/.config/mr-tools/secrets.json`

```json
{
  "slack-send": {
    "bot_token": "xoxb-..."
  }
}
```
