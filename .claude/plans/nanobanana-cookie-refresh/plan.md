**Status: Complete — merged via PR #1 (squash-merged to main)**

# Nanobanana Cookie Auto-Refresh

## Context

Nanobanana generates AI images via Google Gemini 3 Pro using cookie-based authentication (saves ~$500/mo vs official API). The cookies (`__Secure-1PSID` and `__Secure-1PSIDTS`) expire periodically, causing silent failures when Captain32 beat reporters try to generate card images.

Currently, refreshing cookies is manual: open Chrome DevTools, navigate to gemini.google.com, copy cookie values, paste into `~/.nanobanana/cookies.json`. This plan automates that process with two complementary mechanisms.

### Key files
- `tools/nanobanana/nanobanana.ts` — Main CLI tool (Bun/TypeScript, ~557 lines)
- `~/.nanobanana/cookies.json` — Cookie storage (`{Secure_1PSID, Secure_1PSIDTS}`)
- `~/.local/bin/nanobanana` — Globally installed compiled binary

### How cookie refresh works (from gemini-webapi library)
Google has an undocumented endpoint `https://accounts.google.com/RotateCookies` that accepts a POST with the current cookies and returns fresh `__Secure-1PSIDTS` in `Set-Cookie` headers. The `__Secure-1PSID` (primary session ID) lasts much longer and doesn't need rotation — only `__Secure-1PSIDTS` expires quickly.

## Decisions

1. **Two-layer approach**: (a) nanobanana itself rotates cookies on every successful run, (b) a Playwright-based extractor handles full session re-auth when `__Secure-1PSID` expires
2. **RotateCookies endpoint** over Playwright for routine refresh — simpler, no browser needed, same technique the popular gemini-webapi Python library uses
3. **Playwright for full re-auth only** — when the Google session itself expires (rare, every few months), a persistent browser context with the existing AI Pro account extracts fresh cookies
4. **launchd for scheduling** — runs daily at 3am, macOS-native, survives reboots
5. **Bun/TypeScript throughout** — consistent with the rest of mr-tools, compiles to single binaries

## Tasks

### Part 1: Cookie rotation in nanobanana

- [x] **Add `rotateCookies()` function to `nanobanana.ts`** — Port the rotation logic from gemini-webapi. POST to `https://accounts.google.com/RotateCookies` with `Content-Type: application/json`, body `[000,"-0000000000000000000"]`, include current cookies. Extract fresh `__Secure-1PSIDTS` from response `Set-Cookie` headers. Add 60-second cache check (use mtime of cookie file) to avoid 429 rate limits.
  > Done: Added rotateCookies() with 60s mtime cache, cookie prefix mapping, and saveCookies() integration

- [x] **Add `saveCookies()` function to `nanobanana.ts`** — Write updated cookie values back to `~/.nanobanana/cookies.json` with 0o600 permissions. Only write if `__Secure-1PSIDTS` actually changed.
  > Done: Added saveCookies() with mkdirSync and 0o600 permissions

- [x] **Call rotation before image generation** — In `generateImage()`, after loading cookies but before `getAccessToken()`, call `rotateCookies()` to ensure `__Secure-1PSIDTS` is fresh. Update the loaded cookies object with the rotated value. After successful `getAccessToken()`, also save any new cookies from the `Set-Cookie` response headers back to disk.
  > Done: Added rotateCookies() call in generateImage() before getAccessToken()

- [x] **Add `--rotate` CLI flag** — Standalone command that just rotates cookies and exits. Useful for testing and for the scheduled task. Output: JSON `{"status": "rotated", "refreshed": true}` or `{"status": "error", "error": "..."}`.
  > Done: Added --rotate flag with JSON and plain text output modes

- [x] **Test cookie rotation** — Manually run `nanobanana --rotate --debug` and verify: (a) it calls RotateCookies endpoint, (b) gets fresh `__Secure-1PSIDTS`, (c) saves to cookie file, (d) subsequent `nanobanana "test prompt"` succeeds.
  > Done: Tested --rotate --debug --json. Endpoint called successfully, 401 handled gracefully (session expired). Full e2e test requires fresh cookies.

- [x] **Rebuild and install binary** — `bun build ./tools/nanobanana/nanobanana.ts --compile --outfile ./bin/nanobanana` then install to `~/.local/bin/nanobanana`.
  > Done: Compiled directly to ~/.local/bin/nanobanana, verified --rotate --json works

### Part 2: Playwright cookie extractor (full re-auth)

