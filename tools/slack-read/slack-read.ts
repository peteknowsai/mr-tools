#!/usr/bin/env bun
import { getSecret, setSecret } from "../../lib/config";

const BASE_URL = "https://slack.com/api";

function getBotToken(): string | undefined {
  return getSecret({ tool: "slack-read", key: "bot_token", env: ["SLACK_BOT_TOKEN"] });
}

function printHelp() {
  console.log(`Slack Read CLI - Read messages from Slack channels

Usage:
  slack-read config set bot-token <token>
  slack-read config show

  slack-read "<channel>" [options]

Examples:
  slack-read "#mr-comms"                    # last 10 messages
  slack-read "#mr-comms" --since "2h"       # messages from last 2 hours
  slack-read "#mr-comms" --limit 20         # last 20 messages
  slack-read "#mr-comms" --json             # JSON output
  slack-read "C1234567890" --limit 5        # by channel ID

Options:
  --since <time>   Time range (e.g., "2h", "30m", "1d", "3d")
  --limit <n>      Number of messages (default: 10, max: 100)
  --json           Output raw JSON response

Notes:
- Channel can be name (#channel) or ID (C1234567890)
- Bot token must have channels:history and channels:read scopes
- Time format: 30m (minutes), 2h (hours), 1d (days)
- Set token with: slack-read config set bot-token xoxb-...
`);
}

type CLIArgs = {
  command?: string;
  args: string[];
  json?: boolean;
  since?: string;
  limit?: number;
};

function parseArgs(argv: string[]): CLIArgs {
  const out: CLIArgs = { args: [], json: false, limit: 10 };
  if (!argv.length) return out;
  out.command = argv[0];
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--since") out.since = argv[++i];
    else if (a === "--limit") out.limit = parseInt(argv[++i], 10);
    else out.args.push(a);
  }
  return out;
}

function parseTimeToSeconds(timeStr: string): number {
  const match = timeStr.match(/^(\d+)([mhd])$/);
  if (!match) {
    throw new Error(`Invalid time format: ${timeStr}. Use format like "30m", "2h", or "1d"`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "m": return value * 60;
    case "h": return value * 60 * 60;
    case "d": return value * 60 * 60 * 24;
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
}

async function getChannelId(channelName: string, token: string): Promise<string> {
  // If it's already an ID (starts with C), return it
  if (channelName.startsWith("C")) {
    return channelName;
  }

  // Remove # if present
  const name = channelName.startsWith("#") ? channelName.slice(1) : channelName;

  const res = await fetch(`${BASE_URL}/conversations.list?limit=1000`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(data.error || res.statusText || "Failed to list channels");
  }

  const channel = data.channels?.find((c: any) => c.name === name);
  if (!channel) {
    throw new Error(`Channel not found: ${channelName}`);
  }

  return channel.id;
}

async function getMessages(
  channel: string,
  since?: string,
  limit?: number,
  outputJson?: boolean
) {
  const token = getBotToken();
  if (!token) {
    throw new Error("Missing Slack bot token. Set SLACK_BOT_TOKEN or run: slack-read config set bot-token <token>");
  }

  // Get channel ID if needed
  const channelId = await getChannelId(channel, token);

  // Build query params
  const params = new URLSearchParams({
    channel: channelId,
    limit: (limit || 10).toString(),
  });

  // Add oldest timestamp if --since provided
  if (since) {
    const seconds = parseTimeToSeconds(since);
    const oldest = Math.floor(Date.now() / 1000) - seconds;
    params.append("oldest", oldest.toString());
  }

  const res = await fetch(`${BASE_URL}/conversations.history?${params}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(data.error || res.statusText || "Failed to fetch messages");
  }

  if (outputJson) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Human-readable output
  if (!data.messages || data.messages.length === 0) {
    console.log(`No messages found in ${channel}`);
    return;
  }

  console.log(`\n📬 Messages from ${channel} (${data.messages.length} found)\n`);

  // Reverse to show oldest first
  const messages = [...data.messages].reverse();

  for (const msg of messages) {
    const ts = msg.ts ? new Date(parseFloat(msg.ts) * 1000).toISOString() : "unknown";
    const user = msg.user || msg.bot_id || "unknown";
    const text = msg.text || "[no text]";

    // Format timestamp nicely
    const date = new Date(parseFloat(msg.ts) * 1000);
    const timeStr = date.toLocaleString();

    console.log(`[${timeStr}] ${user}:`);
    console.log(`  ${text}`);

    if (msg.thread_ts && msg.thread_ts !== msg.ts) {
      console.log(`  (in thread: ${msg.thread_ts})`);
    }
    console.log();
  }
}

async function cmdConfig(args: string[]) {
  if (args[0] === "show") {
    const hasToken = !!getBotToken();
    console.log(JSON.stringify({ has_bot_token: hasToken }, null, 2));
    return;
  }
  if (args[0] === "set" && args[1] === "bot-token" && args[2]) {
    setSecret({ tool: "slack-read", key: "bot_token" }, args[2]);
    console.log("✓ Bot token saved to ~/.config/mr-tools/secrets.json under 'slack-read.bot_token'");
    return;
  }
  printHelp();
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") {
    printHelp();
    return;
  }

  const a = parseArgs(argv);

  switch (a.command) {
    case "config":
      return cmdConfig(a.args);
    default:
      // Read messages: slack-read "#channel" [options]
      // command is the channel
      if (!a.command) {
        printHelp();
        return;
      }
      return getMessages(a.command, a.since, a.limit, a.json);
  }
}

main().catch((e) => {
  console.error(`Error: ${e?.message || e}`);
  process.exit(1);
});
