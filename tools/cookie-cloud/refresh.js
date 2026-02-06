#!/usr/bin/env node
/**
 * Cookie Refresh Script — runs inside a Fly.io Sprite
 *
 * Two-tier approach:
 *   1. RotateCookies endpoint (fast, no browser)
 *   2. Playwright persistent browser profile (fallback for full re-auth)
 *
 * After refresh, writes cookies to Cloudflare KV (central store)
 * and to a local backup file.
 *
 * Usage:
 *   node refresh.js                  # Normal refresh
 *   node refresh.js --debug          # Verbose output
 *   node refresh.js --force-playwright  # Skip RotateCookies, go straight to browser
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// Paths
const CONFIG_FILE = "/opt/cookie-refresh/config.json";
const COOKIE_FILE = "/opt/cookie-refresh/cookies.json";
const PROFILE_DIR = "/opt/cookie-refresh/playwright-profile";
const LOG_FILE = "/var/log/cookie-refresh.log";

// Google endpoints
const ROTATE_URL = "https://accounts.google.com/RotateCookies";
const ROTATE_BODY = '[000,"-0000000000000000000"]';

// Parse CLI args
const args = process.argv.slice(2);
const DEBUG = args.includes("--debug");
const FORCE_PLAYWRIGHT = args.includes("--force-playwright");

function debug(msg) {
  if (DEBUG) console.error(`[debug] ${msg}`);
}

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  console.log(line.trim());
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    // Log dir may not exist yet
  }
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(`Config file not found: ${CONFIG_FILE}`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
}

function loadLocalCookies() {
  if (!fs.existsSync(COOKIE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(COOKIE_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function saveLocalCookies(cookies) {
  fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2), {
    mode: 0o600,
  });
}

/**
 * Write cookies to Cloudflare KV
 */
async function writeToKV(cookies, config) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.cloudflare_account_id}/storage/kv/namespaces/${config.cloudflare_kv_namespace_id}/values/gemini`;

  const payload = JSON.stringify({
    ...cookies,
    updated_at: new Date().toISOString(),
  });

  debug(`Writing to KV: ${url}`);

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${config.cloudflare_api_token}`,
      "Content-Type": "application/json",
    },
    body: payload,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV write failed: HTTP ${res.status} - ${text}`);
  }

  debug("KV write successful");
}

/**
 * Try rotating cookies via Google's RotateCookies endpoint.
 * Returns updated cookies or throws on 401 (session expired).
 */
async function rotateCookies(cookies) {
  const cookieHeader = [];
  cookieHeader.push(`__Secure-1PSID=${cookies.Secure_1PSID}`);
  if (cookies.Secure_1PSIDTS) {
    cookieHeader.push(`__Secure-1PSIDTS=${cookies.Secure_1PSIDTS}`);
  }

  debug("Calling RotateCookies endpoint...");

  const res = await fetch(ROTATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader.join("; "),
    },
    body: ROTATE_BODY,
  });

  if (res.status === 401) {
    throw new Error("SESSION_EXPIRED");
  }

  if (res.status === 429) {
    throw new Error("RATE_LIMITED");
  }

  if (!res.ok) {
    throw new Error(`RotateCookies failed: HTTP ${res.status}`);
  }

  // Parse Set-Cookie headers for fresh __Secure-1PSIDTS
  const setCookies = res.headers.getSetCookie();
  for (const header of setCookies) {
    const match = header.match(/^__Secure-1PSIDTS=([^;]*)/);
    if (match && match[1] !== cookies.Secure_1PSIDTS) {
      debug("Got fresh __Secure-1PSIDTS");
      return { ...cookies, Secure_1PSIDTS: match[1] };
    }
  }

  debug("No new PSIDTS in response (cookies may still be fresh)");
  return cookies;
}

/**
 * Full re-auth via Playwright persistent browser profile.
 * Uses the persistent context to maintain Google login across runs.
 */
async function playwrightReAuth() {
  debug("Starting Playwright re-auth...");
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
  });

  try {
    const page = await context.newPage();
    await page.goto("https://gemini.google.com", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    const url = page.url();
    debug(`Page URL after navigation: ${url}`);

    if (
      url.includes("accounts.google.com") ||
      url.includes("signin") ||
      url.includes("ServiceLogin")
    ) {
      throw new Error(
        "GOOGLE_LOGIN_REQUIRED: Google session expired in browser profile. Manual re-login required via sprite proxy."
      );
    }

    // Extract cookies
    const allCookies = await context.cookies("https://gemini.google.com");
    const psid = allCookies.find((c) => c.name === "__Secure-1PSID");
    const psidts = allCookies.find((c) => c.name === "__Secure-1PSIDTS");

    if (!psid || !psid.value) {
      throw new Error(
        "Could not find __Secure-1PSID in browser cookies. Login may be required."
      );
    }

    debug("Extracted cookies from Playwright");

    return {
      Secure_1PSID: psid.value,
      Secure_1PSIDTS: psidts?.value || "",
    };
  } finally {
    await context.close();
  }
}

async function main() {
  try {
    const config = loadConfig();
    let cookies = loadLocalCookies();
    let method = "rotate";

    if (!cookies && !FORCE_PLAYWRIGHT) {
      log("No local cookies found. Trying Playwright re-auth...");
      method = "playwright";
      cookies = await playwrightReAuth();
    } else if (FORCE_PLAYWRIGHT) {
      log("Force Playwright mode");
      method = "playwright";
      cookies = await playwrightReAuth();
    } else {
      // Try RotateCookies first
      try {
        cookies = await rotateCookies(cookies);
        method = "rotate";
      } catch (err) {
        if (err.message === "SESSION_EXPIRED") {
          log(
            "RotateCookies returned 401 (session expired). Falling back to Playwright..."
          );
          method = "playwright";
          cookies = await playwrightReAuth();
        } else if (err.message === "RATE_LIMITED") {
          log("RotateCookies rate limited (429). Skipping this run.");
          const result = {
            status: "skipped",
            reason: "rate_limited",
            timestamp: new Date().toISOString(),
          };
          console.log(JSON.stringify(result));
          process.exit(0);
        } else {
          throw err;
        }
      }
    }

    // Save locally
    saveLocalCookies(cookies);
    debug("Saved cookies locally");

    // Write to Cloudflare KV
    await writeToKV(cookies, config);

    const result = {
      status: "ok",
      method,
      timestamp: new Date().toISOString(),
    };

    log(`Cookie refresh successful (method: ${method})`);
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    const result = {
      status: "error",
      error: err.message,
      timestamp: new Date().toISOString(),
    };

    log(`Cookie refresh failed: ${err.message}`);
    console.log(JSON.stringify(result));
    process.exit(1);
  }
}

main();