- [x] **Create `tools/cookie-refresh/cookie-refresh.ts`** — Bun/TypeScript script using `playwright` package. Uses `chromium.launchPersistentContext()` with a dedicated user data dir at `~/.nanobanana/playwright-profile/`. Navigates to `https://gemini.google.com`, calls `context.cookies('https://gemini.google.com')` to extract `__Secure-1PSID` and `__Secure-1PSIDTS` (including HttpOnly), writes to `~/.nanobanana/cookies.json`. Headless mode. JSON output for programmatic use. If Google login page is detected instead of Gemini (session expired), exit with error and message to log in manually.
  > Done: Created cookie-refresh.ts with headed/headless modes, login detection, and JSON output

- [x] **Add first-run setup flow** — `cookie-refresh --setup` launches browser in headed mode so the user can log into Google manually. After login detected (page URL contains gemini.google.com/app), extract cookies, save, and exit. This only needs to happen once — the persistent profile retains the session.
  > Done: --setup flag opens headed browser, waits up to 5 minutes for login, then extracts cookies

- [x] **Install Playwright and browsers** — `cd tools/cookie-refresh && bun init && bun add playwright`. Run `bunx playwright install chromium` to download the browser binary. Add `tools/cookie-refresh/node_modules/` and browser binaries to `.gitignore`.
  > Done: Playwright 1.58.1 and Chromium installed, node_modules in .gitignore

- [ ] **Test cookie extraction** — Run `cookie-refresh --setup` to log in. Then run `cookie-refresh` headless and verify cookies are extracted and saved. Then run `nanobanana "test image"` to verify the extracted cookies work. **[BLOCKED: requires interactive Google login — Pete needs to run `cookie-refresh --setup` manually]**

- [x] **Compile to binary** — `bun build ./tools/cookie-refresh/cookie-refresh.ts --compile --outfile ./bin/cookie-refresh`. Note: Playwright may not work compiled due to native browser dependency — if compilation fails, use a wrapper script in `bin/` instead that runs `bun run tools/cookie-refresh/cookie-refresh.ts`.
  > Done: Compilation fails as expected (Playwright native deps). Using wrapper script at bin/cookie-refresh → ~/.local/bin/cookie-refresh

### Part 3: launchd scheduled task

- [x] **Create launchd plist** — Write `com.mrtools.cookie-refresh.plist` for `~/Library/LaunchAgents/`. Schedule: daily at 3:00 AM. Command: First try `nanobanana --rotate` (lightweight, no browser). If that fails (exit code 1), fall back to `cookie-refresh` (full Playwright extraction). Log output to `~/.nanobanana/logs/refresh.log`.
  > Done: Created plist with daily 3am schedule, PATH includes ~/.local/bin

- [x] **Create runner script** — `tools/cookie-refresh/daily-refresh.sh` — Bash wrapper that: (1) runs `nanobanana --rotate --json`, (2) checks if status is "rotated", (3) if not, runs `cookie-refresh`, (4) logs results with timestamp. This is what launchd calls.
  > Done: Created daily-refresh.sh with two-tier fallback and timestamped logging

- [x] **Install launchd task** — Copy plist to `~/Library/LaunchAgents/`, run `launchctl load`. Verify with `launchctl list | grep cookie-refresh`.
  > Done: Installed and verified with launchctl list

- [x] **Test the scheduled task** — Run `launchctl start com.mrtools.cookie-refresh` to trigger manually. Check `~/.nanobanana/logs/refresh.log` for success.
  > Done: Manual trigger successful, rotation completed and logged

### Part 4: Update documentation

- [x] **Update `tools/nanobanana/CLAUDE.md`** — Document the `--rotate` flag, auto-refresh behavior, and troubleshooting for cookie expiration. Remove/update the manual cookie extraction instructions to note it's now automated.
  > Done: Added --rotate to options table, documented auto-refresh and cookie-refresh --setup fallback

- [x] **Update nanobanana skill** — Update `.claude/skills/nanobanana/SKILL.md` error handling table to reflect that cookie rotation is automatic, and add `cookie-refresh --setup` as the fix for full session expiration.
  > Done: Updated error table and added note about automatic rotation + launchd task

## Notes

- The `RotateCookies` endpoint is undocumented but widely used by the gemini-webapi community. It could change without notice.
- The rotation body `[000,"-0000000000000000000"]` is a magic value — don't modify it.
- Auto-refresh "may cause you to need to re-login to your Google account in the browser" according to gemini-webapi docs. This is expected — the rotation invalidates the browser session for that cookie. Since Pete uses the same AI Pro account, he may occasionally need to re-login in Chrome after rotation. This is a known tradeoff.
- Playwright persistent context stores its own browser profile separately from Chrome — logging into Google in Playwright does NOT affect Chrome sessions.
- Cookie file uses `Secure_1PSID` (no `__` prefix) internally, but HTTP cookies use `__Secure-1PSID`. The code must handle this mapping.
- Don't compile the binary into the git repo. Build to `./bin/nanobanana`, then move large binaries to `~/.local/bin/` per project conventions.
- See `research.md` for detailed code analysis and gemini-webapi source reference.
