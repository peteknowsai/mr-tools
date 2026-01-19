# Phase 2: Core Video Generation - Research

**Researched:** 2026-01-19
**Domain:** Reverse-engineering Gemini web interface video generation (cookie-based auth)
**Confidence:** MEDIUM - Approach is clear, but exact API format requires DevTools capture

## Summary

Phase 1 proved feasibility: video generation works via cookie auth, and a video was successfully downloaded to Desktop. However, the `gemini-webapi` library is broken (Google changed the API format), so Phase 2 must build a custom HTTP client by manually capturing the exact request format via Chrome DevTools.

The good news: We have **working patterns from nanobanana.py** for image generation that can be adapted. The bad news: No existing library or documentation covers the web interface's video generation endpoints. This is a reverse-engineering task, not an integration task.

**Primary recommendation:** Use Chrome DevTools to capture the video generation request flow, then adapt nanobanana.py's HTTP patterns for video. The key unknowns are: (1) the model header for Veo/video mode, (2) whether video uses a different endpoint or just different parameters, and (3) how to poll for completion and retrieve the video URL.

## Standard Stack

The established libraries/tools for this phase:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx | >=0.24.0 | Async HTTP client | Already used in nanobanana, handles streaming |
| orjson | >=3.9.0 | Fast JSON serialization | Already a dependency, handles nested structures |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gemini-webapi | >=1.17.0 | Auth token acquisition ONLY | Use for cookie validation and access_token, NOT for generate_content |
| browser-cookie3 | >=0.19.0 | Cookie extraction | Only for `--setup` command |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| gemini-webapi for generation | Custom HTTP client | Library is broken, custom client necessary |
| requests | httpx | httpx is async, already in use, better for streaming |
| Google GenAI SDK | Cookie-based | SDK requires API key, user chose cookie auth |

**Installation:**
```bash
# Already installed in nanobanana's venv
pip install httpx orjson gemini-webapi browser-cookie3
```

## Architecture Patterns

### Recommended Project Structure
```
tools/nanobanana/
├── nanobanana.py           # Image generation (existing)
├── geminipro.py            # Text generation (existing)
├── video.py                # NEW: Video generation module
├── lib/
│   ├── __init__.py
│   ├── auth.py             # NEW: Shared cookie/token handling
│   ├── http_client.py      # NEW: Shared HTTP client patterns
│   └── response_parser.py  # NEW: Shared response parsing
└── setup.sh                # Existing setup script
```

### Pattern 1: Auth-Then-Raw-HTTP (from nanobanana.py)

