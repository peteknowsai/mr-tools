#!/usr/bin/env bun
import { getSecret, setSecret } from "../../lib/config";

const BASE_URL = "https://slack.com/api";

function getBotToken(): string | undefined {
  return getSecret({ tool: "slack-create-channel", key: "bot_token" });
}

function printHelp() {
  console.log(`Slack Create Channel CLI - Create new Slack channels programmatically

Usage:
  slack-create-channel config set bot-token <token>
  slack-create-channel config show

  slack-create-channel "<channel-name>" [options]

Examples:
  slack-create-channel "captain-pete-mccarthy"
  slack-create-channel "captain-john-doe" --description "Captain's Advisor for John Doe"
  slack-create-channel "advisor-test-user" --private --json

Options:
  --description <text>  Channel description/purpose
  --private             Create private channel (default: public)
  --json                Output raw JSON response

Notes:
- Channel name must be lowercase, no spaces (use hyphens/underscores)
- Bot token must have channels:manage scope
- Returns channel ID and name for use in slack-send
- Set token with: slack-create-channel config set bot-token xoxb-...
`);
}

type CLIArgs = {
  command?: string;
  args: string[];
  description?: string;
  isPrivate?: boolean;
  json?: boolean;
};

function parseArgs(argv: string[]): CLIArgs {
  const out: CLIArgs = { args: [], isPrivate: false, json: false };
  if (!argv.length) return out;
  out.command = argv[0];
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--private") out.isPrivate = true;
    else if (a === "--description") out.description = argv[++i];
    else out.args.push(a);
  }
  return out;
}

async function createChannel(
  name: string,
  description?: string,
  isPrivate: boolean = false,
  outputJson: boolean = false
): Promise<any> {
  const token = getBotToken();
  if (!token) {
    throw new Error("Bot token not configured. Run: slack-create-channel config set bot-token xoxb-...");
  }

  // Validate channel name
  const namePattern = /^[a-z0-9-_]+$/;
  if (!namePattern.test(name)) {
    throw new Error("Channel name must be lowercase letters, numbers, hyphens, or underscores only");
  }

  if (name.length > 80) {
    throw new Error("Channel name must be 80 characters or less");
  }

  const body: any = {
    name: name,
    is_private: isPrivate,
  };

  const res = await fetch(`${BASE_URL}/conversations.create`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    // Handle specific errors
    if (data.error === "name_taken") {
      throw new Error(`Channel #${name} already exists`);
    }
    throw new Error(data.error || res.statusText || "Failed to create channel");
  }

  // Set description/purpose if provided
  if (description && data.channel?.id) {
    await fetch(`${BASE_URL}/conversations.setPurpose`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: data.channel.id,
        purpose: description,
      }),
    });
  }

  if (outputJson) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(`✓ Channel created: #${data.channel.name}`);
    console.log(`  ID: ${data.channel.id}`);
    if (description) {
      console.log(`  Purpose: ${description}`);
    }
    console.log(`  Type: ${isPrivate ? "Private" : "Public"}`);
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
    setSecret({ tool: "slack-create-channel", key: "bot_token" }, args[2]);
    console.log("✓ Bot token saved to ~/.config/mr-tools/secrets.json under 'slack-create-channel.bot_token'");
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
      // Create channel: slack-create-channel "channel-name" [options]
      // command is the channel name
      if (!a.command) {
        printHelp();
        return;
      }
      return createChannel(a.command, a.description, a.isPrivate, a.json);
  }
}

main().catch((e) => {
  console.error(`Error: ${e?.message || e}`);
  process.exit(1);
});
