# Cloud Cookie Refresh for Gemini (nanobanana/Swain)

## Context

Nanobanana (being renamed to Swain separately) generates AI images via Google Gemini 3 Pro using cookie-based auth. The cookies (`__Secure-1PSID` and `__Secure-1PSIDTS`) expire periodically. Today, cookie rotation runs on Pete's laptop via a launchd job at 3am — if the laptop is asleep, it doesn't run. When the session fully expires, manual intervention is required.

Swain will run in "lots of places" — it needs a central, reliable, cloud-based cookie store that stays fresh without depending on any single machine being awake.

### Architecture

```
┌─────────────────────┐     every 6 hours      ┌──────────────────────┐
│  Cloudflare Worker   │ ───────────────────────▶│   Fly.io Sprite      │
│  (cron trigger)      │   Sprites exec API     │   (cookie-refresher) │
│                      │◀──────────────────────── │                      │
│  Also: on-demand     │   returns status        │  1. RotateCookies    │
│  via CLI command     │                         │  2. Playwright       │
└─────────────────────┘                         │     (fallback)       │
                                                └──────────┬───────────┘
                                                           │
                                                  writes fresh cookies
                                                           │
                                                           ▼
                                                ┌──────────────────────┐
                                                │   Cloudflare KV      │
                                                │   (cookie store)     │
                                                │                      │
                                                │   key: "gemini"      │
                                                │   val: {cookies}     │
                                                └──────────────────────┘
                                                           ▲
                                                           │ reads
                                                           │
                                                ┌──────────────────────┐
                                                │   Swain instances    │
                                                │   (anywhere)         │
                                                └──────────────────────┘
```

### Key files (existing)
- `tools/nanobanana/nanobanana.ts` — Main image generation CLI (657 lines)
- `tools/nanobanana/CLAUDE.md` — Tool documentation
- `~/.nanobanana/cookies.json` — Current local cookie storage
- `~/Library/LaunchAgents/com.mrtools.cookie-refresh.plist` — Existing launchd job (will be replaced)

### Key files (new, to be created)
- `tools/cookie-cloud/refresh.js` — Cookie refresh script that runs inside the Sprite
- `tools/cookie-cloud/worker/` — Cloudflare Worker (cron trigger + on-demand endpoint)
- `tools/cookie-cloud/setup.sh` — Sprite provisioning script

### Dependencies
- `sprite` CLI — already installed at `~/.local/bin/sprite`
- Cloudflare account — Pete already has one (used for Images uploads)
- Playwright — will be installed inside the Sprite
- Wrangler — for deploying the Worker

## Decisions

1. **Cloudflare KV as the cookie store** — All Swain instances read cookies from KV. No more local cookie files as source of truth. KV gives global edge reads with ~25ms latency.

2. **Fly.io Sprite for cookie refresh** — Persistent Linux VM with root access. Can install Chromium + Playwright. Hibernates when idle (near-zero cost). Persistent storage means Google login session survives across hibernations.

3. **Cloudflare Worker cron as the trigger** — Runs every 6 hours, calls Sprites API to wake the Sprite and execute the refresh script. Workers cron is free, reliable, and Pete already has the infrastructure.

4. **On-demand refresh via CLI** — A command (e.g., `swain-cookies refresh`) that hits the Worker endpoint, which triggers the Sprite. Simple HTTP call under the hood.

5. **Two-tier refresh inside the Sprite** — First try RotateCookies endpoint (fast, no browser). If that returns 401, fall back to Playwright with persistent browser profile for full re-auth.

6. **No local rotation in Swain** — Swain reads from KV only. Single source of truth. No more `rotateCookies()` call before each generation.

7. **Failure handling: log only** — If Playwright re-auth fails (Google session expired), log the error. Swain's own error messages will surface the problem. Notifications can be added later.

8. **Initial Google login via Sprite port-forward** — Use `sprite proxy` to forward the browser port, do the headed Google login from Pete's Mac. One-time setup.

## Tasks

### Part 1: Sprite Setup

- [x] **Create the Sprite** — Run `sprite create gemini-cookie-refresher`. Verify it's accessible with `sprite console -s gemini-cookie-refresher`.
  > Done: Created sprite in pete-mccarthy org. Verified accessible with exec. Node.js 22.20.0 pre-installed.

