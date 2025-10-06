#!/usr/bin/env bun
import { getSecret, setSecret } from "../../lib/config";

type CLIArgs = {
  command?: string;
  resource?: string;
  args: string[];
  json?: boolean;
  options: Record<string, string>;
};

function printHelp() {
  console.log(`Cal.com CLI (Bun)\n\nUsage:\n  cal-com config set api-key <key>\n  cal-com config show\n\n  cal-com bookings list [--status upcoming|past|canceled] [--limit N] [--json]\n  cal-com bookings get <BOOKING_ID> [--json]\n  cal-com bookings cancel <BOOKING_ID> [--reason "..."] [--json]\n\n  cal-com events list [--json]\n`);
}

function parseArgs(argv: string[]): CLIArgs {
  const out: CLIArgs = { args: [], json: false, options: {} };
  if (!argv.length) return out;
  out.command = argv[0];
  out.resource = argv[1];
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--json") out.json = true;
    else if (a.startsWith("--")) {
      const key = a.slice(2);
      const value = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : "true";
      out.options[key] = value;
    } else {
      out.args.push(a);
    }
  }
  return out;
}

function die(msg: string): never { console.error(msg); process.exit(1); }

function getApiKey(): string | undefined {
  return getSecret({ tool: "cal_com", key: "api_key", env: ["CALCOM_API_KEY"] });
}

const BASE_URL = "https://api.cal.com/v1";

async function cal(method: string, path: string, query?: Record<string, any>, body?: any) {
  const key = getApiKey();
  if (!key) die("Missing Cal.com API key. Set CALCOM_API_KEY or run: cal-com config set api-key <key>");
  const url = new URL(`${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`);
  if (query) Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null) url.searchParams.set(k, String(v)); });
  const res = await fetch(url.toString(), {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.error && data.error.message)) {
    const msg = data.error?.message || res.statusText;
    die(`Error: ${msg}`);
  }
  return data;
}

// Bookings
async function bookingsList(opts: Record<string,string>, json: boolean) {
  const query: Record<string, any> = {};
  if (opts.status) query.status = opts.status;
  if (opts.limit) query.limit = Number(opts.limit);
  const data = await cal("GET", "/bookings", query);
  if (json) console.log(JSON.stringify(data, null, 2));
  else {
    const items = data.items || data.bookings || [];
    if (!items.length) return console.log("No bookings");
    items.forEach((b: any) => console.log(`${b.id}  ${b.startTime || b.startTimeUtc || b.start}  ${b.title || b.eventType?.title || ''}`));
  }
}
async function bookingsGet(id: string, json: boolean) {
  const data = await cal("GET", `/bookings/${encodeURIComponent(id)}`);
  if (json) console.log(JSON.stringify(data, null, 2));
  else console.log(`${data.id || id}  ${data.startTime || ''}  ${data.title || ''}`);
}
async function bookingsCancel(id: string, reason: string | undefined, json: boolean) {
  // Cal.com commonly uses POST /bookings/{id}/cancel
  const data = await cal("POST", `/bookings/${encodeURIComponent(id)}/cancel`, undefined, reason ? { reason } : {});
  if (json) console.log(JSON.stringify(data, null, 2));
  else console.log(`✓ Canceled ${id}`);
}

// Events
async function eventsList(json: boolean) {
  const data = await cal("GET", "/event-types");
  if (json) console.log(JSON.stringify(data, null, 2));
  else {
    const items = data.items || data.eventTypes || [];
    if (!items.length) return console.log("No event types");
    items.forEach((e: any) => console.log(`${e.id}  ${e.title || e.name}`));
  }
}

async function cmdConfig(args: string[]) {
  if (args[0] === "show") {
    const has = !!getApiKey();
    console.log(JSON.stringify({ has_api_key: has }, null, 2));
    return;
  }
  if (args[0] === "set" && args[1] === "api-key" && args[2]) {
    setSecret({ tool: "cal_com", key: "api_key" }, args[2]);
    console.log("✓ Saved API key to ~/.config/tool-library/secrets.json under 'cal_com.api_key'");
    return;
  }
  printHelp();
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") { printHelp(); return; }
  const a = parseArgs(argv);
  const json = !!a.json;

  if (a.command === "config") return cmdConfig(a.args);

  switch (`${a.command} ${a.resource}`) {
    case "bookings list": return bookingsList(a.options, json);
    case "bookings get": if (!a.args[0]) return printHelp(); return bookingsGet(a.args[0], json);
    case "bookings cancel": if (!a.args[0]) return printHelp(); return bookingsCancel(a.args[0], a.options.reason, json);
    case "events list": return eventsList(json);
    default: return printHelp();
  }
}

main().catch(e => { console.error(`Error: ${e?.message || e}`); process.exit(1); });
