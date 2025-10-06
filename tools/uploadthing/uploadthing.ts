#!/usr/bin/env bun
import { readFileSync, statSync, existsSync } from "fs";
import { basename } from "path";
import { getSecret, setSecret } from "../../lib/config";

type CLIArgs = {
  command?: string;
  files: string[];
  name?: string | null;
  metadata?: string | null;
  mime?: string | null;
  json?: boolean;
  limit?: number | null;
  key?: string | null;
  show?: boolean;
};

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = { files: [], json: false, limit: null, name: null, metadata: null, mime: null, key: null, show: false };
  if (!argv.length) return args;
  const [cmd, ...rest] = argv;
  args.command = cmd;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--json") args.json = true;
    else if (a === "--name") args.name = rest[++i];
    else if (a === "--metadata") args.metadata = rest[++i];
    else if (a === "--mime") args.mime = rest[++i];
    else if (a === "--limit") args.limit = Number(rest[++i] || 20);
    else args.files.push(a);
  }
  // Special config subcommands
  if (cmd === "config") {
    if (rest[0] === "set" && rest[1] === "api-key") args.key = rest[2] || null;
    if (rest[0] === "show") args.show = true;
  }
  return args;
}

function printHelp() {
  console.log(`UploadThing CLI (Bun)

Usage:
  uploadthing upload <file...> [--name <filename>] [--metadata JSON] [--mime <type>] [--json]
  uploadthing list [--limit N] [--json]
  uploadthing delete <id>
  uploadthing config set api-key <key>
  uploadthing config show
`);
}

function getApiKey(): string | undefined {
  return getSecret({ tool: "uploadthing", key: "api_key", env: ["UPLOADTHING_API_KEY"] });
}

function detectMime(p: string): string {
  const lower = p.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function die(msg: string): never { console.error(msg); process.exit(1); }

async function apiRequest(path: string, init: RequestInit & { base?: string } = {}) {
  const key = getApiKey();
  if (!key) die("Error: missing API key. Set UPLOADTHING_API_KEY or run: uploadthing config set api-key <key>");
  const base = "https://uploadthing.com";
  const url = `${base.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers: Record<string, string> = { ...(init.headers as any), Authorization: `Bearer ${key}` };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json: any = null; try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) die(`Error: ${(json?.error || json?.message || res.statusText)} (${res.status})`);
  return json ?? text;
}

async function cmdUpload(args: CLIArgs) {
  if (!args.files.length) die("Error: no files provided. See: uploadthing upload --help");
  const out: any[] = [];
  for (const file of args.files) {
    const st = statSync(file);
    if (!st.isFile()) die(`Error: not a file: ${file}`);
    const body = new FormData();
    const content = Bun.file(file);
    const fname = args.name || basename(file);
    const mime = args.mime || detectMime(fname);
    body.append("file", content, fname);
    body.append("filename", fname);
    body.append("contentType", mime);
    if (args.metadata) body.append("metadata", args.metadata);
    const result = await apiRequest("/api/upload", { method: "POST", body });
    out.push({ id: result?.id || result?.fileId || null, name: fname, size: st.size, mime, url: result?.url || result?.fileUrl || null, raw: result });
  }
  if (args.json) console.log(JSON.stringify(out.length === 1 ? out[0] : out, null, 2));
  else out.forEach(r => { console.log(`✓ Uploaded ${r.name}`); if (r.url) console.log(`URL: ${r.url}`); else if (r.id) console.log(`ID: ${r.id}`); });
}

async function cmdList(args: CLIArgs) {
  const limit = args.limit ?? 20;
  const result = await apiRequest(`/api/uploads?limit=${limit}`, { method: "GET" });
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    const items = Array.isArray(result) ? result : result?.items || [];
    console.log(`Found ${items.length} item(s)`);
    for (const it of items) console.log(`- ${it.id || it.fileId}: ${it.name || it.filename || "(no name)"}`);
  }
}

async function cmdDelete(args: CLIArgs) {
  const id = args.files[0];
  if (!id) die("Error: missing id. Usage: uploadthing delete <id>");
  await apiRequest(`/api/uploads/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (args.json) console.log(JSON.stringify({ success: true, id }, null, 2));
  else console.log(`✓ Deleted ${id}`);
}

async function cmdConfig(args: CLIArgs) {
  if (args.show) {
    const has = !!getApiKey();
    console.log(JSON.stringify({ has_api_key: has }, null, 2));
    return;
  }
  if (args.key) {
    setSecret({ tool: "uploadthing", key: "api_key" }, args.key);
    console.log("✓ API key saved to ~/.config/tool-library/secrets.json under 'uploadthing.api_key'");
    return;
  }
  printHelp();
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") { printHelp(); return; }
  const args = parseArgs(argv);
  switch (args.command) {
    case "upload": await cmdUpload(args); break;
    case "list": await cmdList(args); break;
    case "delete": await cmdDelete(args); break;
    case "config": await cmdConfig(args); break;
    default: printHelp();
  }
}

main().catch(e => die(`Error: ${e?.message || e}`));
