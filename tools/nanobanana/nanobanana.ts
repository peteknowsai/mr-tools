#!/usr/bin/env bun
/**
 * nanobanana - Generate images using Gemini 3 Pro
 *
 * Uses cookie-based auth from your Google AI Pro subscription.
 * Port of the Python version to Bun for easier packaging.
 *
 * Usage:
 *   nanobanana "a friendly robot"              # Generate image (local)
 *   nanobanana --cloudflare "prompt"           # Upload to Cloudflare Images
 *   nanobanana --rotate                        # Refresh cookies only
 *   nanobanana --json "prompt"                 # JSON output for agents
 *   nanobanana -o logo -d /tmp "prompt"        # Custom output
 */

import { parseArgs } from "util";
import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from "fs";

// Cloudflare secrets path
const SECRETS_FILE = join(homedir(), ".config/mr-tools/secrets.json");

// Config paths
const CONFIG_DIR = join(homedir(), ".nanobanana");
const COOKIE_FILE = join(CONFIG_DIR, "cookies.json");
const DEFAULT_OUTPUT_DIR = join(CONFIG_DIR, "images");

// Endpoints
const GOOGLE_URL = "https://www.google.com";
const INIT_URL = "https://gemini.google.com/app";
const GENERATE_URL = "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate";
const ROTATE_URL = "https://accounts.google.com/RotateCookies";

// Headers
const GEMINI_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
  "Host": "gemini.google.com",
  "Origin": "https://gemini.google.com",
  "Referer": "https://gemini.google.com/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "X-Same-Domain": "1",
};

// Gemini 3 Pro model header
const MODEL_HEADER = {
  "x-goog-ext-525001261-jspb": '[1,null,null,null,"9d8ca3786ebdfbea",null,null,0,[4]]',
};

interface Cookies {
  Secure_1PSID: string;
  Secure_1PSIDTS?: string;
}

interface GenerateResult {
  status: "complete" | "error";
  filepath?: string;
  url?: string;
  id?: string;
  error?: string;
}

interface CloudflareConfig {
  account_id: string;
  images_token: string;
}

/**
 * Load Cloudflare credentials from secrets
 */
function loadCloudflareConfig(): CloudflareConfig | null {
  if (!existsSync(SECRETS_FILE)) {
    return null;
  }
  try {
    const data = readFileSync(SECRETS_FILE, "utf-8");
    const secrets = JSON.parse(data);
    if (secrets.cloudflare?.account_id && secrets.cloudflare?.images_token) {
      return {
        account_id: secrets.cloudflare.account_id,
        images_token: secrets.cloudflare.images_token,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Upload image to Cloudflare Images
 */
async function uploadToCloudflare(
  imageData: ArrayBuffer,
  config: CloudflareConfig,
  debug: boolean = false
): Promise<{ url: string; id: string }> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.account_id}/images/v1`;

  // Create form data with the image
  const formData = new FormData();
  formData.append("file", new Blob([imageData], { type: "image/png" }), "image.png");

  if (debug) console.error(`Uploading to Cloudflare Images...`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.images_token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudflare upload failed: HTTP ${res.status} - ${text}`);
  }

  const json = await res.json() as {
    success: boolean;
    result?: { id: string; variants: string[] };
    errors?: { message: string }[];
  };

  if (!json.success || !json.result) {
    const errMsg = json.errors?.[0]?.message || "Unknown error";
    throw new Error(`Cloudflare upload failed: ${errMsg}`);
  }

  if (debug) console.error(`Uploaded: ${json.result.id}`);

  return {
    id: json.result.id,
    url: json.result.variants[0], // First variant is the public URL
  };
}

/**
 * Load cookies from config file
 */
