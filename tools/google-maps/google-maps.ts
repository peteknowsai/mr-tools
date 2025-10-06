#!/usr/bin/env bun
import { statSync } from "fs";
import { getSecret, setSecret } from "../../lib/config";

type CLIArgs = {
  command?: string;
  json?: boolean;
  query?: string | null;
  args: string[];
  key?: string | null;
};

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = { args: [], json: false, query: null, key: null };
  if (!argv.length) return args;
  const [cmd, ...rest] = argv;
  args.command = cmd;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--json") args.json = true;
    else if (!args.query) args.query = a;
    else args.args.push(a);
  }
  if (cmd === "config" && rest[0] === "set" && rest[1] === "api-key") args.key = rest[2] || null;
  if (cmd === "config" && rest[0] === "show") args.args.push("show");
  return args;
}

function printHelp() {
  console.log(`Google Maps CLI (Bun)

Usage:
  google-maps geocode <address> [--json]
  google-maps reverse-geocode <lat> <lng> [--json]
  google-maps directions <origin> <destination> [--json]
  google-maps distance <origin> <destination> [--json]
  google-maps place-search <query> [--near <place|lat,lng>] [--radius N] [--json]
  google-maps place-details <place_id> [--fields name rating website ...] [--json]
  google-maps timezone <lat> <lng> [--json]
  google-maps elevation <lat> <lng> [--json]
  google-maps config set api-key <key>
  google-maps config show
`);
}

function getApiKey(): string | undefined {
  return getSecret({ tool: "google_maps", key: "api_key", env: ["GOOGLE_MAPS_API_KEY"] });
}

function die(msg: string): never { console.error(msg); process.exit(1); }

async function callMaps(path: string, params: Record<string, any>) {
  const key = getApiKey();
  if (!key) die("Missing API key. Set GOOGLE_MAPS_API_KEY or run: google-maps config set api-key <key>");
  const url = new URL(`https://maps.googleapis.com${path}`);
  Object.entries({ ...params, key }).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || data.status === "REQUEST_DENIED" || data.error_message) {
    die(`Error: ${data.error_message || data.status || res.statusText}`);
  }
  return data;
}

async function geocode(address: string, json: boolean) {
  const data = await callMaps("/maps/api/geocode/json", { address });
  if (json) console.log(JSON.stringify(data, null, 2));
  else {
    const r = data.results?.[0];
    if (!r) return console.log("No results");
    const loc = r.geometry?.location;
    console.log(`${loc.lat},${loc.lng}  ${r.formatted_address}`);
  }
}

async function reverseGeocode(lat: string, lng: string, json: boolean) {
  const data = await callMaps("/maps/api/geocode/json", { latlng: `${lat},${lng}` });
  if (json) console.log(JSON.stringify(data, null, 2));
  else console.log(data.results?.[0]?.formatted_address || "No results");
}

async function directions(origin: string, destination: string, json: boolean) {
  const data = await callMaps("/maps/api/directions/json", { origin, destination });
  if (json) console.log(JSON.stringify(data, null, 2));
  else {
    const leg = data.routes?.[0]?.legs?.[0];
    if (!leg) return console.log("No route");
    console.log(`${leg.distance.text}, ${leg.duration.text}`);
    leg.steps?.slice(0, 10).forEach((s: any, i: number) => console.log(`${i + 1}. ${s.html_instructions?.replace(/<[^>]+>/g, '')}`));
  }
}

async function distance(origin: string, destination: string, json: boolean) {
  const data = await callMaps("/maps/api/distancematrix/json", { origins: origin, destinations: destination });
  if (json) console.log(JSON.stringify(data, null, 2));
  else {
    const el = data.rows?.[0]?.elements?.[0];
    if (!el || el.status !== "OK") return console.log("No result");
    console.log(`${el.distance.text}, ${el.duration.text}`);
  }
}

async function placeSearch(query: string, opts: Record<string, string>, json: boolean) {
  const params: Record<string, any> = { query }; // using Text Search API
  if (opts.near) params.location = opts.near;
  if (opts.radius) params.radius = Number(opts.radius);
  const data = await callMaps("/maps/api/place/textsearch/json", params);
  if (json) console.log(JSON.stringify(data, null, 2));
  else (data.results || []).slice(0, 5).forEach((p: any) => console.log(`${p.name} (${p.place_id}) - ${p.formatted_address || ''}`));
}

async function placeDetails(placeId: string, fields: string[], json: boolean) {
  const params: Record<string, any> = { place_id: placeId };
  if (fields && fields.length) params.fields = fields.join(",");
  const data = await callMaps("/maps/api/place/details/json", params);
  if (json) console.log(JSON.stringify(data, null, 2));
  else {
    const r = data.result;
    if (!r) return console.log("No result");
    console.log(`${r.name}  ${r.formatted_address || ''}  ${r.website || ''}`);
  }
}

async function timezone(lat: string, lng: string, json: boolean) {
  const timestamp = Math.floor(Date.now() / 1000);
  const data = await callMaps("/maps/api/timezone/json", { location: `${lat},${lng}`, timestamp });
  if (json) console.log(JSON.stringify(data, null, 2));
  else console.log(`${data.timeZoneId} (${data.timeZoneName})`);
}

async function elevation(lat: string, lng: string, json: boolean) {
  const data = await callMaps("/maps/api/elevation/json", { locations: `${lat},${lng}` });
  if (json) console.log(JSON.stringify(data, null, 2));
  else console.log(`${data.results?.[0]?.elevation ?? "No result"}`);
}

async function cmdConfig(args: CLIArgs) {
  if (args.args.includes("show")) {
    const has = !!getApiKey();
    console.log(JSON.stringify({ has_api_key: has }, null, 2));
    return;
  }
  if (args.key) {
    setSecret({ tool: "google_maps", key: "api_key" }, args.key);
    console.log("✓ API key saved to ~/.config/tool-library/secrets.json under 'google_maps.api_key'");
    return;
  }
  printHelp();
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") { printHelp(); return; }
  const args = parseArgs(argv);
  const json = !!args.json;

  switch (args.command) {
    case "geocode": return geocode(String(args.query), json);
    case "reverse-geocode": return reverseGeocode(String(args.args[0]), String(args.args[1]), json);
    case "directions": return directions(String(args.query), String(args.args[0]), json);
    case "distance": return distance(String(args.query), String(args.args[0]), json);
    case "place-search": {
      const opts: Record<string,string> = {};
      for (let i = 0; i < args.args.length; i++) {
        if (args.args[i] === "--near") opts.near = args.args[++i];
        else if (args.args[i] === "--radius") opts.radius = args.args[++i];
      }
      return placeSearch(String(args.query), opts, json);
    }
    case "place-details": {
      const fieldsIdx = args.args.indexOf("--fields");
      const fields = fieldsIdx >= 0 ? args.args.slice(fieldsIdx + 1) : [];
      return placeDetails(String(args.query), fields, json);
    }
    case "timezone": return timezone(String(args.query), String(args.args[0]), json);
    case "elevation": return elevation(String(args.query), String(args.args[0]), json);
    case "config": return cmdConfig(args);
    default: return printHelp();
  }
}

main().catch((e) => { console.error(`Error: ${e?.message || e}`); process.exit(1); });
