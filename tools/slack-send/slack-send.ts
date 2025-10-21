#!/usr/bin/env bun
import { getSecret, setSecret } from "../../lib/config";

const BASE_URL = "https://slack.com/api";

function getBotToken(): string | undefined {
  return getSecret({ tool: "slack-send", key: "bot_token", env: ["SLACK_BOT_TOKEN"] });
}

function printHelp() {
  console.log(`Slack Send CLI - Post messages to Slack channels

Usage:
  slack-send config set bot-token <token>
  slack-send config show

  slack-send "<channel>" "<message>" [--thread <thread_ts>] [--json]

Examples:
  slack-send "#mr-comms" "Hey, please send email about deployment"
  slack-send "#mr-tools" "Build completed successfully"
  slack-send "#mr-comms" "Follow-up message" --thread "1234567890.123456"
  slack-send "C1234567890" "Message by channel ID"

Options:
  --thread <ts>    Reply in thread (thread timestamp)
  --json           Output raw JSON response

Notes:
- Channel can be name (#channel) or ID (C1234567890)
- Bot token must have chat:write and chat:write.public scopes
- Set token with: slack-send config set bot-token xoxb-...
`);
}

type CLIArgs = {
  command?: string;
  args: string[];
  json?: boolean;
  thread?: string;
};

function parseArgs(argv: string[]): CLIArgs {
  const out: CLIArgs = { args: [], json: false };
  if (!argv.length) return out;
  out.command = argv[0];
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--thread") out.thread = argv[++i];
    else out.args.push(a);
  }
  return out;
}

async function postMessage(channel: string, text: string, threadTs?: string, outputJson?: boolean) {
  const token = getBotToken();
  if (!token) {
    throw new Error("Missing Slack bot token. Set SLACK_BOT_TOKEN or run: slack-send config set bot-token <token>");
  }

  const body: any = {
    channel: channel.startsWith("#") ? channel.slice(1) : channel,
    text: text,
  };

  if (threadTs) {
    body.thread_ts = threadTs;
  }

  const res = await fetch(`${BASE_URL}/chat.postMessage`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(data.error || res.statusText || "Failed to post message");
  }

  if (outputJson) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(`✓ Message sent to ${channel}`);
    if (data.ts) {
      console.log(`  Timestamp: ${data.ts}`);
    }
    if (threadTs) {
      console.log(`  Thread: ${threadTs}`);
    }
  }

  return data;
}

async function cmdConfig(args: string[]) {
  if (args[0] === "show") {
    const hasToken = !!getBotToken();
    console.log(JSON.stringify({ has_bot_token: hasToken }, null, 2));
    return;
  }
  if (args[0] === "set" && args[1] === "bot-token" && args[2]) {
    setSecret({ tool: "slack-send", key: "bot_token" }, args[2]);
    console.log("✓ Bot token saved to ~/.config/mr-tools/secrets.json under 'slack-send.bot_token'");
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
      // Direct message: slack-send "#channel" "message"
      // command is the channel, args[0] is the message
      if (!a.command || !a.args[0]) {
        printHelp();
        return;
      }
      return postMessage(a.command, a.args[0], a.thread, a.json);
  }
}

main().catch((e) => {
  console.error(`Error: ${e?.message || e}`);
  process.exit(1);
});
