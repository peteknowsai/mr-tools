# Research: Gemini Cloud Cookie Refresh

## Current State

### How nanobanana works today
- `nanobanana.ts` uses cookie-based auth (`__Secure-1PSID` + `__Secure-1PSIDTS`) to call Gemini 3 Pro
- `rotateCookies()` calls Google's undocumented `RotateCookies` endpoint to refresh `__Secure-1PSIDTS`
- This rotation happens before every image generation and via a daily launchd job at 3am
- When `__Secure-1PSID` expires (rare, every few months), a full re-auth via Playwright is needed
- `cookie-refresh --setup` opens headed browser for manual Google login

### The problem
- Cookie rotation runs on Pete's laptop via launchd — laptop must be open and awake
- When `__Secure-1PSID` fully expires, manual intervention is required
- If laptop is closed/sleeping at 3am, the daily job doesn't run
- Captain32 agents depend on nanobanana — cookie failures cause silent image generation failures

### Existing files
- `tools/nanobanana/nanobanana.ts` — 657 lines, the main CLI tool
- `tools/cookie-refresh/` — was cleaned up in recent commit (Playwright remnants removed)
- `~/.nanobanana/cookies.json` — cookie storage
- `~/Library/LaunchAgents/com.mrtools.cookie-refresh.plist` — launchd daily job
- `bin/nanobanana` — wrapper script
- `~/.local/bin/nanobanana` — installed binary

## Cloud Options Researched

### Option A: Fly.io Sprites (Pete's suggestion)
- **What**: Persistent Linux VMs that hibernate when idle, wake on demand
- **CLI**: `sprite` already installed at `~/.local/bin/sprite`
- **Specs**: 8GB RAM, 8 CPUs, 100GB durable root filesystem, root access
- **Cost**: ~$0.46 per 4-hour session, near-zero when hibernating
- **Can install Chrome**: Yes — full Linux VM with root, can `apt install chromium-browser`
- **Persistent storage**: Yes — filesystem persists across hibernation
- **API**: REST API + CLI for creating sprites, running commands, managing services
- **Pre-installed**: Node.js 22.20, Python 3.13, Claude Code, etc.
- **Startup**: ~1-2 seconds from hibernation

### Option B: Cloudflare Workers + Browser Rendering
- **What**: Serverless Puppeteer in Workers
- **Limits**: 2 concurrent browsers, 10 min/day on free plan, 60s page timeout
- **Cookie persistence**: None — no state between sessions, incognito by default
- **Google login**: Would need to pass cookies in, can't maintain a persistent session
- **Verdict**: NOT suitable — can't maintain a persistent Google login session

### Option C: Self-hosted VPS (DigitalOcean, Hetzner, etc.)
- Always running = always paying (~$5-12/month)
- More ops overhead (security patches, monitoring)
- Pete didn't suggest this

## Sprites API Key Details

```bash
# Create a sprite
sprite create gemini-cookie-refresher

# SSH into it
sprite console -s gemini-cookie-refresher

# Run a command via API
curl -X POST https://api.sprites.dev/v1/sprites/gemini-cookie-refresher/exec \
  -H "Authorization: Bearer $SPRITES_TOKEN" \
  -d '{"command": "node /opt/cookie-refresh/refresh.js"}'

# Checkpoints (save/restore state)
sprite-env checkpoints create
sprite-env checkpoints list
sprite-env checkpoints restore <id>
```

## Decisions Made

1. **Fly.io Sprite** for cookie refresh (Option A) — persistent storage for Google login, near-zero cost when hibernating, full root access for Chromium
2. **Cloudflare KV** as central cookie store — all Swain instances read from KV, single source of truth
3. **Cloudflare Worker cron** triggers refresh every 6 hours — free, reliable, wakes the Sprite via API
4. **On-demand refresh** via CLI command that hits the Worker endpoint
5. **No more local rotation** — Swain reads from KV only, `rotateCookies()` removed from nanobanana.ts
6. **Initial Google login** via Sprite port-forward with `sprite proxy`
7. **Failure handling**: log only for now, notifications can be added later

## Key Technical Considerations

1. **Google login persistence**: Sprites have persistent storage, so a Playwright browser profile stored on disk survives hibernation. Log in once and the session persists.

2. **Sprites hibernate after 30s idle**: Internal cron won't fire. External trigger (Cloudflare Worker cron) wakes the Sprite via Sprites exec API.

3. **Self-healing**: If RotateCookies returns 401, the Sprite automatically falls back to full Playwright re-auth using the persistent browser profile. Only fails if Google session in the profile itself expires (rare, requires manual re-login).

4. **Cost**: Sprite runs ~1 min per refresh, 4x daily ≈ $0.24/month. Worker cron and KV reads included in existing Cloudflare plan.