- [x] **Install Chromium and Playwright inside the Sprite** — SSH in and install: `apt update && apt install -y chromium-browser`. Then install Node.js Playwright: `npm install playwright`. Verify Chromium launches headless: `node -e "const {chromium} = require('playwright'); (async () => { const b = await chromium.launch(); console.log('ok'); await b.close(); })()"`.
  > Done: Installed chromium, playwright, and deps. Verified headless launch + persistent context at /opt/cookie-refresh/playwright-profile/.

- [x] **Create the cookie refresh script (`tools/cookie-cloud/refresh.js`)** — Node.js script that:
  > Done: Created tools/cookie-cloud/refresh.js with RotateCookies + Playwright fallback + KV write + local backup + JSON output + logging
  1. Tries RotateCookies endpoint (port existing logic from `nanobanana.ts` `rotateCookies()`)
  2. On 401, falls back to Playwright persistent browser profile at `/opt/cookie-refresh/playwright-profile/`
  3. On success, writes cookies to Cloudflare KV via the Workers KV API (using a Cloudflare API token)
  4. Also writes to local `/opt/cookie-refresh/cookies.json` as backup
  5. Outputs JSON status: `{"status": "ok", "method": "rotate|playwright", "timestamp": "..."}` or `{"status": "error", "error": "..."}`
  6. Logs to `/var/log/cookie-refresh.log`

- [x] **Deploy refresh script to Sprite** — Copy `tools/cookie-cloud/refresh.js` to the Sprite at `/opt/cookie-refresh/refresh.js`. Install dependencies (`playwright`). Create a `deploy-to-sprite.sh` script that rsync/scps the refresh script and installs deps.
  > Done: Created deploy-to-sprite.sh, deployed refresh.js to Sprite. Script runs and correctly errors on missing config.

- [x] **Test the refresh script inside the Sprite** — SSH in, run `node /opt/cookie-refresh/refresh.js --debug`. Verify it calls RotateCookies, gets fresh PSIDTS, writes to KV.
  > Done: Seeded with local cookies, rotation succeeded (method: rotate), cookies written to KV.

### Part 2: Initial Google Login on Sprite

- [ ] **Set up Playwright persistent profile and do first-time Google login** — Use `sprite proxy` to forward a port from the Sprite. Run Chromium in headed mode. Navigate to `gemini.google.com`, log in with Pete's Google AI Pro account. **[DEFERRED: not needed yet — seeded cookies from laptop work. Do this when session expires.]**
  > Setup docs written to tools/cookie-cloud/SETUP.md with step-by-step instructions.

- [ ] **Test Playwright re-auth flow** — After login, run the refresh script with `--force-playwright` flag. **[DEFERRED: depends on Google login above]**

### Part 3: Cloudflare Worker (Cron + On-Demand)

- [x] **Create KV namespace** — Using wrangler: `wrangler kv namespace create GEMINI_COOKIES`. Note the namespace ID for the Worker config.
  > Done: Created namespace f989ff10f7ae405b9fb68c3adaa4b7fa

- [x] **Create the Cloudflare Worker (`tools/cookie-cloud/worker/`)** — Wrangler project with:
  > Done: Created Worker with scheduled + fetch handlers, KV binding, dry-run verified
  - `wrangler.jsonc` with cron trigger every 6 hours (`"0 */6 * * *"`) and KV binding
  - `src/index.ts`:
    - `scheduled()` handler: calls Sprites API (`POST /v1/sprites/gemini-cookie-refresher/exec` with `{"command": "node /opt/cookie-refresh/refresh.js"}`) using a Sprites API token stored as a Worker secret
    - `fetch()` handler: `POST /refresh` endpoint for on-demand triggers (authenticated with a shared secret)
    - `GET /status` endpoint: reads last refresh timestamp from KV and returns health status
  - Worker secrets: `SPRITES_TOKEN` (Fly.io API token), `REFRESH_SECRET` (shared secret for on-demand endpoint)

- [x] **Deploy the Worker** — `wrangler deploy`. Verify cron is registered with `wrangler triggers list`.
  > Done: Deployed to https://cookie-refresh-trigger.peteknowsai.workers.dev, cron: 0 */6 * * *, secrets set.

- [x] **Test the cron trigger** — Manually trigger with curl. Verify the Sprite wakes, runs the refresh, and cookies appear in KV.
  > Done: POST /refresh triggered successfully, Sprite woke, cookies confirmed in KV.

### Part 4: Update Swain (nanobanana) to Read from KV

