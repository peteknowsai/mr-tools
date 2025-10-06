#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getSecret, setSecret } from "../../lib/config";

const TOKEN_DIR = join(homedir(), ".config", "tool-library", "google-calendar");
const TOKEN_FILE = join(TOKEN_DIR, "token.json");

type Token = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
  expiry_date?: number; // ms epoch
};

type CLIArgs = {
  command?: string;
  args: string[];
  json?: boolean;
  num?: number;
  from?: string | null;
  to?: string | null;
};

function printHelp() {
  console.log(`Google Calendar CLI (Bun)\n\nUsage:\n  gcal auth\n  gcal list [-n N] [--from ISO] [--to ISO] [--json]\n  gcal create "<summary>" "<start-iso>" "<end-iso>" [-z <timezone>] [--json]\n  gcal delete <EVENT_ID>\n  gcal config set client-id <id>\n  gcal config set client-secret <secret>\n  gcal config show\n`);
}

function parseArgs(argv: string[]): CLIArgs {
  const out: CLIArgs = { args: [], json: false, num: 10, from: null, to: null };
  if (!argv.length) return out;
  const [cmd, ...rest] = argv;
  out.command = cmd;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--json") out.json = true;
    else if ((a === "-n" || a === "--num") && rest[i + 1]) { out.num = Number(rest[++i]); }
    else if (a === "--from" && rest[i + 1]) { out.from = rest[++i]; }
    else if (a === "--to" && rest[i + 1]) { out.to = rest[++i]; }
    else out.args.push(a);
  }
  return out;
}

function getClientCreds(): { client_id?: string; client_secret?: string } {
  const envId = process.env.GCAL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const envSecret = process.env.GCAL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  if (envId && envSecret) return { client_id: envId, client_secret: envSecret };
  const cid = getSecret({ tool: "google", key: "client_id", env: [] });
  const csec = getSecret({ tool: "google", key: "client_secret", env: [] });
  if (cid && csec) return { client_id: cid, client_secret: csec };
  const legacyPath = join(homedir(), ".gcal-cli", "credentials.json");
  if (existsSync(legacyPath)) {
    try {
      const cfg = JSON.parse(readFileSync(legacyPath, "utf8"));
      const installed = cfg.installed || cfg.web || {};
      return { client_id: installed.client_id, client_secret: installed.client_secret };
    } catch {}
  }
  return {};
}

function saveToken(token: Token) {
  if (!existsSync(TOKEN_DIR)) mkdirSync(TOKEN_DIR, { recursive: true });
  writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2));
}

function loadToken(): Token | undefined {
  try {
    if (!existsSync(TOKEN_FILE)) return undefined;
    return JSON.parse(readFileSync(TOKEN_FILE, "utf8"));
  } catch { return undefined; }
}

function isExpired(token: Token): boolean {
  if (!token.expiry_date) return true;
  return Date.now() > token.expiry_date - 60_000;
}

async function refreshToken(token: Token, client_id: string, client_secret: string): Promise<Token> {
  if (!token.refresh_token) throw new Error("No refresh_token available");
  const params = new URLSearchParams({ client_id, client_secret, grant_type: "refresh_token", refresh_token: token.refresh_token });
  const resp = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() });
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error_description || data.error || "refresh failed");
  const newToken: Token = { access_token: data.access_token, expires_in: data.expires_in, refresh_token: token.refresh_token, scope: data.scope, token_type: data.token_type, expiry_date: Date.now() + data.expires_in * 1000 };
  saveToken(newToken);
  return newToken;
}

async function ensureToken(scopes: string[]): Promise<Token> {
  const { client_id, client_secret } = getClientCreds();
  if (!client_id || !client_secret) throw new Error("Missing Google OAuth client. Run: gcal config set client-id <id> && gcal config set client-secret <secret>");
  let token = loadToken();
  if (token && !isExpired(token)) return token;
  if (token && isExpired(token)) return await refreshToken(token, client_id, client_secret);

  const redirectUri = "http://127.0.0.1:53172/";
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("scope", scopes.join(" "));

  console.log("Opening browser for Google authorization...");
  await Bun.$`open ${authUrl.toString()}`.quiet();

  // Fallback: prompt user to paste the redirected URL
  console.log("Paste the redirected URL here (it contains ?code=...):");
  const pasted = (await Bun.readableStreamToText(Bun.stdin)).trim();
  let authCode: string | undefined;
  try { const pastedUrl = new URL(pasted); authCode = pastedUrl.searchParams.get("code") || undefined; } catch {}
  if (!authCode) throw new Error("Authorization code not received");

  const params = new URLSearchParams({ code: authCode, client_id, client_secret, redirect_uri: redirectUri, grant_type: "authorization_code" });
  const resp = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() });
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error_description || data.error || "token exchange failed");
  token = { access_token: data.access_token, expires_in: data.expires_in, refresh_token: data.refresh_token, scope: data.scope, token_type: data.token_type, expiry_date: Date.now() + data.expires_in * 1000 };
  saveToken(token);
  return token;
}

