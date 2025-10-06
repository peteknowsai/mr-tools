#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getSecret, setSecret } from "../../lib/config";

const TOKEN_DIR = join(homedir(), ".config", "tool-library", "gmail");
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
  headers?: string[];
};

function printHelp() {
  console.log(`Gmail CLI (Bun)

Usage:
  gmail auth
  gmail list [-n N] [--json]
  gmail read <MESSAGE_ID> [--json]
  gmail config set client-id <id>
  gmail config set client-secret <secret>
  gmail config show
`);
}

function parseArgs(argv: string[]): CLIArgs {
  const out: CLIArgs = { args: [], json: false, num: 10, headers: [] };
  if (!argv.length) return out;
  const [cmd, ...rest] = argv;
  out.command = cmd;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--json") out.json = true;
    else if ((a === "-n" || a === "--num") && rest[i + 1]) { out.num = Number(rest[++i]); }
    else out.args.push(a);
  }
  return out;
}

function getClientCreds(): { client_id?: string; client_secret?: string } {
  // Priority: env -> central secrets -> legacy file (~/.gmail-cli/credentials.json)
  const envId = process.env.GMAIL_CLIENT_ID;
  const envSecret = process.env.GMAIL_CLIENT_SECRET;
  if (envId && envSecret) return { client_id: envId, client_secret: envSecret };
  const cid = getSecret({ tool: "google", key: "client_id", env: [] });
  const csec = getSecret({ tool: "google", key: "client_secret", env: [] });
  if (cid && csec) return { client_id: cid, client_secret: csec };
  const legacyPath = join(homedir(), ".gmail-cli", "credentials.json");
  if (existsSync(legacyPath)) {
    try {
      const cfg = JSON.parse(readFileSync(legacyPath, "utf8"));
      const installed = cfg.installed || cfg.web || {};
      return {
        client_id: installed.client_id,
        client_secret: installed.client_secret,
      };
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
    const t = JSON.parse(readFileSync(TOKEN_FILE, "utf8"));
    return t;
  } catch {
    return undefined;
  }
}

function isExpired(token: Token): boolean {
  if (!token.expiry_date) return true;
  return Date.now() > token.expiry_date - 60_000; // refresh 1m early
}

async function refreshToken(token: Token, client_id: string, client_secret: string): Promise<Token> {
  if (!token.refresh_token) throw new Error("No refresh_token available");
  const params = new URLSearchParams({
    client_id,
    client_secret,
    grant_type: "refresh_token",
    refresh_token: token.refresh_token,
  });
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error_description || data.error || "refresh failed");
  const newToken: Token = {
    access_token: data.access_token,
    expires_in: data.expires_in,
    refresh_token: token.refresh_token,
    scope: data.scope,
    token_type: data.token_type,
    expiry_date: Date.now() + data.expires_in * 1000,
  };
  saveToken(newToken);
  return newToken;
}

async function ensureToken(scopes: string[]): Promise<Token> {
  const { client_id, client_secret } = getClientCreds();
  if (!client_id || !client_secret) throw new Error("Missing Google OAuth client. Run: gmail config set client-id <id> && gmail config set client-secret <secret> or place ~/.gmail-cli/credentials.json");

  let token = loadToken();
  if (token && !isExpired(token)) return token;
  if (token && isExpired(token)) return await refreshToken(token, client_id, client_secret);

  // Do interactive auth with loopback redirect
  const redirectUri = "http://127.0.0.1:53171/";
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("scope", scopes.join(" "));

  console.log("Opening browser for Google authorization...");
  await Bun.$`open ${authUrl.toString()}`.quiet();

  const server = Bun.serve<{ code?: string }>({
    port: 53171,
    fetch(req) {
      const url = new URL(req.url);
      const code = url.searchParams.get("code");
      if (code) {
        return new Response("You may close this window.", { headers: { "content-type": "text/plain" } });
      }
      return new Response("Missing code", { status: 400 });
    },
  });

  // Wait for the first request that contains ?code=
  let authCode: string | undefined;
  // Poll server's pending requests via a simple loop waiting for a connection
  // Since Bun.serve doesn't provide event hooks here, prompt the user for paste as fallback
  console.log("If the browser did not redirect, paste the full redirected URL here:");
  const pasted = (await Bun.readableStreamToText(Bun.stdin)).trim();
  try {
    const pastedUrl = new URL(pasted);
    authCode = pastedUrl.searchParams.get("code") || undefined;
  } catch {
    // ignore
  }
  server.stop();

  if (!authCode) throw new Error("Authorization code not received");

  const params = new URLSearchParams({
    code: authCode,
    client_id,
    client_secret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error_description || data.error || "token exchange failed");
  token = {
    access_token: data.access_token,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token,
    scope: data.scope,
    token_type: data.token_type,
    expiry_date: Date.now() + data.expires_in * 1000,
  };
  saveToken(token);
  return token;
}

async function api(path: string, params?: Record<string, any>) {
  const token = await ensureToken(["https://www.googleapis.com/auth/gmail.readonly"]);
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token.access_token}` } });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || res.statusText);
  return data;
}

async function cmdList(n: number, json: boolean) {
  const list = await api("users/me/messages", { maxResults: n });
  const messages = list.messages || [];
  if (json) console.log(JSON.stringify(messages, null, 2));
  else messages.forEach((m: any) => console.log(m.id));
}

async function cmdRead(id: string, json: boolean) {
  const msg = await api(`users/me/messages/${id}`, { format: "full" });
  if (json) { console.log(JSON.stringify(msg, null, 2)); return; }
  const headers = (msg.payload?.headers || []) as Array<{ name: string; value: string }>;
  const get = (n: string) => headers.find(h => h.name.toLowerCase() === n.toLowerCase())?.value || "";
  console.log(`From: ${get("From")}`);
  console.log(`To: ${get("To")}`);
  console.log(`Subject: ${get("Subject")}`);
  console.log(`Date: ${get("Date")}`);
}

async function cmdConfig(args: string[]) {
  if (args[0] === "show") {
    const hasId = !!getSecret({ tool: "google", key: "client_id" });
    const hasSecret = !!getSecret({ tool: "google", key: "client_secret" });
    console.log(JSON.stringify({ has_client_id: hasId, has_client_secret: hasSecret, token_saved: existsSync(TOKEN_FILE) }, null, 2));
    return;
  }
  if (args[0] === "set" && args[1] === "client-id" && args[2]) {
    setSecret({ tool: "google", key: "client_id" }, args[2]);
    console.log("✓ Saved client-id");
    return;
  }
  if (args[0] === "set" && args[1] === "client-secret" && args[2]) {
    setSecret({ tool: "google", key: "client_secret" }, args[2]);
    console.log("✓ Saved client-secret");
    return;
  }
  printHelp();
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") { printHelp(); return; }
  const a = parseArgs(argv);
  switch (a.command) {
    case "auth": await ensureToken(["https://www.googleapis.com/auth/gmail.readonly"]); console.log("✓ Auth complete"); break;
    case "list": await cmdList(a.num || 10, !!a.json); break;
    case "read": if (!a.args[0]) throw new Error("Missing MESSAGE_ID"); await cmdRead(a.args[0], !!a.json); break;
    case "config": await cmdConfig(a.args); break;
    default: printHelp();
  }
}

main().catch(e => { console.error(`Error: ${e?.message || e}`); process.exit(1); });