**What:** Use gemini-webapi ONLY for authentication, then make direct HTTP requests
**When to use:** Always (gemini-webapi's generate_content is broken)
**Example:**
```python
# Source: /Users/pete/Projects/mr-tools/tools/nanobanana/nanobanana.py lines 291-326
from gemini_webapi import GeminiClient
from gemini_webapi.constants import Headers

# Step 1: Use gemini-webapi ONLY for auth
client = GeminiClient(
    secure_1psid=cookies["Secure_1PSID"],
    secure_1psidts=cookies.get("Secure_1PSIDTS")
)
await client.init(timeout=60, auto_close=False, auto_refresh=False)

# Extract what we need
access_token = client.access_token
valid_cookies = client.cookies

# Step 2: Make our own HTTP request
async with httpx.AsyncClient(
    timeout=httpx.Timeout(timeout),
    follow_redirects=True,
    cookies=valid_cookies,
) as http_client:
    async with http_client.stream("POST", STREAM_GENERATE_URL,
                                   headers=headers, content=body) as response:
        # Handle streaming response
```

### Pattern 2: Streaming Response Parsing (from nanobanana.py)

**What:** Parse Google's nested JSON streaming format
**When to use:** All responses from StreamGenerate endpoint
**Example:**
```python
# Source: /Users/pete/Projects/mr-tools/tools/nanobanana/nanobanana.py lines 118-175
def parse_streaming_response(data: str) -> list:
    """Parse streaming response chunks and unpack nested JSON strings."""
    # Remove XSSI protection prefix
    if data.startswith(")]}'"):
        data = data[4:]

    # Parse line-by-line (byte count, then JSON)
    lines = data.strip().split('\n')
    # ... process numbered lines and JSON payloads

def unpack_nested_json(obj, depth=0):
    """Recursively unpack JSON strings within the structure."""
    # Google's responses contain JSON strings inside JSON
    # This function unpacks them recursively
```

### Pattern 3: Model Header Selection

**What:** Different x-goog-ext headers for different capabilities
**When to use:** Switching between text, image, and video generation
**Example:**
```python
# Source: /Users/pete/Projects/mr-tools/tools/nanobanana/nanobanana.py line 42
# Image generation header (known working)
IMAGE_MODEL_HEADER = {
    "x-goog-ext-525001261-jspb": '[1,null,null,null,"9d8ca3786ebdfbea",null,null,0,[4],null,null,2]'
}

# Video generation header (TO BE CAPTURED via DevTools)
# Hypothesis: Similar format with different model ID
VIDEO_MODEL_HEADER = {
    "x-goog-ext-525001261-jspb": '[1,null,null,null,"<VEO_MODEL_ID>",null,null,0,[?],null,null,?]'
}
```

### Anti-Patterns to Avoid

- **Using gemini-webapi's generate_content()** - Library is broken, returns "Invalid response data received"
- **Assuming video endpoint is different from image** - Likely same StreamGenerate endpoint, different headers/params
- **Expecting synchronous video response** - Video generation is async, needs polling
- **Hard-coding model IDs** - Capture from DevTools, they change periodically

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie validation | Manual parsing | `gemini_webapi.GeminiClient.init()` | Handles token refresh, validation |
| XSSI prefix removal | String slicing | Existing `parse_streaming_response()` | Already handles edge cases |
| Nested JSON unpacking | Manual recursion | Existing `unpack_nested_json()` | Handles arbitrary depth |
| HTTP streaming | Manual buffering | `httpx.stream()` with `aiter_text()` | Proper async handling |
| Request body encoding | Manual URL encoding | `orjson.dumps()` + existing pattern | PR #209 format verified |

**Key insight:** nanobanana.py already solved 80% of the HTTP request/response handling. Reuse, don't rebuild.

## Common Pitfalls

### Pitfall 1: Missing Video Model Header

**What goes wrong:** Request succeeds but returns text about videos instead of generating one
**Why it happens:** Without the correct x-goog-ext header, Gemini defaults to chat mode
**How to avoid:** Capture exact header from DevTools when video generation triggers
**Warning signs:** Response mentions "I can generate videos" but doesn't actually do it

### Pitfall 2: Not Waiting for Async Completion

**What goes wrong:** Get placeholder response, no video URL
**Why it happens:** Video generation takes time (observed ~3s to several minutes)
**How to avoid:** Watch DevTools for polling requests after initial submission
**Warning signs:** "Your video is being generated" message without subsequent video URL

### Pitfall 3: Cookie/Token Expiration

**What goes wrong:** Auth works initially, fails after some time
**Why it happens:** Cookies and access tokens expire
**How to avoid:** Use gemini-webapi's init() for each session, refresh cookies with --setup
**Warning signs:** 401/403 errors after initial success

### Pitfall 4: Wrong Video Mode Entry Point

**What goes wrong:** Can't trigger video generation at all
**Why it happens:** Web UI has a "Create video" button that changes mode
**How to avoid:** Capture what changes in requests when clicking that button
**Warning signs:** Only getting text/image responses regardless of prompt

### Pitfall 5: Video URL Expiration

**What goes wrong:** Video URL works once, then 403/404
**Why it happens:** Video URLs from Gemini may be short-lived (official API: 2 days)
**How to avoid:** Download immediately upon receiving URL
**Warning signs:** URL works in browser but fails in script seconds later

## Code Examples

### Existing Image Request Body (verified working)

```python
# Source: /Users/pete/Projects/mr-tools/tools/nanobanana/nanobanana.py lines 99-115
def build_request_body(prompt: str, access_token: str) -> str:
    """Build the StreamGenerate request body with updated parameters."""
    import orjson

    inner = orjson.dumps([
        [prompt],  # Prompt array
        None,      # Files placeholder
        None,      # Chat metadata placeholder
    ]).decode()

    outer = orjson.dumps([None, inner]).decode()

    # PR #209 parameters: idx17=[[1]] enables image mode, idx49=14 sets params
    return f"at={access_token}&f.req={outer}&idx17=%5B%5B1%5D%5D&idx49=14"
```

### Video Request Body (HYPOTHESIS - needs DevTools verification)

```python
# HYPOTHESIS: Video mode likely uses different idx parameters
def build_video_request_body(prompt: str, access_token: str, duration: int = 8,
                              aspect_ratio: str = "16:9") -> str:
    """Build request body for video generation. FORMAT TBD via DevTools."""
    import orjson

    # Core structure likely similar to image
    inner = orjson.dumps([
        [prompt],
        None,
        None,
    ]).decode()

    outer = orjson.dumps([None, inner]).decode()

    # UNKNOWN: What idx parameters enable video mode?
    # Need to capture from DevTools:
    # - What idx17 value? (image uses [[1]])
    # - What idx49 value? (image uses 14)
    # - Are there video-specific parameters for duration/aspect?
    return f"at={access_token}&f.req={outer}&idx_video_params=TBD"
```

### Polling Pattern (from Official API - adapt for web interface)

```python
# Source: Official Gemini API pattern - needs adaptation for web interface
# Reference: https://ai.google.dev/gemini-api/docs/video

async def poll_for_video(http_client, operation_url: str, max_wait: int = 600) -> dict:
    """Poll until video generation completes."""
    start_time = time.time()
    poll_interval = 10  # seconds

    while time.time() - start_time < max_wait:
        response = await http_client.get(operation_url)
        status = response.json()

        if status.get("done"):
            return status

        # Display progress
        elapsed = int(time.time() - start_time)
        print(f"Generating video... {elapsed}s elapsed", file=sys.stderr)

        await asyncio.sleep(poll_interval)

    raise TimeoutError(f"Video generation timed out after {max_wait}s")
```

## DevTools Capture Protocol

This is the critical investigation step for Phase 2.

### Step 1: Setup

1. Open Chrome, go to `https://gemini.google.com`
2. Ensure logged in with AI Pro subscription
3. Open DevTools (F12) > Network tab
4. Enable "Preserve log" checkbox
5. Filter by "Fetch/XHR" to reduce noise

### Step 2: Trigger Video Generation

1. Click "Create a video" button (note any requests this triggers)
2. Enter prompt: "Generate a 4-second video of ocean waves"
3. Submit and watch Network tab

### Step 3: Capture These Requests

**Initial Trigger:**
- URL (likely StreamGenerate or different endpoint?)
- Full headers (especially `x-goog-ext-*`)
- Request body (what idx parameters?)
- Response (job ID? placeholder?)

**Polling (if any):**
- What URL is called repeatedly?
- What headers?
- What does response look like while processing?
- What changes when complete?

**Video Retrieval:**
- What URL returns the video?
- Is it a direct download or embedded?
- What auth is required?

### Step 4: Document in Code

```python
# After capture, fill in these blanks:
VIDEO_GENERATE_URL = "???"  # Likely StreamGenerate
VIDEO_MODEL_HEADER = {"x-goog-ext-525001261-jspb": "???"}
VIDEO_BODY_PARAMS = "idx_???=???"
VIDEO_POLL_URL = "???"  # If different from trigger
VIDEO_RETRIEVAL_PATTERN = "???"  # URL pattern or embedded location
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| gemini-webapi library | Custom HTTP client | Dec 2025 | Library broken, must build custom |
| Veo 2 | Veo 3.1 | Oct 2025 | Better quality, 4k support |
| x-goog-ext [4] format | Extended format with metadata | Late 2024 | Header format more complex |

**Deprecated/outdated:**
- `gemini-webapi.generate_content()` for any generation - Broken as of late 2025
- Old `MODEL_HEADER = {"x-goog-ext-525001261-jspb": "[4]"}` - Too simple, doesn't work

## Open Questions

1. **What is the Veo model header?**
   - What we know: Image uses `"9d8ca3786ebdfbea"`
   - What's unclear: Video model ID and header format
   - Recommendation: Capture from DevTools when clicking "Create video"

2. **Is video async with polling or streaming completion?**
   - What we know: Official API uses polling
   - What's unclear: Web interface might use SSE, WebSocket, or polling
   - Recommendation: Watch Network tab for repeated requests after trigger

3. **Where does the video URL come from?**
   - What we know: Image URLs are in response JSON at known paths
   - What's unclear: Video URL location in response structure
   - Recommendation: Capture full response when video is ready

4. **Can duration/aspect ratio be specified?**
   - What we know: Official API supports 4s/6s/8s and 16:9/9:16
   - What's unclear: Web interface parameters
   - Recommendation: Try different prompts, look for UI options

5. **What triggers video mode vs image mode?**
   - What we know: Web UI has a "Create video" button
   - What's unclear: What request/parameter changes
   - Recommendation: Compare network traffic before/after clicking button

## Sources

### Primary (HIGH confidence)
- `/Users/pete/Projects/mr-tools/tools/nanobanana/nanobanana.py` - Working HTTP patterns for image generation
- `/Users/pete/Projects/mr-tools/.planning/research/video-generation-findings.md` - Phase 1 proof of concept results
- [Google Veo Documentation](https://ai.google.dev/gemini-api/docs/video) - Official API pattern reference

### Secondary (MEDIUM confidence)
- [gpt4free/Gemini.py](https://github.com/xtekky/gpt4free/blob/main/g4f/Provider/needs_auth/Gemini.py) - Model header examples (no video support)
- [HanaokaYuzu/Gemini-API](https://github.com/HanaokaYuzu/Gemini-API) - Library architecture reference (broken but useful patterns)
- [LiteLLM Veo Docs](https://docs.litellm.ai/docs/providers/gemini/videos) - Polling pattern reference

### Tertiary (LOW confidence, needs validation)
- Video model header hypotheses - Pure speculation until DevTools capture
- Polling endpoint hypotheses - Unknown if web interface uses same pattern as official API

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Same libraries as working image generation
- Architecture: HIGH - Extending known patterns
- Pitfalls: MEDIUM - Based on general knowledge, not video-specific experience
- Video API format: LOW - Requires DevTools capture to verify

**Research date:** 2026-01-19
**Valid until:** Until DevTools capture completes (findings may invalidate hypotheses)

---

*Phase: 02-core-video-generation*
*Research completed: 2026-01-19*
*Ready for planning: Yes (with DevTools capture as first task)*
