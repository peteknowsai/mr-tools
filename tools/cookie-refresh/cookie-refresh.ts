#!/usr/bin/env bun
/**
 * cookie-refresh - Extract Gemini cookies using Playwright
 *
 * Uses a persistent browser profile to extract __Secure-1PSID and
 * __Secure-1PSIDTS cookies from gemini.google.com. This handles
 * full session re-auth when the lightweight RotateCookies endpoint
 * (used by nanobanana --rotate) can't refresh expired sessions.
 *
 * Usage:
 *   cookie-refresh              # Extract cookies (headless)
 *   cookie-refresh --setup      # First-time login (headed browser)
 *   cookie-refresh --json       # JSON output for programmatic use
 */

import { parseArgs } from "util";
import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { chromium } from "playwright";

const PROFILE_DIR = join(homedir(), ".nanobanana/playwright-profile");
const COOKIE_FILE = join(homedir(), ".nanobanana/cookies.json");

interface CookieResult {
  status: "complete" | "error" | "login_required";
  error?: string;
}

async function extractCookies(headed = false, debug = false): Promise<CookieResult> {
  mkdirSync(PROFILE_DIR, { recursive: true });

  if (debug) console.error(`Launching browser (${headed ? "headed" : "headless"})...`);
  if (debug) console.error(`Profile: ${PROFILE_DIR}`);

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !headed,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const page = context.pages()[0] || await context.newPage();

    if (debug) console.error("Navigating to gemini.google.com...");
    await page.goto("https://gemini.google.com/app", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Check if redirected to login
    const currentUrl = page.url();
    if (debug) console.error(`Current URL: ${currentUrl}`);

    if (currentUrl.includes("accounts.google.com")) {
      if (!headed) {
        return {
          status: "login_required",
          error: "Google session expired. Run with --setup to log in manually.",
        };
      }

      // In setup mode, wait for user to complete login
      console.error("Please log in to your Google account in the browser window...");
      console.error("Waiting up to 5 minutes for login...");

      try {
        await page.waitForURL("**/gemini.google.com/**", { timeout: 300000 });
        if (debug) console.error("Login detected!");
      } catch {
        return {
          status: "error",
          error: "Login timed out after 5 minutes.",
        };
      }
    }

    // Wait a moment for cookies to stabilize
    await page.waitForTimeout(2000);

    // Extract cookies
    const cookies = await context.cookies("https://gemini.google.com");
    const psid = cookies.find(c => c.name === "__Secure-1PSID");
    const psidts = cookies.find(c => c.name === "__Secure-1PSIDTS");

    if (!psid || !psid.value) {
      return {
        status: "error",
        error: "Could not find __Secure-1PSID cookie. Is Google AI Pro active?",
      };
    }

    if (debug) {
      console.error(`Found __Secure-1PSID: ${psid.value.slice(0, 20)}...`);
      console.error(`Found __Secure-1PSIDTS: ${psidts ? psidts.value.slice(0, 20) + "..." : "(not found)"}`);
    }

    // Save to cookie file
    const cookieData: Record<string, string> = {
      Secure_1PSID: psid.value,
    };
    if (psidts?.value) {
      cookieData.Secure_1PSIDTS = psidts.value;
    }

    mkdirSync(join(homedir(), ".nanobanana"), { recursive: true });
    writeFileSync(COOKIE_FILE, JSON.stringify(cookieData, null, 2), { mode: 0o600 });

    if (debug) console.error(`Cookies saved to ${COOKIE_FILE}`);

    return { status: "complete" };
  } finally {
    await context.close();
  }
}

async function main() {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      setup: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      debug: { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(`cookie-refresh - Extract Gemini cookies using Playwright

Usage:
  cookie-refresh              Extract cookies (headless)
  cookie-refresh --setup      First-time login (opens browser)
  cookie-refresh --json       JSON output
  cookie-refresh --debug      Show debug info

The first time, run --setup to log into Google in the browser.
After that, headless mode extracts cookies from the saved profile.
`);
    process.exit(0);
  }

  const result = await extractCookies(
    values.setup || false,
    values.debug || false,
  );

  if (values.json) {
    console.log(JSON.stringify(result));
  } else {
    if (result.status === "complete") {
      console.log("Cookies extracted and saved successfully.");
    } else if (result.status === "login_required") {
      console.error(result.error);
      console.error("Run: cookie-refresh --setup");
    } else {
      console.error(`Error: ${result.error}`);
    }
  }

  process.exit(result.status === "complete" ? 0 : 1);
}

main();
