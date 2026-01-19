# External Integrations

**Analysis Date:** 2026-01-19

## APIs & External Services

**AI & Machine Learning:**
- **xAI Grok** - Real-time X/Twitter analysis
  - SDK/Client: Direct `fetch` to OpenAI-compatible API
  - Endpoint: `https://api.x.ai/v1/chat/completions`
  - Auth: `GROK_API_KEY` or `XAI_API_KEY`
  - Tool: `tools/grok/grok.ts`

- **OpenAI GPT-Image-1** - Image generation
  - SDK/Client: Direct `fetch` to API
  - Endpoint: `https://api.openai.com/v1/images/generations`
  - Auth: `OPENAI_API_KEY`
  - Tool: `tools/gpt-image-gen/`

- **Replicate** - AI model hosting
  - SDK/Client: `replicate` npm package
  - Auth: `REPLICATE_API_KEY` or `REPLICATE_API_TOKEN`
  - Tool: `tools/replicate/replicate.ts`

- **Anthropic Claude** - Session querying for rewind/jump
  - SDK/Client: `@anthropic-ai/claude-agent-sdk`
  - Auth: Uses local Claude Code executable
  - Tools: `tools/rewind/rewind.ts`, `tools/jump/jump.ts`

- **Google Gemini 3 Pro** - Image generation/editing (via cookies)
  - SDK/Client: `gemini-webapi` Python package + direct HTTP
  - Endpoint: `https://gemini.google.com/_/BardChatUi/data/...`
  - Auth: Browser cookies (`~/.nanobanana/cookies.json`)
  - Tool: `tools/nanobanana/nanobanana.py`

**Communication:**
- **Gmail** - Email management
  - SDK/Client: Direct `fetch` to Gmail API v1
  - Endpoint: `https://gmail.googleapis.com/gmail/v1/`
  - Auth: OAuth 2.0 (`google.client_id`, `google.client_secret`)
  - Token storage: `~/.config/tool-library/gmail/token.json`
  - Tool: `tools/gmail/gmail.ts`

- **Slack** - Channel messaging
  - SDK/Client: Direct `fetch` to Slack API
  - Endpoint: `https://slack.com/api/chat.postMessage`
  - Auth: `SLACK_BOT_TOKEN` (requires `chat:write`, `chat:write.public` scopes)
  - Tools: `tools/slack-send/`, `tools/slack-read/`, `tools/slack-create-channel/`

- **Typefully** - Social media scheduling
  - SDK/Client: Direct `fetch`
  - Endpoint: `https://api.typefully.com/v1`
  - Auth: `TYPEFULLY_API_KEY`
  - Tool: `tools/typefully/typefully.ts`

**Scheduling & Calendar:**
- **Google Calendar** - Event management
  - SDK/Client: Direct `fetch` to Calendar API v3
  - Endpoint: `https://www.googleapis.com/calendar/v3/`
  - Auth: OAuth 2.0 (shared with Gmail)
  - Token storage: `~/.config/tool-library/google-calendar/token.json`
  - Tool: `tools/google-calendar/gcal.ts`

- **Cal.com** - Booking management
  - SDK/Client: Direct `fetch`
  - Endpoint: `https://api.cal.com/v1`
  - Auth: `CALCOM_API_KEY`
  - Tool: `tools/cal-com/cal-com.ts`

**Location & Maps:**
- **Google Maps** - Geocoding, directions, places
  - SDK/Client: Direct `fetch` to Maps APIs
  - Endpoints:
    - `https://maps.googleapis.com/maps/api/geocode/json`
    - `https://maps.googleapis.com/maps/api/directions/json`
    - `https://maps.googleapis.com/maps/api/place/textsearch/json`
    - `https://maps.googleapis.com/maps/api/timezone/json`
    - `https://maps.googleapis.com/maps/api/elevation/json`
  - Auth: `GOOGLE_MAPS_API_KEY`
  - Tool: `tools/google-maps/google-maps.ts`

