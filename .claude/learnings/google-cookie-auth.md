# Google Cookie Authentication

## 2026-02-05 — Nanobanana cookie auto-refresh (PR #1)

### RotateCookies endpoint
- Google has an undocumented `https://accounts.google.com/RotateCookies` endpoint
- POST with `Content-Type: application/json`, body `[000,"-0000000000000000000"]`
- Send current `__Secure-1PSID` and `__Secure-1PSIDTS` as cookies
- Response `Set-Cookie` contains fresh `__Secure-1PSIDTS`
- Used by the popular `gemini-webapi` Python library
- 401 = session expired, need full re-auth

### Cookie expiration behavior
- `__Secure-1PSIDTS` expires quickly (5-10 min with active browser, ~1 month without)
- `__Secure-1PSID` (primary session) lasts months
- Rotating cookies may invalidate the browser session for that account
- Playwright persistent context stores its own profile — doesn't affect Chrome

### Throttling
- Cache rotation for 60 seconds minimum (use cookie file mtime)
- Rotating too frequently triggers 429 Too Many Requests

### Playwright for full re-auth
- `chromium.launchPersistentContext()` retains login across runs
- `context.cookies()` can access HttpOnly cookies (unlike `document.cookie`)
- Playwright + Bun compilation doesn't work (native deps) — use wrapper scripts instead
- First-time setup requires headed mode for interactive Google login

### Future improvements to consider
- Add failure notifications (email/push) when daily rotation fails N consecutive times
- Validate cookie values before saving (length check)
- Replace hardcoded `waitForTimeout` with DOM element waits
- Add log rotation for `~/.nanobanana/logs/refresh.log`

## 2026-02-06 — Cloud cookie refresh (PR #2)

### Architecture: Sprite + KV + Worker
- Cookie rotation moved from Pete's laptop launchd to Fly.io Sprite VM
- Cookies stored centrally in Cloudflare KV — all nanobanana instances read from there
- Cloudflare Worker cron triggers Sprite every 6 hours
- On-demand refresh via `swain-cookies refresh` CLI

### Fly.io Sprites key learnings
- `sprite create` + `sprite exec` for headless command execution
- Sprites hibernate after 30s idle — internal cron won't fire, need external trigger
- Persistent storage survives hibernation — browser profiles persist
- Node.js 22.20 pre-installed, Playwright works after `apt install chromium` + `playwright install-deps`
- `sprite proxy <port>` for port-forwarding (used for initial headed Google login)
- `sprite exec` doesn't support shell syntax directly — use `bash -c "..."` or pass command as array

### Cloudflare KV for cookie store
- KV REST API: `GET/PUT .../storage/kv/namespaces/{id}/values/{key}`
- Separate API token needed for KV access (images_token may not have KV perms)
- Workers can bind KV directly in wrangler.jsonc — faster than REST API

### Nanobanana changes
- `loadCookies()` now async — reads from KV first, local cache as fallback
- Removed `rotateCookies()`, `saveCookies()`, `--rotate` flag
- KV config in secrets.json: `cloudflare.kv_token` + `cloudflare.kv_namespace_id`