async function api(path: string, params?: Record<string, any>, method: string = "GET", body?: any) {
  const token = await ensureToken(["https://www.googleapis.com/auth/calendar.events"]);
  const url = new URL(`https://www.googleapis.com/calendar/v3/${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), { method, headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || res.statusText);
  return data;
}

async function cmdList(n: number, from: string | null, to: string | null, json: boolean) {
  const nowIso = new Date().toISOString();
  const params: any = { maxResults: n, orderBy: "startTime", singleEvents: true, timeMin: from || nowIso };
  if (to) params.timeMax = to;
  const data = await api("calendars/primary/events", params);
  const events = data.items || [];
  if (json) console.log(JSON.stringify(events, null, 2));
  else events.forEach((e: any) => {
    const start = e.start?.dateTime || e.start?.date;
    const end = e.end?.dateTime || e.end?.date;
    console.log(`${e.id}  ${start} - ${end}  ${e.summary || "(no title)"}`);
  });
}

async function cmdCreate(summary: string, startIso: string, endIso: string, tz?: string, json?: boolean) {
  const body: any = { summary, start: {}, end: {} };
  if (startIso.length === 10) body.start.date = startIso; else body.start.dateTime = startIso;
  if (endIso.length === 10) body.end.date = endIso; else body.end.dateTime = endIso;
  if (tz) { if (body.start.dateTime) body.start.timeZone = tz; if (body.end.dateTime) body.end.timeZone = tz; }
  const event = await api("calendars/primary/events", undefined, "POST", body);
  if (json) console.log(JSON.stringify(event, null, 2));
  else console.log(`✓ Created ${event.id}  ${event.htmlLink || ""}`);
}

async function cmdDelete(id: string, json?: boolean) {
  await api(`calendars/primary/events/${encodeURIComponent(id)}`, undefined, "DELETE");
  if (json) console.log(JSON.stringify({ success: true, id }, null, 2));
  else console.log(`✓ Deleted ${id}`);
}

async function cmdConfig(args: string[]) {
  if (args[0] === "show") {
    const hasId = !!getSecret({ tool: "google", key: "client_id" });
    const hasSecret = !!getSecret({ tool: "google", key: "client_secret" });
    console.log(JSON.stringify({ has_client_id: hasId, has_client_secret: hasSecret, token_saved: existsSync(TOKEN_FILE) }, null, 2));
    return;
  }
  if (args[0] === "set" && args[1] === "client-id" && args[2]) { setSecret({ tool: "google", key: "client_id" }, args[2]); console.log("✓ Saved client-id"); return; }
  if (args[0] === "set" && args[1] === "client-secret" && args[2]) { setSecret({ tool: "google", key: "client_secret" }, args[2]); console.log("✓ Saved client-secret"); return; }
  printHelp();
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") { printHelp(); return; }
  const a = parseArgs(argv);
  switch (a.command) {
    case "auth": await ensureToken(["https://www.googleapis.com/auth/calendar.events"]); console.log("✓ Auth complete"); break;
    case "list": await cmdList(a.num || 10, a.from, a.to, !!a.json); break;
    case "create": if (a.args.length < 3) return printHelp(); {
      const tzIdx = a.args.indexOf("-z");
      const tz = tzIdx >= 0 ? a.args[tzIdx + 1] : undefined;
      const summary = a.args[0];
      const startIso = a.args[1];
      const endIso = a.args[2];
      await cmdCreate(summary, startIso, endIso, tz, !!a.json);
      break;
    }
    case "delete": if (!a.args[0]) return printHelp(); await cmdDelete(a.args[0], !!a.json); break;
    case "config": await cmdConfig(a.args); break;
    default: printHelp();
  }
}

main().catch(e => { console.error(`Error: ${e?.message || e}`); process.exit(1); });
