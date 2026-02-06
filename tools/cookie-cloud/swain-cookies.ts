#!/usr/bin/env bun
/**
 * swain-cookies - Manage cloud cookie refresh for Gemini
 *
 * Usage:
 *   swain-cookies refresh    Trigger a cookie refresh now
 *   swain-cookies status     Check last refresh time and cookie health
 */

import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync } from "fs";

const SECRETS_FILE = join(homedir(), ".config/mr-tools/secrets.json");

interface Secrets {
  cloudflare?: {
    cookie_refresh_url?: string;
    cookie_refresh_secret?: string;
  };
}

function loadSecrets(): Secrets {
  if (!existsSync(SECRETS_FILE)) {
    console.error(`Secrets file not found: ${SECRETS_FILE}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(SECRETS_FILE, "utf-8"));
}

function getWorkerConfig(): { url: string; secret: string } {
  const secrets = loadSecrets();
  const url = secrets.cloudflare?.cookie_refresh_url;
  const secret = secrets.cloudflare?.cookie_refresh_secret;

  if (!url || !secret) {
    console.error(`Missing cloudflare.cookie_refresh_url or cookie_refresh_secret in ${SECRETS_FILE}`);
    console.error(`\nAdd to your secrets.json:`);
    console.error(`  "cloudflare": {`);
    console.error(`    "cookie_refresh_url": "https://cookie-refresh-trigger.<your-domain>.workers.dev",`);
    console.error(`    "cookie_refresh_secret": "your-shared-secret"`);
    console.error(`  }`);
    process.exit(1);
  }

  return { url, secret };
}

async function refresh() {
  const { url, secret } = getWorkerConfig();

  console.log("Triggering cookie refresh...");

  try {
    const res = await fetch(`${url}/refresh`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
      },
    });

    const data = await res.json();

    if (res.ok) {
      console.log("Cookie refresh triggered successfully.");
      if (data.output) {
        try {
          const parsed = JSON.parse(data.output);
          console.log(`  Method: ${parsed.method || "unknown"}`);
          console.log(`  Timestamp: ${parsed.timestamp || "unknown"}`);
        } catch {
          console.log(`  Output: ${data.output}`);
        }
      }
    } else {
      console.error(`Refresh failed: ${data.error || res.statusText}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`Request failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

async function status() {
  const { url } = getWorkerConfig();

  try {
    const res = await fetch(`${url}/status`);
    const data = await res.json();

    console.log("Cookie Refresh Status");
    console.log("─────────────────────");

    if (data.last_refresh) {
      const lr = data.last_refresh;
      console.log(`Last triggered: ${lr.triggered_at || "never"}`);
      console.log(`Trigger type:   ${lr.trigger || "unknown"}`);
      console.log(`Result:         ${lr.ok ? "success" : `error: ${lr.error}`}`);
    } else {
      console.log("Last triggered: never");
    }

    if (data.cookies) {
      console.log(`\nCookie Health`);
      console.log(`─────────────`);
      console.log(`Updated at:     ${data.cookies.updated_at || "unknown"}`);
      console.log(`Has PSID:       ${data.cookies.has_psid ? "yes" : "NO"}`);
      console.log(`Has PSIDTS:     ${data.cookies.has_psidts ? "yes" : "NO"}`);
    } else {
      console.log(`\nNo cookies in KV yet.`);
    }
  } catch (err) {
    console.error(`Request failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

const command = process.argv[2];

if (command === "refresh") {
  await refresh();
} else if (command === "status") {
  await status();
} else {
  console.log(`swain-cookies - Manage cloud cookie refresh for Gemini

Usage:
  swain-cookies refresh    Trigger a cookie refresh now
  swain-cookies status     Check last refresh time and cookie health

Configuration:
  Add to ~/.config/mr-tools/secrets.json:
    "cloudflare": {
      "cookie_refresh_url": "https://cookie-refresh-trigger.<domain>.workers.dev",
      "cookie_refresh_secret": "your-shared-secret"
    }
`);
  if (command && command !== "--help" && command !== "-h") {
    process.exit(1);
  }
}