function loadCookies(): Cookies | null {
  if (!existsSync(COOKIE_FILE)) {
    return null;
  }
  try {
    const data = readFileSync(COOKIE_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Format cookies for fetch headers
 */
function formatCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/**
 * Parse Set-Cookie headers into a cookie object
 */
function parseCookies(setCookieHeaders: string[]): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const header of setCookieHeaders) {
    const match = header.match(/^([^=]+)=([^;]*)/);
    if (match) {
      cookies[match[1]] = match[2];
    }
  }
  return cookies;
}

/**
 * Save cookies to disk with 0o600 permissions.
 * Only writes if the file doesn't exist or values changed.
 */
function saveCookies(cookies: Cookies): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2), { mode: 0o600 });
}

/**
 * Rotate __Secure-1PSIDTS cookie via Google's RotateCookies endpoint.
 * Returns updated cookies if rotation succeeded, or original cookies if skipped/failed.
 * Uses mtime of cookie file as cache: won't rotate more than once per 60 seconds.
 */
async function rotateCookies(cookies: Cookies, debug = false): Promise<Cookies> {
  // Cache check: skip if cookie file was modified less than 60 seconds ago
  if (existsSync(COOKIE_FILE)) {
    const stat = statSync(COOKIE_FILE);
    const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;
    if (ageSeconds <= 60) {
      if (debug) console.error("Cookie rotation skipped (rotated <60s ago)");
      return cookies;
    }
  }

  // Build cookie header with __Secure- prefix (HTTP cookie names differ from file keys)
  const cookieHeader: Record<string, string> = {
    "__Secure-1PSID": cookies.Secure_1PSID,
  };
  if (cookies.Secure_1PSIDTS) {
    cookieHeader["__Secure-1PSIDTS"] = cookies.Secure_1PSIDTS;
  }

  if (debug) console.error("Rotating cookies via RotateCookies endpoint...");

  const res = await fetch(ROTATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: formatCookies(cookieHeader),
    },
    body: '[000,"-0000000000000000000"]',
  });

  if (res.status === 401) {
    if (debug) console.error("Cookie rotation failed: 401 (session expired)");
    return cookies;
  }

  if (!res.ok) {
    if (debug) console.error(`Cookie rotation failed: HTTP ${res.status}`);
    return cookies;
  }

  const setCookies = parseCookies(res.headers.getSetCookie());
  const newPSIDTS = setCookies["__Secure-1PSIDTS"];

  if (newPSIDTS && newPSIDTS !== cookies.Secure_1PSIDTS) {
    if (debug) console.error("Got fresh __Secure-1PSIDTS");
    const updated = { ...cookies, Secure_1PSIDTS: newPSIDTS };
    saveCookies(updated);
    return updated;
  }

  if (debug) console.error("Cookie rotation: no new __Secure-1PSIDTS in response");
  return cookies;
}

/**
 * Get access token (SNlM0e) from Gemini
 */
async function getAccessToken(cookies: Cookies): Promise<{ token: string; allCookies: Record<string, string> }> {
  // First get extra cookies from google.com
  const googleRes = await fetch(GOOGLE_URL, {
    redirect: "follow",
  });
  const googleCookies = parseCookies(googleRes.headers.getSetCookie());

  // Build auth cookies
  const authCookies: Record<string, string> = {
    ...googleCookies,
    "__Secure-1PSID": cookies.Secure_1PSID,
  };
  if (cookies.Secure_1PSIDTS) {
    authCookies["__Secure-1PSIDTS"] = cookies.Secure_1PSIDTS;
  }

  // Get access token from gemini.google.com
  const initRes = await fetch(INIT_URL, {
    headers: {
      ...GEMINI_HEADERS,
      Cookie: formatCookies(authCookies),
    },
    redirect: "follow",
  });

  if (!initRes.ok) {
    throw new Error(`Failed to get access token: HTTP ${initRes.status}`);
  }

  const html = await initRes.text();
  const match = html.match(/"SNlM0e":"([^"]+)"/);
  if (!match) {
    // Debug: check what we got
    const hasWiz = html.includes("WIZ_global_data");
    const htmlPreview = html.slice(0, 500);
    throw new Error(`Could not find access token (SNlM0e) in response. hasWiz=${hasWiz}, preview=${htmlPreview.slice(0, 100)}...`);
  }

  // Merge any new cookies from the init response
  const initCookies = parseCookies(initRes.headers.getSetCookie());
  const allCookies = { ...authCookies, ...initCookies };

  return { token: match[1], allCookies };
}