- [x] **Add KV cookie fetching to `nanobanana.ts`** — Replace the current `loadCookies()` function:
  > Done: loadCookies() now async, reads from KV first (with local cache), removed rotateCookies/saveCookies/--rotate. Compiles clean.
  - Read from Cloudflare KV via REST API: `GET https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/gemini`
  - Use Cloudflare API token from `~/.config/mr-tools/secrets.json` (already has `cloudflare` config)
  - Cache locally in `~/.nanobanana/cookies.json` to avoid hitting KV on every call (use if KV is unreachable)
  - Remove the `rotateCookies()` call from `generateImage()` — rotation is now cloud-only

- [x] **Remove `--rotate` CLI flag** — No longer needed since rotation happens in the cloud. Keep `--setup` for showing how to configure KV access.
  > Done: Removed with the KV changes above.

- [x] **Update `tools/nanobanana/CLAUDE.md`** — Document the new KV-based cookie flow, remove references to local rotation and launchd.
  > Done: Rewrote auth section with KV architecture, updated troubleshooting table, removed --rotate refs.

- [x] **Test end-to-end** — Run `nanobanana --debug "test image"`. Verify it reads from KV, gets a valid token, generates an image successfully.
  > Done: nanobanana reads from KV, generates image, saves to disk. Full pipeline verified.

### Part 5: CLI for On-Demand Refresh

- [x] **Create `bin/swain-cookies` CLI wrapper** — Simple bash/bun script that calls the Worker's `/refresh` endpoint. Reads the shared secret from `~/.config/mr-tools/secrets.json`. Usage: `swain-cookies refresh` (trigger refresh), `swain-cookies status` (check last refresh time).
  > Done: Created tools/cookie-cloud/swain-cookies.ts + bin/swain-cookies wrapper. Help output verified.

- [x] **Test the CLI** — Run `swain-cookies refresh`, verify Sprite wakes and rotates. Run `swain-cookies status`, verify it shows the last refresh timestamp.
  > Done: Both `refresh` and `status` commands work. Status shows cookie health and last trigger time.

### Part 6: Cleanup

- [x] **Remove the launchd job** — `launchctl unload ~/Library/LaunchAgents/com.mrtools.cookie-refresh.plist` and delete the plist file.
  > Done: Unloaded and deleted plist. Old cookie-refresh dir was already cleaned up.

- [x] **Update CLAUDE.md** — Remove references to the old launchd-based cookie refresh. Add documentation for the new cloud-based system.
  > Done: Main CLAUDE.md had no nanobanana refs. tools/nanobanana/CLAUDE.md was already updated in Part 4.

- [x] **Update `.claude/learnings/google-cookie-auth.md`** — Add learnings about the cloud setup.
  > Done: Added Sprites, KV, Worker architecture notes and nanobanana changes.

- [x] **Checkpoint the Sprite** — Run `sprite checkpoint create` after everything is verified working, so we can restore to a known-good state.
  > Done: Checkpoint v1 created. Restore with: `sprite restore v1`

## Notes

- **Sprites hibernation and cron**: Sprites hibernate after 30s idle. Internal cron jobs won't fire while hibernated. That's why we use an external trigger (Cloudflare Worker cron) to wake the Sprite.

- **Sprites API auth**: Need a Fly.io API token. Create one at `fly.io/dashboard` or via `fly tokens create`. Store as Worker secret.

- **KV write from Sprite**: The refresh script inside the Sprite needs a Cloudflare API token to write to KV. Store this as an env var in the Sprite or in a config file at `/opt/cookie-refresh/config.json`.

- **KV read from Swain**: Swain instances need Cloudflare API credentials to read from KV. Already available via `~/.config/mr-tools/secrets.json` on Pete's machines. For other environments, the API token needs to be provisioned.

- **Google login expiry**: The persistent browser profile in the Sprite should keep the Google session alive for months. When it does expire, Pete will need to redo the Sprite port-forward + headed login process. This should be rare.

- **RotateCookies may invalidate browser session**: As noted in learnings, rotating cookies may invalidate the Google session in the browser the cookies came from. Since the Sprite has its own Playwright profile, this doesn't affect Pete's Chrome sessions.

- **Cookie file format**: Internal format uses `Secure_1PSID` (no `__` prefix), HTTP cookies use `__Secure-1PSID`. The refresh script must handle this mapping.

- **Cost estimate**: Sprite runs ~1 min per refresh, 4x daily = ~4 min/day. At ~$0.002/min, that's ~$0.24/month. Worker cron triggers are free. KV reads/writes are included in the Workers paid plan Pete already has.
