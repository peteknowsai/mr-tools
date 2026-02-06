# Research: Nanobanana Cookie Refresh

## Current Architecture

### How nanobanana authenticates (tools/nanobanana/nanobanana.ts)
1. Loads cookies from `~/.nanobanana/cookies.json` (format: `{Secure_1PSID, Secure_1PSIDTS}`)
2. Fetches google.com to collect base cookies
3. Sends auth cookies to `https://gemini.google.com/app` to get SNlM0e access token
4. Uses access token + cookies to POST to StreamGenerate endpoint
5. Downloads generated image, optionally uploads to Cloudflare Images

### The problem
- `__Secure-1PSIDTS` expires quickly (5-10 min if browser tab open, ~1 month if tab closed)
- `__Secure-1PSID` (primary session) lasts much longer
- When cookies expire, nanobanana returns error silently
- Beat reporters (Captain32 card generators) call nanobanana but fail silently when cookies are stale
- Currently requires manual extraction: Chrome DevTools > Application > Cookies > copy values

### What gemini-webapi does (HanaokaYuzu/Gemini-API)
The Python library has a `rotate_1psidts()` function that:
1. POSTs to `https://accounts.google.com/RotateCookies`
2. Headers: `Content-Type: application/json`
3. Body: `[000,"-0000000000000000000"]`
4. Sends existing cookies with the request
5. Response `Set-Cookie` headers contain fresh `__Secure-1PSIDTS`
6. Caches result for 60 seconds to avoid 429 Too Many Requests
7. Runs every 540 seconds (9 minutes) in background via asyncio task

### Key code from gemini-webapi rotate_1psidts.py

```python
async def rotate_1psidts(cookies, proxy=None):
    # Cache check: don't refresh more than once per minute
    if path.is_file() and time.time() - os.path.getmtime(path) <= 60:
        return path.read_text(), None

    async with AsyncClient(http2=True, proxy=proxy) as client:
        response = await client.post(
            url="https://accounts.google.com/RotateCookies",
            headers={"Content-Type": "application/json"},
            cookies=cookies,
            content='[000,"-0000000000000000000"]',
        )
        if response.status_code == 401:
            raise AuthError
        response.raise_for_status()

        if new_1psidts := response.cookies.get("__Secure-1PSIDTS"):
            path.write_text(new_1psidts)
            return new_1psidts, response.cookies

        return None, response.cookies
```

### Cookie expiration behavior (from GitHub issue #6)
- With active browser use: __Secure-1PSIDTS expires in 5-10 minutes
- With browser tab closed after extraction: lasts over a week to ~1 month
- __Secure-1PSID (primary) lasts much longer (months)
- Recommendation: Use separate account, close browser tab immediately after extraction
- Auto-refresh caveat: "may cause you to need to re-login to your Google account in the browser"

## Existing nanobanana code analysis

### getAccessToken() already gets refreshed cookies but doesn't save them
```typescript
// Line 216-217 in nanobanana.ts
const initCookies = parseCookies(initRes.headers.getSetCookie());
const allCookies = { ...authCookies, ...initCookies };
// ^ These refreshed cookies are used in-memory only, never saved to disk
```

### Cookie file format
```json
{
  "Secure_1PSID": "g.a0006QhhEec...",
  "Secure_1PSIDTS": "sidts-CjIB7I_69D9_..."
}
```

Note: File uses `Secure_1PSID` (no `__` prefix) but HTTP cookies use `__Secure-1PSID`.

## Playwright research

### Cookie extraction capability
- `context.cookies()` can access HttpOnly cookies (unlike JavaScript `document.cookie`)
- Returns full cookie objects including httpOnly, secure, sameSite, path, domain, expires
- Works with persistent browser contexts (profile saved to disk)

### Persistent context approach
- `chromium.launchPersistentContext(userDataDir)` maintains login sessions
- Google login session persists across runs (months)
- Each run navigates to gemini.google.com, extracts fresh cookies
- Known issue: headless mode may fail to read cookies from headful sessions on macOS

### Bun compatibility
- `playwright` npm package works with Bun
- Can compile to binary with `bun build --compile`
- Binary will be large (~60-80MB) due to Bun runtime inclusion

## File paths reference

- Nanobanana source: `/Users/pete/Projects/mr-tools/tools/nanobanana/nanobanana.ts`
- Cookie file: `~/.nanobanana/cookies.json`
- Cookie file permissions: 0o600
- Secrets config: `~/.config/mr-tools/secrets.json`
- nanobanana binary: `~/.local/bin/nanobanana`
- nanobanana CLAUDE.md: `/Users/pete/Projects/mr-tools/tools/nanobanana/CLAUDE.md`
- nanobanana skill: `/Users/pete/Projects/mr-tools/.claude/skills/nanobanana/SKILL.md`

## Constants from gemini-webapi

```
ROTATE_COOKIES endpoint: https://accounts.google.com/RotateCookies
ROTATE_COOKIES headers: {"Content-Type": "application/json"}
ROTATE_COOKIES body: [000,"-0000000000000000000"]
Refresh interval: 540 seconds (9 min)
Cache duration: 60 seconds (prevent 429)
```