**Payments & Commerce:**
- **Square** - Payments, customers, catalog, orders
  - SDK/Client: Direct `fetch`
  - Endpoints:
    - Production: `https://connect.squareup.com/v2`
    - Sandbox: `https://connect.squareupsandbox.com/v2`
  - Auth: `SQUARE_ACCESS_TOKEN`
  - Tool: `tools/square/square.ts`

**File Storage:**
- **UploadThing** - File uploads
  - SDK/Client: Direct `fetch` with FormData
  - Endpoint: `https://uploadthing.com/api/upload`
  - Auth: `UPLOADTHING_API_KEY`
  - Tool: `tools/uploadthing/uploadthing.ts`

## Data Storage

**Databases:**
- None - Tools are stateless CLI utilities

**File Storage:**
- Local filesystem for:
  - Generated images (`~/.nanobanana/images/`)
  - OAuth tokens (`~/.config/tool-library/`)
  - Secrets (`~/.config/mr-tools/secrets.json`)
  - Checkpoints (`.agent-checkpoints.json` per project)

**Caching:**
- OAuth token caching with automatic refresh
- No other caching mechanisms

## Authentication & Identity

**OAuth 2.0 Providers:**
- **Google** (Gmail, Calendar)
  - Flow: Authorization code with PKCE
  - Redirect: Local loopback (`http://127.0.0.1:53171/` for Gmail, `:53172/` for Calendar)
  - Token refresh: Automatic with stored refresh_token
  - Scopes:
    - Gmail: `https://www.googleapis.com/auth/gmail.readonly`
    - Calendar: `https://www.googleapis.com/auth/calendar.events`

**API Keys:**
- Most services use simple Bearer token auth
- Keys stored in `~/.config/mr-tools/secrets.json`
- Format: `{ "tool_name": { "api_key": "..." } }`

**Cookie-based:**
- Gemini (nanobanana): `__Secure-1PSID`, `__Secure-1PSIDTS`
- Extracted from Chrome browser
- Stored in `~/.nanobanana/cookies.json`

## Monitoring & Observability

**Error Tracking:**
- None - Errors printed to stderr

**Logs:**
- Console output only
- `--debug` flag in some tools for verbose output
- `--json` flag for structured error output

## CI/CD & Deployment

**Hosting:**
- Local CLI tools only
- No cloud deployment

**CI Pipeline:**
- None configured

## Environment Configuration

**Required env vars (minimum):**
- None strictly required - tools prompt for setup

**Common secrets location:**
- Primary: `~/.config/mr-tools/secrets.json`
- Legacy: `~/.config/tool-library/secrets.json` (some tools)
- OAuth tokens: `~/.config/tool-library/<tool>/token.json`

**Secret format:**
```json
{
  "grok": { "api_key": "xai-..." },
  "google": { "client_id": "...", "client_secret": "..." },
  "google_maps": { "api_key": "..." },
  "replicate": { "api_key": "..." },
  "slack-send": { "bot_token": "xoxb-..." },
  "square": { "access_token": "...", "environment": "production" },
  "cal_com": { "api_key": "..." },
  "typefully": { "api_key": "..." },
  "uploadthing": { "api_key": "..." }
}
```

## Webhooks & Callbacks

**Incoming:**
- OAuth callback servers (temporary, during auth flow only)
  - Gmail: `http://127.0.0.1:53171/`
  - Calendar: `http://127.0.0.1:53172/`

**Outgoing:**
- None

## Rate Limits & Quotas

**Known limits:**
- Square: Varies by endpoint
- Google APIs: Standard quotas apply
- Replicate: Model-specific
- Typefully: API rate limiting
- Slack: Standard API limits

**Handling:**
- `gpt-image-gen`: Built-in exponential backoff (3 retries)
- Most tools: Fail on rate limit, user retries

## Integration Patterns

**Common pattern across tools:**
```typescript
// 1. Get secret (env var priority)
const key = getSecret({ tool: "name", key: "api_key", env: ["ENV_VAR"] });

// 2. Make API call
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${key}` }
});

// 3. Handle errors
if (!res.ok || data.error) throw new Error(data.error?.message);

// 4. Output (human or JSON)
if (json) console.log(JSON.stringify(data, null, 2));
else console.log(formatted);
```

---

*Integration audit: 2026-01-19*
