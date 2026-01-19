# Phase 1: Research Validation - Research

**Researched:** 2026-01-19
**Domain:** Reverse-engineering Gemini web interface video generation (cookie-based auth)
**Confidence:** MEDIUM (investigation approach clear, outcome uncertain)

## Summary

This phase is about proving feasibility, not building. The goal: get an actual video file on Desktop using cookie-based authentication through the Gemini web interface. If it works, we have a path forward. If not, the video feature is dropped entirely (no paid API fallback).

The research reveals a **significant knowledge gap**: the `gemini-webapi` library does not support video generation, and the Gemini web interface's video endpoints are undocumented. The official Gemini API uses a well-documented polling pattern, but it requires an API key (paid). The web interface likely uses a similar pattern, but the endpoints, request formats, and retrieval mechanism are unknown.

**Primary recommendation:** Use Chrome DevTools to reverse-engineer the video generation flow on gemini.google.com. Capture the trigger request, identify the polling mechanism, and document how videos are retrieved. This is a 1-2 hour investigation that will definitively answer "can this work?"

## Investigation Approach

### What We Know

From existing `geminipro.py` testing:
- Video generation CAN be triggered via cookie auth
- Response returns placeholder text: "I'm generating your video. Check back to see when it's ready."
- Maximum 2 concurrent video generations
- No job ID or retrieval mechanism is returned in the current implementation

