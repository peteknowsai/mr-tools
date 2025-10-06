#!/usr/bin/env bun
import { getSecret, setSecret } from "../../lib/config";

type CLIArgs = { command?: string; args: string[]; json?: boolean; options: Record<string,string> };

function printHelp() {
  console.log(`Typefully CLI (Bun)\n\nUsage:\n  typefully config set api-key <key>\n  typefully config show\n\n  typefully create "text..." [--schedule "YYYY-MM-DD HH:MM"|next] [--auto-retweet] [--share] [--json]\n  typefully list scheduled|published [--limit N] [--json]\n`);
}

function parseArgs(argv: string[]): CLIArgs {
  const out: CLIArgs = { args: [], json: false, options: {} };
  if (!argv.length) return out;
  out.command = argv[0];
  const rest = argv.slice(1);
  for (let i=0;i<rest.length;i++) {
    const a = rest[i];
    if (a === "--json") out.json = true;
    else if (a.startsWith("--")) { const k=a.slice(2); const v = rest[i+1] && !rest[i+1].startsWith("--")? rest[++i] : "true"; out.options[k]=v; }
    else out.args.push(a);
  }
  return out;
}

function getApiKey(): string | undefined { return getSecret({ tool: "typefully", key: "api_key", env: ["TYPEFULLY_API_KEY"] }); }
function die(msg: string): never { console.error(msg); process.exit(1); }

const BASE = "https://api.typefully.com/v1";
async function tf(path: string, method: string, body?: any, query?: Record<string,any>) {
  const key = getApiKey(); if (!key) die("Missing Typefully API key. Set TYPEFULLY_API_KEY or run: typefully config set api-key <key>");
  const url = new URL(`${BASE}${path.startsWith('/')?'':'/'}${path}`);
  if (query) Object.entries(query).forEach(([k,v])=>{ if(v!==undefined&&v!==null) url.searchParams.set(k,String(v)); });
  const res = await fetch(url.toString(), { method, headers: { Authorization: `Bearer ${key}`, "Content-Type":"application/json" }, body: body? JSON.stringify(body): undefined });
  const data = await res.json().catch(()=>({}));
  if(!res.ok || data.error) die(data.error?.message || res.statusText);
  return data;
}

async function cmdCreate(text: string, opts: Record<string,string>, json:boolean){
  const payload: any = { text };
  if (opts["schedule"]) payload.schedule = opts["schedule"];
  if (opts["auto-retweet"] === "true") payload.auto_retweet = true;
  if (opts["share"] === "true") payload.share = true;
  const resp = await tf("/posts", "POST", payload);
  if (json) console.log(JSON.stringify(resp,null,2)); else console.log(`✓ Created ${resp.id || ''}`);
}

async function cmdList(kind: string, opts: Record<string,string>, json:boolean){
  const limit = opts["limit"] ? Number(opts["limit"]) : 20;
  const resp = await tf(`/posts/${kind}`, "GET", undefined, { limit });
  if (json) console.log(JSON.stringify(resp,null,2)); else {
    const items = resp.items || resp || [];
    items.forEach((p:any)=> console.log(`${p.id}  ${p.text?.slice(0,60) || ''}`));
  }
}

async function cmdConfig(args:string[]){
  if (args[0] === "show") { console.log(JSON.stringify({ has_api_key: !!getApiKey() }, null, 2)); return; }
  if (args[0] === "set" && args[1] === "api-key" && args[2]) { setSecret({ tool: "typefully", key:"api_key"}, args[2]); console.log("✓ API key saved under 'typefully.api_key'"); return; }
  printHelp();
}

async function main(){
  const argv = process.argv.slice(2); if(!argv.length || argv[0]==='-h'||argv[0]==='--help'){ printHelp(); return; }
  const a = parseArgs(argv); const json = !!a.json;
  switch (a.command){
    case "config": return cmdConfig(a.args);
    case "create": if(!a.args.length) return printHelp(); return cmdCreate(a.args.join(' '), a.options, json);
    case "list": if(!a.args[0]) return printHelp(); return cmdList(a.args[0], a.options, json);
    default: return printHelp();
  }
}

main().catch(e=>{ console.error(`Error: ${e?.message||e}`); process.exit(1); });
