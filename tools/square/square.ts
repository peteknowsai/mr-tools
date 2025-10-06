#!/usr/bin/env bun
import { getSecret, setSecret } from "../../lib/config";

type CLIArgs = {
  command?: string;
  resource?: string;
  args: string[];
  json?: boolean;
  limit?: number | null;
  cursor?: string | null;
  options: Record<string, string>;
};

function printHelp() {
  console.log(`Square CLI (Bun)\n\nUsage:\n  square config set access-token <token>\n  square config set environment <production|sandbox>\n  square config show\n\n  square payments list [--limit N] [--cursor CUR] [--json]\n  square payments get <PAYMENT_ID> [--json]\n\n  square customers list [--limit N] [--cursor CUR] [--json]\n  square customers create <email> [--given-name X] [--family-name Y] [--phone Z] [--json]\n\n  square catalog list [--limit N] [--cursor CUR] [--json]\n  square locations list [--json]\n\n  square orders list <LOCATION_ID> [--limit N] [--cursor CUR] [--json]\n`);
}

function parseArgs(argv: string[]): CLIArgs {
  const out: CLIArgs = { args: [], json: false, limit: null, cursor: null, options: {} };
  if (!argv.length) return out;
  out.command = argv[0];
  out.resource = argv[1];
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--json") out.json = true;
    else if (a === "--limit") out.limit = Number(rest[++i] || 100);
    else if (a === "--cursor") out.cursor = rest[++i];
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

function getAccessToken(): string | undefined {
  return getSecret({ tool: "square", key: "access_token", env: ["SQUARE_ACCESS_TOKEN"] });
}

function getEnvironment(): "production" | "sandbox" {
  const env = process.env.SQUARE_ENVIRONMENT || getSecret({ tool: "square", key: "environment", env: [] }) || "production";
  return env === "sandbox" ? "sandbox" : "production";
}

function getBaseUrl(): string {
  return getEnvironment() === "sandbox" ? "https://connect.squareupsandbox.com/v2" : "https://connect.squareup.com/v2";
}

async function sq(method: string, path: string, body?: any, query?: Record<string, any>) {
  const token = getAccessToken();
  if (!token) die("Missing Square access token. Set SQUARE_ACCESS_TOKEN or run: square config set access-token <token>");
  const url = new URL(`${getBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`);
  if (query) Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null) url.searchParams.set(k, String(v)); });
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.errors) {
    const err = data.errors?.[0]?.detail || res.statusText;
    die(`Error: ${err}`);
  }
  return data;
}

// Payments
async function paymentsList(limit: number | null, cursor: string | null, json: boolean) {
  const resp = await sq("GET", "/payments", undefined, { limit: limit ?? 100, cursor: cursor ?? undefined });
  if (json) console.log(JSON.stringify(resp, null, 2));
  else {
    const items = resp.payments || [];
    console.log(`Payments: ${items.length}${resp.cursor ? " (more available)" : ""}`);
    items.forEach((p: any) => console.log(`${p.id}  ${p.amount_money?.amount ?? ""} ${p.amount_money?.currency ?? ""}  ${p.status}`));
  }
}
async function paymentsGet(id: string, json: boolean) {
  const resp = await sq("GET", `/payments/${encodeURIComponent(id)}`);
  if (json) console.log(JSON.stringify(resp, null, 2));
  else {
    const p = resp.payment;
    console.log(`${p.id}  ${p.amount_money?.amount} ${p.amount_money?.currency}  ${p.status}  ${p.created_at}`);
  }
}

// Customers
async function customersList(limit: number | null, cursor: string | null, json: boolean) {
  const resp = await sq("GET", "/customers", undefined, { limit: limit ?? 100, cursor: cursor ?? undefined });
  if (json) console.log(JSON.stringify(resp, null, 2));
  else {
    const items = resp.customers || [];
    console.log(`Customers: ${items.length}${resp.cursor ? " (more available)" : ""}`);
    items.forEach((c: any) => console.log(`${c.id}  ${c.given_name || ""} ${c.family_name || ""}  ${c.email_address || ""}`));
  }
}
async function customersCreate(email: string, opts: Record<string, string>, json: boolean) {
  const body: any = { email_address: email };
  if (opts["given-name"]) body.given_name = opts["given-name"];
  if (opts["family-name"]) body.family_name = opts["family-name"];
  if (opts["phone"]) body.phone_number = opts["phone"];
  const resp = await sq("POST", "/customers", { given_name: body.given_name, family_name: body.family_name, email_address: body.email_address, phone_number: body.phone_number });
  if (json) console.log(JSON.stringify(resp, null, 2));
  else console.log(`✓ Created customer ${resp.customer?.id}`);
}

// Catalog
async function catalogList(cursor: string | null, json: boolean) {
  const resp = await sq("POST", "/catalog/list", { cursor: cursor ?? undefined });
  if (json) console.log(JSON.stringify(resp, null, 2));
  else {
    const items = resp.objects || [];
    console.log(`Catalog objects: ${items.length}${resp.cursor ? " (more available)" : ""}`);
    items.forEach((o: any) => console.log(`${o.id}  ${o.type}`));
  }
}

// Locations
async function locationsList(json: boolean) {
  const resp = await sq("GET", "/locations");
  if (json) console.log(JSON.stringify(resp, null, 2));
  else {
    const items = resp.locations || [];
    items.forEach((l: any) => console.log(`${l.id}  ${l.name}  ${l.country}`));
  }
}

// Orders
async function ordersList(locationId: string, cursor: string | null, limit: number | null, json: boolean) {
  // Orders search requires POST to /orders/search with location_ids and cursor
  const body: any = { location_ids: [locationId] };
  if (cursor) body.cursor = cursor;
  if (limit) body.limit = limit;
  const resp = await sq("POST", "/orders/search", body);
  if (json) console.log(JSON.stringify(resp, null, 2));
  else {
    const items = resp.orders || [];
    console.log(`Orders: ${items.length}${resp.cursor ? " (more available)" : ""}`);
    items.forEach((o: any) => console.log(`${o.id}  ${o.state}`));
  }
}

async function cmdConfig(args: string[]) {
  if (args[0] === "show") {
    const has = !!getAccessToken();
    const env = getEnvironment();
    console.log(JSON.stringify({ has_access_token: has, environment: env }, null, 2));
    return;
  }
  if (args[0] === "set" && args[1] === "access-token" && args[2]) {
    setSecret({ tool: "square", key: "access_token" }, args[2]);
    console.log("✓ Saved access token to ~/.config/tool-library/secrets.json under 'square.access_token'");
    return;
  }
  if (args[0] === "set" && args[1] === "environment" && args[2]) {
    const env = args[2] === "sandbox" ? "sandbox" : "production";
    setSecret({ tool: "square", key: "environment" }, env);
    console.log("✓ Saved environment");
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
    case "payments list": return paymentsList(a.limit, a.cursor, json);
    case "payments get": if (!a.args[0]) return printHelp(); return paymentsGet(a.args[0], json);
    case "customers list": return customersList(a.limit, a.cursor, json);
    case "customers create": if (!a.args[0]) return printHelp(); return customersCreate(a.args[0], a.options, json);
    case "catalog list": return catalogList(a.cursor, json);
    case "locations list": return locationsList(json);
    case "orders list": if (!a.args[0]) return printHelp(); return ordersList(a.args[0], a.cursor, a.limit, json);
    default: return printHelp();
  }
}

main().catch(e => { console.error(`Error: ${e?.message || e}`); process.exit(1); });