From the `gemini-webapi` library:
- Library does NOT support video generation (confirmed via [GitHub](https://github.com/HanaokaYuzu/Gemini-API))
- Issue #84 and #109 are feature requests for Veo support (still open)
- Library only handles text and image generation
- Uses `StreamGenerate` endpoint: `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate`

From official Gemini API (reference pattern):
- Video generation is async with polling (per [Google docs](https://ai.google.dev/gemini-api/docs/video))
- Returns operation ID immediately
- Poll until `done: true`
- Retrieve video from `generatedSamples[0].video.uri`
- Videos expire after 2 days

### Investigation Strategy

**Step 1: Browser DevTools Capture (30 min)**

1. Open Chrome, go to `https://gemini.google.com`
2. Open DevTools (F12) > Network tab
3. Clear network log, enable "Preserve log"
4. Trigger video generation: "Generate a 4-second video of ocean waves"
5. Capture:
   - Initial request URL and payload
   - Response format (does it return a job ID?)
   - Any subsequent polling requests (watch for 10s intervals)
   - Final video retrieval request when ready

**Step 2: Document Endpoints (15 min)**

For each captured request, document:
- URL (likely `BardChatUi` endpoint variants)
- HTTP method (POST, GET)
- Headers (especially auth cookies, model headers)
- Request body format
- Response body format

**Step 3: Replicate with httpx (30-45 min)**

Using the existing cookie auth from `~/.nanobanana/cookies.json`:
1. Replicate the trigger request
2. Parse response for job ID or tracking reference
3. Replicate polling requests (if discovered)
4. Replicate video retrieval request
5. Download video to Desktop

**Step 4: Document or Pivot (15 min)**

If successful:
- Document the complete lifecycle
- Note any quirks or edge cases
- Confirm video quality and format

If blocked:
- Document what was attempted
- Identify the specific blocker
- Recommend dropping the feature

### Expected Endpoints (Hypothesis)

Based on official API patterns and existing nanobanana code:

```
# Trigger (hypothesis - may differ)
POST https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate
Headers: MODEL_HEADER with Veo model ID (TBD)
Body: Prompt with video generation flag
Response: Job reference or placeholder text

# Status (hypothesis - completely unknown)
GET/POST https://gemini.google.com/_/BardChatUi/data/???/GetVideoStatus
Response: {"status": "processing|completed|failed", ...}

# Retrieval (hypothesis - likely different from official API)
GET <video_url from status response>
Response: video/mp4 binary
```

**Confidence on endpoints:** LOW - These are educated guesses based on official API patterns. Actual endpoints may be completely different.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP requests | Raw sockets | `httpx` async client | Already used in nanobanana, handles streaming |
| Cookie auth | Manual parsing | `gemini_webapi.GeminiClient` | Handles token refresh, cookie validation |
| JSON parsing | Manual string ops | `orjson` | Fast, already a dependency |
| Response unpacking | Custom parser | Existing `unpack_nested_json()` | Already handles Gemini's nested JSON format |

## Common Pitfalls

### Pitfall 1: Confusing Web Interface with Official API

**What goes wrong:** Assuming web interface uses same endpoints as official API
**Why it happens:** Official API is well-documented, tempting to assume similarity
**How to avoid:** Capture actual network traffic from gemini.google.com, don't guess
**Warning signs:** 404 errors, unexpected response formats

### Pitfall 2: Missing Model Header

**What goes wrong:** Video generation doesn't trigger, falls back to text response
**Why it happens:** Veo requires specific model header (like image gen needs MODEL_HEADER)
**How to avoid:** Capture exact headers from DevTools, including `x-goog-ext-*` headers
**Warning signs:** Response talks about videos but doesn't generate them

### Pitfall 3: Cookie Expiration During Investigation

**What goes wrong:** Auth fails mid-session
**Why it happens:** Investigation takes time, cookies may expire
**How to avoid:** Refresh cookies before starting (`nanobanana --setup`)
**Warning signs:** 401/403 errors after initial success

### Pitfall 4: Expecting Synchronous Response

**What goes wrong:** Treating video generation like image generation (immediate result)
**Why it happens:** Image gen returns URL directly, video is async
**How to avoid:** Watch for polling patterns in network traffic
**Warning signs:** "Check back later" type responses, no immediate URL

### Pitfall 5: Incomplete Network Capture

**What goes wrong:** Missing the polling or retrieval requests
**Why it happens:** Video gen takes minutes, easy to miss subsequent requests
**How to avoid:** Enable "Preserve log", wait for video to actually complete
**Warning signs:** Have trigger but no retrieval mechanism

## Code Examples

### Existing Pattern: Image Generation (for reference)

```python
# Source: /Users/pete/Projects/mr-tools/tools/nanobanana/nanobanana.py
# This is how images work - video will be different

MODEL_HEADER = {"x-goog-ext-525001261-jspb": '[1,null,null,null,"9d8ca3786ebdfbea",null,null,0,[4],null,null,2]'}

async with http_client.stream("POST", STREAM_GENERATE_URL, headers=headers, content=body) as response:
    async for chunk in response.aiter_text():
        accumulated_data += chunk
    # Parse response for image URLs
    image_urls = extract_image_urls(parsed)
```

### What Video Investigation Script Might Look Like

```python
# Pseudo-code for investigation script
# Actual implementation depends on DevTools findings

import httpx
import json
from pathlib import Path

COOKIE_FILE = Path.home() / ".nanobanana" / "cookies.json"

# Load existing cookie auth
cookies = json.loads(COOKIE_FILE.read_text())

# Headers TBD from DevTools capture
VIDEO_MODEL_HEADER = {"x-goog-ext-???": "???"}  # TO BE DISCOVERED

async def investigate_video_flow():
    async with httpx.AsyncClient(cookies=cookies) as client:
        # Step 1: Trigger (endpoint TBD)
        trigger_response = await client.post(
            "https://gemini.google.com/???",  # TO BE DISCOVERED
            headers=VIDEO_MODEL_HEADER,
            content="Generate a 4 second video of ocean waves"
        )

        # Step 2: Parse for job ID (format TBD)
        job_id = extract_job_id(trigger_response)  # TO BE DISCOVERED

        # Step 3: Poll for completion (endpoint TBD)
        while True:
            status = await client.get(f"???/{job_id}")  # TO BE DISCOVERED
            if status["done"]:
                break
            await asyncio.sleep(10)

        # Step 4: Download video (mechanism TBD)
        video_url = status["video_url"]  # TO BE DISCOVERED
        video_data = await client.get(video_url)

        # Step 5: Save to Desktop
        Path.home() / "Desktop" / "test_video.mp4").write_bytes(video_data.content)
```

## Risk Assessment

### Scenario A: Investigation Succeeds (Est. 40% probability)

- DevTools reveals clear endpoint pattern
- Job ID is extractable from response
- Polling mechanism is discoverable
- Video URL can be retrieved with cookie auth

**Outcome:** Phase 1 complete, proceed to Phase 2 implementation

### Scenario B: Partial Success (Est. 30% probability)

- Can trigger video generation
- Can identify job in some form (maybe conversation context?)
- Polling or retrieval is blocked or unclear

**Outcome:** Document findings, assess if workaround exists. May need creative approaches (e.g., scraping conversation for video embed).

### Scenario C: Investigation Fails (Est. 30% probability)

- Video retrieval requires auth not available via cookies
- Endpoints are heavily obfuscated or use client-side crypto
- Video is only accessible within web UI (canvas render, no direct URL)

**Outcome:** Document blockers, recommend dropping feature. No paid API fallback per user decision.

### Hard Constraints (from CONTEXT.md)

- Success = video file on Desktop (not just documentation)
- Cookie-based auth only (no API key fallback)
- 1-2 hour maximum investigation time
- If not obvious/straightforward, drop the feature

## Open Questions

1. **What model header triggers Veo?**
   - What we know: Image gen uses `9d8ca3786ebdfbea`, video likely different
   - What's unclear: The exact Veo model ID for web interface
   - Recommendation: Capture from DevTools

2. **How is job state tracked?**
   - What we know: Official API uses operation ID
   - What's unclear: Web interface may use conversation context, separate job system, or something else
   - Recommendation: Watch network traffic carefully during entire generation lifecycle

3. **Is video URL directly downloadable?**
   - What we know: Image URLs from `lh3.googleusercontent.com` work with any auth
   - What's unclear: Video URLs may require additional auth or be short-lived
   - Recommendation: Test URL access patterns once discovered

4. **What happens if video generation fails?**
   - What we know: 2 concurrent limit triggers error message in UI
   - What's unclear: Error response format for other failure modes
   - Recommendation: Intentionally trigger some failures to capture error formats

## Sources

### Primary (HIGH confidence)
- [gemini-webapi GitHub](https://github.com/HanaokaYuzu/Gemini-API) - Library capabilities confirmed (no video support)
- [Google Veo Documentation](https://ai.google.dev/gemini-api/docs/video) - Official API pattern (reference)
- `/Users/pete/Projects/mr-tools/tools/nanobanana/nanobanana.py` - Existing code patterns

### Secondary (MEDIUM confidence)
- [LiteLLM Veo Documentation](https://docs.litellm.ai/docs/providers/gemini/videos) - Polling pattern details
- [gemini-webapi Issues #84, #109](https://github.com/HanaokaYuzu/Gemini-API/issues) - Veo feature requests (confirms not implemented)

### Tertiary (LOW confidence, needs validation)
- Endpoint hypotheses in this document - Educated guesses, must be verified via DevTools

## Metadata

**Confidence breakdown:**
- Investigation approach: HIGH - DevTools method is proven for API reverse engineering
- Expected endpoints: LOW - All hypothetical until verified
- Success probability: MEDIUM - ~40% based on past reverse engineering patterns
- Pitfalls: HIGH - Well-documented from similar projects

**Research date:** 2026-01-19
**Valid until:** Immediately (investigation phase, not implementation reference)

---

*Phase: 01-research-validation*
*Research completed: 2026-01-19*
*Ready for planning: yes*
