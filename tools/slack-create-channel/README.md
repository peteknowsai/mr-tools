# slack-create-channel

CLI tool to programmatically create Slack channels for agent observability.

## Purpose

Dynamically create dedicated Slack channels when new users/agents are initialized, enabling isolated observability per user.

## Installation

```bash
# From mr-tools root
bun build ./tools/slack-create-channel/slack-create-channel.ts --compile --outfile ./bin/slack-create-channel
./install-tool.sh slack-create-channel
```

## Configuration

**Required Slack permissions:**
- `channels:manage` - Create and manage channels

**Add permission to your Slack app:**
1. Go to https://api.slack.com/apps
2. Select your app (Captain32 Agent Observer)
3. OAuth & Permissions → Bot Token Scopes
4. Add: `channels:manage`
5. Reinstall app to workspace

**Configure bot token:**
```bash
slack-create-channel config set bot-token "xoxb-..."
```

## Usage

```bash
# Create public channel
slack-create-channel "captain-pete-mccarthy"

# Create with description
slack-create-channel "captain-john-doe" --description "Captain's Advisor for John Doe"

# Create private channel
slack-create-channel "advisor-test-user" --private

# Get JSON output (for parsing channel ID)
slack-create-channel "captain-user123" --json
```

## Output

**Success:**
```
✓ Channel created: #captain-pete-mccarthy
  ID: C07ABCD1234
  Purpose: Captain's Advisor for Pete McCarthy
  Type: Public
```

**Error (channel exists):**
```
Error: Channel #captain-pete-mccarthy already exists
```

**Error (invalid name):**
```
Error: Channel name must be lowercase letters, numbers, hyphens, or underscores only
```

## Channel Naming Rules

- Lowercase only
- No spaces (use hyphens or underscores)
- Max 80 characters
- Pattern: `^[a-z0-9-_]+$`

**Valid examples:**
- `captain-pete-mccarthy`
- `advisor-user_123`
- `captain32-test`

**Invalid examples:**
- `Captain-Pete` (uppercase)
- `captain pete` (space)
- `captain@pete` (special char)

## Integration with Agent Initialization

**Pattern 1: Create channel during user setup**
```typescript
// When new user is created
const userId = user.id.replace(/_/g, '-');
const channelName = `captain-${userId}`;

const result = await $`slack-create-channel "${channelName}" --description "Captain's Advisor for ${user.name}" --json`;
const data = JSON.parse(result.stdout);

// Store channel ID in user metadata
user.metadata.slackChannel = data.channel.id;
user.metadata.slackChannelName = data.channel.name;

await saveUser(user);
```

**Pattern 2: Create on first agent run**
```typescript
// Agent initialization
const channelName = `captain-${userId.replace(/_/g, '-')}`;

try {
  const result = await $`slack-create-channel "${channelName}" --json`;
  const data = JSON.parse(result.stdout);
  sessionMetadata.slackChannel = `#${data.channel.name}`;
} catch (error) {
  if (error.message.includes("already exists")) {
    // Channel exists, use it
    sessionMetadata.slackChannel = `#${channelName}`;
  } else {
    throw error;
  }
}

// Log all activity to this channel
await $`slack-send ${sessionMetadata.slackChannel} "🚀 Agent initialized"`;
```

**Pattern 3: Idempotent creation helper**
```typescript
async function ensureUserSlackChannel(userId: string): Promise<string> {
  const channelName = `captain-${userId.replace(/[^a-z0-9-_]/g, '-')}`;

  try {
    const result = await $`slack-create-channel "${channelName}" --json`;
    const data = JSON.parse(result.stdout);
    return `#${data.channel.name}`;
  } catch (error) {
    if (error.message.includes("already exists")) {
      return `#${channelName}`;
    }
    throw error;
  }
}

// Usage
const channel = await ensureUserSlackChannel(user.id);
await $`slack-send "${channel}" "Agent activity..."`;
```

## Use Cases

**Captain32 Multi-User Observability:**
```typescript
// User 1: Pete McCarthy
const ch1 = await ensureUserSlackChannel("pete_mccarthy");
// Creates: #captain-pete-mccarthy

// User 2: John Doe
const ch2 = await ensureUserSlackChannel("john_doe");
// Creates: #captain-john-doe

// Each user's agent logs to their own channel
await $`slack-send "${ch1}" "🔧 Pete's agent: Day 2 card generation"`;
await $`slack-send "${ch2}" "🔧 John's agent: Day 1 onboarding"`;
```

**Monitoring:**
- Pete monitors all channels in one workspace
- Each channel shows one user's agent activity
- Archive channels when users churn
- Search across all channels for patterns

## API Response

```json
{
  "ok": true,
  "channel": {
    "id": "C07ABCD1234",
    "name": "captain-pete-mccarthy",
    "is_channel": true,
    "is_private": false,
    "created": 1761073600,
    "creator": "U09MB8LKV0F"
  }
}
```

## Error Handling

```typescript
try {
  await $`slack-create-channel "${channelName}"`;
} catch (error) {
  if (error.message.includes("already exists")) {
    console.log("Channel exists, continuing...");
  } else if (error.message.includes("lowercase")) {
    console.error("Invalid channel name format");
  } else if (error.message.includes("not configured")) {
    console.error("Slack bot token not set");
  } else {
    throw error;
  }
}
```
