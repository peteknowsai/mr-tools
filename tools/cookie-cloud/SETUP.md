# Cookie Cloud Setup Guide

## Prerequisites

- `sprite` CLI installed and authenticated (`sprite login`)
- Cloudflare account with KV namespace created (see Part 3 below)
- Google AI Pro account

## Part 1: Sprite is Ready

The `gemini-cookie-refresher` Sprite has been created and provisioned with:
- Node.js 22.20.0
- Chromium + Playwright
- `/opt/cookie-refresh/` working directory

## Part 2: Deploy Config

1. Create your config file locally:

```bash
cp tools/cookie-cloud/config.template.json tools/cookie-cloud/config.json
```

2. Edit `config.json` with your Cloudflare credentials:

```json
{
  "cloudflare_account_id": "your-account-id",
  "cloudflare_api_token": "your-api-token-with-kv-write",
  "cloudflare_kv_namespace_id": "your-namespace-id"
}
```

3. Deploy config to Sprite:

```bash
./tools/cookie-cloud/deploy-to-sprite.sh --with-config
```

## Part 3: Initial Google Login

This is a one-time setup. You need to log into Google in the Sprite's browser.

### Step 1: Start a headed browser on the Sprite

SSH into the Sprite:

```bash
sprite console -s gemini-cookie-refresher
```

Inside the Sprite, start a browser with remote debugging:

```bash
cd /opt/cookie-refresh
node -e "
const {chromium} = require('playwright');
(async () => {
  const ctx = await chromium.launchPersistentContext('/opt/cookie-refresh/playwright-profile/', {
    headless: false,
    args: ['--remote-debugging-port=9222']
  });
  const page = await ctx.newPage();
  await page.goto('https://gemini.google.com');
  console.log('Browser open. Log into Google, then press Ctrl+C to close.');
  // Keep running until interrupted
  await new Promise(() => {});
})();
"
```

### Step 2: Port-forward to your Mac

In another terminal:

```bash
sprite proxy -s gemini-cookie-refresher 9222
```

### Step 3: Connect from your Mac

Open Chrome on your Mac and navigate to:

```
chrome://inspect/#devices
```

Click "Configure..." and add `localhost:9222`. The Sprite's browser should appear. Click "Inspect" to see the browser page and complete the Google login.

### Step 4: Verify

After logging in, press Ctrl+C in the Sprite terminal to close the browser. Then test:

```bash
sprite exec -s gemini-cookie-refresher -- node /opt/cookie-refresh/refresh.js --force-playwright --debug
```

This should extract cookies from the browser profile and write them to KV.

## Part 4: Verify Cookie Refresh

Test the full flow:

```bash
# Test RotateCookies path
sprite exec -s gemini-cookie-refresher -- node /opt/cookie-refresh/refresh.js --debug

# Test Playwright fallback
sprite exec -s gemini-cookie-refresher -- node /opt/cookie-refresh/refresh.js --force-playwright --debug
```

## Part 5: Deploy the Worker

```bash
cd tools/cookie-cloud/worker
npm install
wrangler deploy
```

Set Worker secrets:

```bash
wrangler secret put SPRITES_TOKEN   # Your Fly.io API token
wrangler secret put REFRESH_SECRET  # Shared secret for on-demand endpoint
```

## Troubleshooting

**GOOGLE_LOGIN_REQUIRED**: The browser profile's Google session has expired. Redo Part 3 (port-forward and re-login).

**KV write failed: 403**: Check your Cloudflare API token has KV write permissions.

**RotateCookies 429**: Rate limited. Wait a few minutes and try again.
