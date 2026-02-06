# Notes: Cloud Cookie Refresh Implementation

## Sprites API Reference

```bash
# Create sprite
sprite create gemini-cookie-refresher

# SSH into sprite
sprite console -s gemini-cookie-refresher

# Execute command remotely (what the Worker will call)
sprite exec -s gemini-cookie-refresher "node /opt/cookie-refresh/refresh.js"

# Port forward (for initial Google login)
sprite proxy -s gemini-cookie-refresher 9222

# Create checkpoint
sprite checkpoint create -s gemini-cookie-refresher

# REST API equivalent (for Worker to call)
# POST https://api.sprites.dev/v1/sprites/gemini-cookie-refresher/exec
# Authorization: Bearer <SPRITES_TOKEN>
# Body: {"command": "node /opt/cookie-refresh/refresh.js"}
```

## Existing RotateCookies Logic (from nanobanana.ts:190-242)

```typescript
// Key rotation logic to port to refresh.js:
const ROTATE_URL = "https://accounts.google.com/RotateCookies";

// Cookie header mapping (file keys → HTTP cookie names)
// Secure_1PSID → __Secure-1PSID
// Secure_1PSIDTS → __Secure-1PSIDTS

// POST body (magic value, do not modify)
const body = '[000,"-0000000000000000000"]';

// Content-Type: application/json
// Send current cookies as Cookie header
// Fresh __Secure-1PSIDTS comes back in Set-Cookie header
// 401 = session expired, need full Playwright re-auth
// 429 = too frequent, back off
```

## Cloudflare KV API

```bash
# Write to KV (what refresh.js will use)
curl -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/gemini" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{"Secure_1PSID": "...", "Secure_1PSIDTS": "...", "updated_at": "2026-02-06T..."}'

# Read from KV (what Swain instances will use)
curl "https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/gemini" \
  -H "Authorization: Bearer {api_token}"
```

## Worker Cron Configuration

```jsonc
// wrangler.jsonc
{
  "name": "cookie-refresh-trigger",
  "main": "src/index.ts",
  "compatibility_date": "2026-02-06",
  "triggers": {
    "crons": ["0 */6 * * *"]  // Every 6 hours
  },
  "kv_namespaces": [
    {
      "binding": "GEMINI_COOKIES",
      "id": "<namespace-id>"
    }
  ]
}
```

## Playwright Persistent Context (for Sprite)

```javascript
// Inside the Sprite's refresh.js
const { chromium } = require('playwright');

async function fullReAuth() {
  const context = await chromium.launchPersistentContext(
    '/opt/cookie-refresh/playwright-profile/',
    { headless: true }  // headed for initial setup
  );

  const page = await context.newPage();
  await page.goto('https://gemini.google.com');

  // Check if we're logged in or on login page
  const url = page.url();
  if (url.includes('accounts.google.com')) {
    throw new Error('Google session expired. Manual re-login required.');
  }

  // Extract cookies
  const cookies = await context.cookies('https://gemini.google.com');
  const psid = cookies.find(c => c.name === '__Secure-1PSID');
  const psidts = cookies.find(c => c.name === '__Secure-1PSIDTS');

  await context.close();

  return {
    Secure_1PSID: psid?.value,
    Secure_1PSIDTS: psidts?.value,
  };
}
```

## Secrets Configuration

### Sprite needs:
- Cloudflare API token (for KV write): stored at `/opt/cookie-refresh/config.json`

### Worker needs (wrangler secrets):
- `SPRITES_TOKEN` — Fly.io API token for waking the Sprite
- `REFRESH_SECRET` — Shared secret for on-demand `/refresh` endpoint auth

### Swain instances need:
- Cloudflare API token (for KV read): already in `~/.config/mr-tools/secrets.json`
- KV namespace ID: add to secrets.json under `cloudflare.kv_namespace_id`

## Initial Setup Procedure (for SETUP.md)

1. Create the Sprite: `sprite create gemini-cookie-refresher`
2. SSH in: `sprite console -s gemini-cookie-refresher`
3. Install deps: `apt update && apt install -y chromium-browser nodejs npm`
4. Install Playwright: `cd /opt/cookie-refresh && npm init -y && npm install playwright`
5. Install Chromium for Playwright: `npx playwright install chromium`
6. Deploy refresh.js and config
7. Port-forward for login: `sprite proxy -s gemini-cookie-refresher 9222`
8. Run headed browser setup to log into Google
9. Test headless refresh: `node /opt/cookie-refresh/refresh.js --debug`
10. Checkpoint: `sprite checkpoint create -s gemini-cookie-refresher`
11. Deploy Worker: `cd tools/cookie-cloud/worker && wrangler deploy`
12. Test cron: `curl -X POST https://cookie-refresh.<domain>/refresh`