/**
 * Safely get nested value from array
 */
function getNestedValue(data: any, path: number[], defaultValue: any = null): any {
  let current = data;
  for (const key of path) {
    try {
      if (current === null || current === undefined) return defaultValue;
      current = current[key];
    } catch {
      return defaultValue;
    }
  }
  return current ?? defaultValue;
}

/**
 * Extract JSON from Google's response format
 */
function extractJsonFromResponse(text: string): any[] {
  for (const line of text.split("\n")) {
    try {
      const parsed = JSON.parse(line.trim());
      if (Array.isArray(parsed)) return parsed;
    } catch {
      continue;
    }
  }
  throw new Error("Could not find valid JSON in response");
}

interface GenerateOptions {
  prompt: string;
  outputDir: string;
  filename: string;
  debug?: boolean;
  cloudflare?: boolean;
}

/**
 * Generate an image using Gemini 3 Pro
 */
async function generateImage(opts: GenerateOptions): Promise<GenerateResult> {
  const { prompt, outputDir, filename, debug = false, cloudflare = false } = opts;
  let cookies = loadCookies();
  if (!cookies) {
    return { status: "error", error: "No cookies. Run setup first." };
  }
  if (!cookies.Secure_1PSID) {
    return { status: "error", error: "Invalid cookies. Missing Secure_1PSID." };
  }

  try {
    // Rotate cookies to ensure __Secure-1PSIDTS is fresh
    cookies = await rotateCookies(cookies, debug);

    // Get access token
    if (debug) console.error("Getting access token...");
    const { token, allCookies } = await getAccessToken(cookies);
    if (debug) console.error(`Got token: ${token.slice(0, 20)}...`);

    // Build request payload
    // Prepend "Generate an image of:" to trigger image generation mode
    // Append no-text suffix to prevent unwanted text/labels in generated images
    const NO_TEXT_SUFFIX = ". Pure illustration with no text, no words, no labels, no captions, no titles, no borders, no frames.";
    const generationPrompt = `Generate an image of: ${prompt}${NO_TEXT_SUFFIX}`;

    const innerPayload = JSON.stringify([
      [generationPrompt],
      null,
      null,
    ]);
    const outerPayload = JSON.stringify([null, innerPayload]);
    const body = `at=${encodeURIComponent(token)}&f.req=${encodeURIComponent(outerPayload)}`;

    if (debug) console.error(`Sending request with prompt: ${generationPrompt}`);

    // Make generate request
    const res = await fetch(GENERATE_URL, {
      method: "POST",
      headers: {
        ...GEMINI_HEADERS,
        ...MODEL_HEADER,
        Cookie: formatCookies(allCookies),
      },
      body,
    });

    if (!res.ok) {
      return { status: "error", error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const responseText = await res.text();
    if (debug) {
      console.error(`Response length: ${responseText.length} bytes`);
    }

    // Parse response to find image URLs
    const responseJson = extractJsonFromResponse(responseText);

    // Find the body part with image data
    let imageUrl: string | null = null;

    for (const part of responseJson) {
      try {
        const partBody = getNestedValue(part, [2]);
        if (!partBody || typeof partBody !== "string") continue;

        const partJson = JSON.parse(partBody);

        // Check for generated images at path [4, 0, 12, 7, 0]
        const imageData = getNestedValue(partJson, [4, 0, 12, 7, 0]);
        if (imageData && Array.isArray(imageData) && imageData.length > 0) {
          // Image URL is at [0, 3, 3] within each image entry
          const url = getNestedValue(imageData[0], [0, 3, 3]);
          if (url && typeof url === "string" && url.startsWith("https://")) {
            imageUrl = url;
            break;
          }
        }
      } catch {
        continue;
      }
    }

    if (!imageUrl) {
      // Check if it returned text instead of an image
      let textResponse = "";
      for (const part of responseJson) {
        try {
          const partBody = getNestedValue(part, [2]);
          if (!partBody || typeof partBody !== "string") continue;
          const partJson = JSON.parse(partBody);
          const text = getNestedValue(partJson, [4, 0, 1, 0]);
          if (text && typeof text === "string") {
            textResponse = text.slice(0, 100);
            break;
          }
        } catch {
          continue;
        }
      }

      if (debug && responseText.length < 10000) {
        const debugFile = join(outputDir, `${filename}_debug.txt`);
        mkdirSync(outputDir, { recursive: true });
        writeFileSync(debugFile, responseText);
        console.error(`Debug saved to ${debugFile}`);
      }

      return {
        status: "error",
        error: textResponse
          ? `No image generated. Response: ${textResponse}...`
          : "No image URL found in response"
      };
    }

    if (debug) console.error(`Found image URL: ${imageUrl.slice(0, 60)}...`);

    // Download image - add =s2048 for full size, manually follow redirects with cookies
    const fullSizeUrl = `${imageUrl}=s2048`;
    if (debug) console.error(`Downloading from: ${fullSizeUrl.slice(0, 80)}...`);

    const downloadHeaders = {
      Cookie: formatCookies(allCookies),
      Referer: "https://gemini.google.com/",
      "User-Agent": GEMINI_HEADERS["User-Agent"],
    };

    // Follow redirects manually to propagate cookies across domains
    let currentUrl = fullSizeUrl;
    let imgRes: Response;
    let redirectCount = 0;
    const maxRedirects = 10;

    while (redirectCount < maxRedirects) {
      imgRes = await fetch(currentUrl, {
        headers: downloadHeaders,
        redirect: "manual", // Don't auto-follow, we need to propagate cookies
      });

      if (debug) console.error(`  ${currentUrl.slice(0, 60)}... -> ${imgRes.status}`);

      if (imgRes.status >= 300 && imgRes.status < 400) {
        const location = imgRes.headers.get("location");
        if (!location) break;
        currentUrl = location.startsWith("http") ? location : new URL(location, currentUrl).href;
        redirectCount++;
      } else {
        break;
      }
    }

    if (debug) console.error(`Final response: ${imgRes!.status} ${imgRes!.statusText}`);

    if (!imgRes.ok) {
      return { status: "error", error: `Failed to download image: HTTP ${imgRes.status}` };
    }

    const imageData = await imgRes.arrayBuffer();

    // Upload to Cloudflare or save locally
    if (cloudflare) {
      const cfConfig = loadCloudflareConfig();
      if (!cfConfig) {
        return { status: "error", error: "Cloudflare not configured. Add cloudflare.account_id and cloudflare.images_token to ~/.config/mr-tools/secrets.json" };
      }

      try {
        const result = await uploadToCloudflare(imageData, cfConfig, debug);
        return { status: "complete", url: result.url, id: result.id };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return { status: "error", error };
      }
    } else {
      // Save locally
      mkdirSync(outputDir, { recursive: true });
      const filepath = join(outputDir, `${filename}.png`);
      writeFileSync(filepath, Buffer.from(imageData));

      if (debug) console.error(`Saved to ${filepath}`);

      return { status: "complete", filepath };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { status: "error", error };
  }
}

/**
 * Show setup instructions
 */
function showSetup(): void {
  console.log(`nanobanana - Cookie Setup

To use nanobanana, you need cookies from your Google AI Pro subscription.

Option 1: Manual setup (recommended)
  1. Go to https://gemini.google.com in Chrome (logged in with AI Pro)
  2. Open DevTools (F12) > Application > Cookies > gemini.google.com
  3. Copy the values of:
     - __Secure-1PSID
     - __Secure-1PSIDTS
  4. Create ${COOKIE_FILE}:
     {
       "Secure_1PSID": "paste-value-here",
       "Secure_1PSIDTS": "paste-value-here"
     }

Option 2: Use Python helper (if you have the venv)
  cd tools/nanobanana
  .venv/bin/python -c "import nanobanana; nanobanana.setup_cookies()"

Cookies expire periodically - re-run setup if you get auth errors.
`);
}

/**
 * Main CLI entry point
 */
async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      output: { type: "string", short: "o" },
      dir: { type: "string", short: "d" },
      json: { type: "boolean", default: false },
      debug: { type: "boolean", default: false },
      setup: { type: "boolean", default: false },
      rotate: { type: "boolean", default: false },
      cloudflare: { type: "boolean", short: "c", default: false },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  if (values.setup) {
    showSetup();
    process.exit(0);
  }

  if (values.rotate) {
    const debug = values.debug || false;
    const cookies = loadCookies();
    if (!cookies) {
      const result = { status: "error", error: "No cookies. Run setup first." };
      if (values.json) console.log(JSON.stringify(result));
      else console.error(`Error: ${result.error}`);
      process.exit(1);
    }
    try {
      const rotated = await rotateCookies(cookies, debug);
      const refreshed = rotated.Secure_1PSIDTS !== cookies.Secure_1PSIDTS;
      const result = { status: "rotated", refreshed };
      if (values.json) console.log(JSON.stringify(result));
      else console.log(refreshed ? "Cookies rotated successfully" : "Cookies still fresh (no rotation needed)");
      process.exit(0);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const result = { status: "error", error };
      if (values.json) console.log(JSON.stringify(result));
      else console.error(`Error: ${error}`);
      process.exit(1);
    }
  }

  if (values.help || positionals.length === 0) {
    console.log(`nanobanana - Generate images using Gemini 3 Pro

Usage:
  nanobanana "prompt"                    Generate image (save locally)
  nanobanana -c "prompt"                 Upload to Cloudflare Images
  nanobanana --rotate                    Refresh cookies (no generation)
  nanobanana --setup                     Show cookie setup instructions
  nanobanana -o name "prompt"            Custom filename
  nanobanana -d /path "prompt"           Custom output directory
  nanobanana --json "prompt"             JSON output for agents
  nanobanana --debug "prompt"            Show debug output

Options:
  -c, --cloudflare     Upload to Cloudflare Images (returns URL)
  --rotate             Rotate cookies and exit (for scheduled tasks)
  --setup              Show cookie setup instructions
  -o, --output NAME    Custom filename (no extension)
  -d, --dir PATH       Output directory
  --json               Output JSON (for programmatic use)
  --debug              Show debug information
  -h, --help           Show this help

Examples:
  nanobanana --setup
  nanobanana "a sunset over mountains"
  nanobanana --json "a friendly robot"
  nanobanana -c --json "product photo"   # Returns Cloudflare URL
  nanobanana -o logo -d ./images "company logo"
`);
    process.exit(0);
  }

  const prompt = positionals.join(" ");
  const outputDir = values.dir || DEFAULT_OUTPUT_DIR;
  const filename = values.output || new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const debug = values.debug || false;
  const cloudflare = values.cloudflare || false;

  const result = await generateImage({ prompt, outputDir, filename, debug, cloudflare });

  if (values.json) {
    console.log(JSON.stringify(result));
    process.exit(result.status === "complete" ? 0 : 1);
  } else {
    if (result.status === "complete") {
      // Show URL for Cloudflare, filepath for local
      console.log(result.url || result.filepath);
      process.exit(0);
    } else {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
  }
}

main();
