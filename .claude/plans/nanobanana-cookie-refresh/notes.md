# Notes: Cookie Refresh Implementation Reference

## RotateCookies API Call (TypeScript)

Port this from the Python gemini-webapi library:

```typescript
const ROTATE_URL = "https://accounts.google.com/RotateCookies";

async function rotateCookies(cookies: Cookies): Promise<string | null> {
  // Build cookie string with __Secure- prefix
  const cookieHeader: Record<string, string> = {
    "__Secure-1PSID": cookies.Secure_1PSID,
  };
  if (cookies.Secure_1PSIDTS) {
    cookieHeader["__Secure-1PSIDTS"] = cookies.Secure_1PSIDTS;
  }

  const res = await fetch(ROTATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: formatCookies(cookieHeader),
    },
    body: '[000,"-0000000000000000000"]',
  });

  if (res.status === 401) {
    return null; // Session expired, need full re-auth
  }

  const setCookies = parseCookies(res.headers.getSetCookie());
  const newPSIDTS = setCookies["__Secure-1PSIDTS"];
  return newPSIDTS || null;
}
```

## Playwright Cookie Extraction (TypeScript)

```typescript
import { chromium } from "playwright";

const PROFILE_DIR = join(homedir(), ".nanobanana/playwright-profile");
const COOKIE_FILE = join(homedir(), ".nanobanana/cookies.json");

async function extractCookies(headed = false) {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !headed,
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto("https://gemini.google.com/app");

  // Check if redirected to login
  if (page.url().includes("accounts.google.com")) {
    if (!headed) {
      console.error("Google session expired. Run with --setup to log in.");
      await context.close();
      process.exit(1);
    }
    // In setup mode, wait for user to complete login
    await page.waitForURL("**/gemini.google.com/**", { timeout: 300000 });
  }

  // Extract cookies for gemini.google.com
  const cookies = await context.cookies("https://gemini.google.com");
  const psid = cookies.find(c => c.name === "__Secure-1PSID");
  const psidts = cookies.find(c => c.name === "__Secure-1PSIDTS");

  if (!psid) {
    throw new Error("Could not find __Secure-1PSID cookie");
  }

  const cookieData = {
    Secure_1PSID: psid.value,
    ...(psidts && { Secure_1PSIDTS: psidts.value }),
  };

  writeFileSync(COOKIE_FILE, JSON.stringify(cookieData, null, 2), { mode: 0o600 });
  await context.close();
  return cookieData;
}
```

## launchd Plist Template

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.mrtools.cookie-refresh</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/pete/Projects/mr-tools/tools/cookie-refresh/daily-refresh.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>3</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/Users/pete/.nanobanana/logs/refresh.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/pete/.nanobanana/logs/refresh.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/Users/pete/.local/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
```

## daily-refresh.sh Template

```bash
#!/bin/bash
# Daily cookie refresh for nanobanana
# Called by launchd at 3am

LOG_DIR="$HOME/.nanobanana/logs"
mkdir -p "$LOG_DIR"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting cookie refresh"

# Try lightweight rotation first
result=$(nanobanana --rotate --json 2>&1)
status=$(echo "$result" | jq -r '.status' 2>/dev/null)

if [ "$status" = "rotated" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') - Cookie rotation successful"
  exit 0
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') - Rotation failed ($result), trying Playwright extraction..."

# Fall back to full Playwright extraction
result=$(cookie-refresh --json 2>&1)
status=$(echo "$result" | jq -r '.status' 2>/dev/null)

if [ "$status" = "complete" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') - Playwright extraction successful"
  exit 0
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') - All refresh methods failed: $result"
exit 1
```

## Cookie file save helper

```typescript
function saveCookies(cookies: Cookies): void {
  const data = JSON.stringify(cookies, null, 2);
  writeFileSync(COOKIE_FILE, data, { mode: 0o600 });
}
```

## Cache check for rotation throttling

```typescript
function shouldRotate(): boolean {
  if (!existsSync(COOKIE_FILE)) return false;
  const stat = statSync(COOKIE_FILE);
  const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;
  return ageSeconds > 60; // Don't rotate more than once per minute
}
```
