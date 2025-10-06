#!/usr/bin/env bun
import { getSecret, setSecret } from "../../lib/config";

// Latest default model for xAI Grok (adjustable): prefer grok-3 or grok-3-latest
const DEFAULT_MODEL = process.env.GROK_MODEL || "grok-4";
const BASE_URL = process.env.GROK_BASE_URL || "https://api.x.ai/v1"; // OpenAI-compatible path

function getApiKey(): string | undefined {
  return getSecret({ tool: "grok", key: "api_key", env: ["GROK_API_KEY", "XAI_API_KEY"] });
}

function printHelp() {
  console.log(`Grok CLI (Bun) - X research focused\n\nUsage:\n  grok config set api-key <key>\n  grok config show\n\n  grok x-topic "<query>" [--model grok-4] [--json]\n  grok x-url <https://x.com/...> [--model grok-4] [--json]\n\nNotes:\n- Uses latest Grok model by default: ${DEFAULT_MODEL}\n- No streaming used.\n`);
}

type CLIArgs = { command?: string; args: string[]; json?: boolean; model?: string | null };

function parseArgs(argv: string[]): CLIArgs {
  const out: CLIArgs = { args: [], json: false, model: null };
  if (!argv.length) return out;
  out.command = argv[0];
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--model") out.model = argv[++i];
    else out.args.push(a);
  }
  return out;
}

async function chat(messages: any[], model?: string) {
  const key = getApiKey();
  if (!key) throw new Error("Missing Grok API key. Set GROK_API_KEY or run: grok config set api-key <key>");
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: model || DEFAULT_MODEL, messages })
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || res.statusText);
  return data;
}

async function xTopic(query: string, json: boolean, model?: string) {
  const system = "You are an assistant specialized in analyzing real-time discussions and trends on X (Twitter). Focus on citations, accounts, threads, sentiment, and engagement.";
  const user = `Analyze what's happening on X about: ${query}. Provide:
- key threads and accounts
- sentiment/stance distribution
- notable quotes (with @handles)
- links to primary threads
- summary of shifts in last 24-48h if apparent`;
  const resp = await chat([
    { role: "system", content: system },
    { role: "user", content: user }
  ], model);
  const text = resp.choices?.[0]?.message?.content || "";
  if (json) console.log(JSON.stringify(resp, null, 2)); else console.log(text);
}

async function xUrl(url: string, json: boolean, model?: string) {
  const system = "You analyze X posts/threads for context, accuracy, and reception. Include notable replies and accounts.";
  const user = `Analyze this X URL: ${url}
Return:
- post summary and author context
- key replies and counterpoints
- engagement patterns and likely communities
- any misinformation risk or uncertainty
- follow-up accounts/threads to watch`;
  const resp = await chat([
    { role: "system", content: system },
    { role: "user", content: user }
  ], model);
  const text = resp.choices?.[0]?.message?.content || "";
  if (json) console.log(JSON.stringify(resp, null, 2)); else console.log(text);
}

async function cmdConfig(args: string[]) {
  if (args[0] === "show") {
    const has = !!getApiKey();
    console.log(JSON.stringify({ has_api_key: has, model: DEFAULT_MODEL, base_url: BASE_URL }, null, 2));
    return;
  }
  if (args[0] === "set" && args[1] === "api-key" && args[2]) {
    setSecret({ tool: "grok", key: "api_key" }, args[2]);
    console.log("✓ API key saved to ~/.config/tool-library/secrets.json under 'grok.api_key'");
    return;
  }
  printHelp();
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") { printHelp(); return; }
  const a = parseArgs(argv);
  switch (a.command) {
    case "config": return cmdConfig(a.args);
    case "x-topic": if (!a.args[0]) return printHelp(); return xTopic(a.args.join(" "), !!a.json, a.model || undefined);
    case "x-url": if (!a.args[0]) return printHelp(); return xUrl(a.args[0], !!a.json, a.model || undefined);
    default: return printHelp();
  }
}

main().catch(e => { console.error(`Error: ${e?.message || e}`); process.exit(1); });
