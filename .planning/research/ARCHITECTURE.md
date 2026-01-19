# Architecture Research: Async Video Generation

**Domain:** CLI tools for Gemini 3 Pro (nanobanana/geminipro)
**Researched:** 2026-01-19
**Confidence:** HIGH

## Executive Summary

Video generation via Gemini 3 Pro (Veo 3.1) is **asynchronous by design**. The current synchronous CLI pattern (prompt → immediate response) cannot work for videos. This research defines how to extend the existing nanobanana/geminipro architecture with async polling capabilities while maintaining the CLI tool's simplicity.

**Key finding:** The Gemini web API (used by gemini-webapi library) follows a job-based polling pattern similar to the official Gemini API. Videos take minutes to generate and require status polling with 10-second intervals.

## Current Architecture

### File Structure
```
tools/nanobanana/
├── nanobanana.py          # Image generation/editing (sync)
├── geminipro.py           # Text generation (sync)
├── requirements.txt       # Shared dependencies
├── setup.sh               # Venv setup
├── CLAUDE.md              # Documentation
└── .venv/                 # Python environment
```

### Shared Components

**Authentication:**
- Cookie-based auth (shared config: `~/.nanobanana/cookies.json`)
- Cookies extracted from Chrome browser
- Both tools use `load_cookies()` and `setup_cookies()` (duplicated code)

**Library:**
- `gemini-webapi>=1.17.0` - GeminiClient for auth and API calls
- `httpx>=0.24.0` - Async HTTP client
- `orjson>=3.9.0` - Fast JSON serialization

**Execution Pattern:**
```python
# Current sync pattern (works for images/text)
async def generate():
    client = GeminiClient(cookies)
    await client.init()
    response = await client.generate_content(prompt)
    return response.images[0] or response.text

# Async video pattern (NOT YET IMPLEMENTED)
# Step 1: Trigger
response = await client.generate_content("Generate video...")
# Returns: "I'm generating your video. Check back to see when it's ready."

# Step 2: Poll (NEEDS IMPLEMENTATION)
# How to check status? How to retrieve video?
```

### Current Limitations for Video

1. **No job ID returned** - Trigger returns text placeholder, not a job reference
2. **No status endpoint known** - Unknown how to check "is video ready?"
3. **No retrieval mechanism** - Unknown how to fetch completed video
4. **No state management** - CLI is stateless (each invocation is isolated)
5. **2 concurrent limit** - Gemini web UI shows "You have 2 video generation requests running"

## Async Video Generation Architecture Patterns

Based on research of async polling best practices and the official Gemini API patterns, here are proven approaches:

### Pattern A: Polling with Job Storage (Recommended)

**What:** Store job metadata locally, poll status endpoint, retrieve when complete

**How it works:**
```
1. Trigger:    geminipro --video "prompt" → returns job_id
2. Storage:    Save job_id + metadata to ~/.nanobanana/video_jobs.json
3. Status CLI: geminipro --video-status JOB_ID → "processing" | "completed" | "failed"
4. Poll loop:  geminipro --video-wait JOB_ID → polls until complete, downloads video
5. List jobs:  geminipro --video-list → shows all jobs (pending, complete, failed)
```

**Pros:**
- User controls polling (explicit wait command)
- Can check status without downloading
- Survives terminal restart
- Supports multiple concurrent jobs

**Cons:**
- Requires local job registry
- User must remember to check status
- More complex UX (multiple commands)

### Pattern B: Synchronous Polling with Timeout (Simplified)

**What:** Block and poll in the foreground until video completes or timeout

**How it works:**
```
1. Trigger + Wait: geminipro --video "prompt" --wait
2. Auto-poll:      Poll status every 10s (show progress dots)
3. Download:       Fetch video when status="completed"
4. Timeout:        Exit after 10 minutes with "still processing, check back later"
```

**Pros:**
- Simple UX (one command)
- Familiar to users (like image generation)
- No job storage needed
- Clear progress feedback

**Cons:**
- Blocks terminal for minutes
- Can't survive terminal kill
- Timeout means incomplete job (user loses reference)
- Only handles one video at a time

### Pattern C: Background Daemon (Over-engineered)

**What:** Long-running process polls jobs in background, notifies when complete

**How it works:**
```
1. Trigger:    geminipro --video "prompt" → adds to queue, returns job_id
2. Daemon:     geminipro-daemon runs in background, polls all jobs
3. Notify:     Desktop notification when video ready
4. Retrieve:   geminipro --video-get JOB_ID → downloads completed video
```

**Pros:**
- Non-blocking UX
- Handles multiple videos
- Automatic polling
- Desktop notifications

**Cons:**
- Requires daemon management (start/stop/restart)
- Complex implementation (process management, notifications)
- Overkill for CLI tool
- Platform-specific notification APIs

## Recommended Architecture: Pattern A with Pattern B Fallback

**Core principle:** Provide both explicit control (Pattern A) and convenience (Pattern B).

### Component Design

**1. Job Registry** (`~/.nanobanana/video_jobs.json`)
```json
{
  "jobs": [
    {
      "job_id": "video_20260119_123045",
      "prompt": "ocean waves at sunset",
      "status": "processing",
      "started_at": "2026-01-19T12:30:45Z",
      "updated_at": "2026-01-19T12:31:00Z",
      "video_url": null,
      "filepath": null,
      "error": null
    }
  ]
}
```

**2. Video Module** (new: `video_async.py`)
```python
# Shared by both nanobanana and geminipro

class VideoJobManager:
    """Manages video generation jobs with local persistence."""

    def create_job(prompt: str) -> str:
        """Trigger video generation, return job_id."""

    def get_status(job_id: str) -> dict:
        """Poll status endpoint, return {"status": "processing|completed|failed"}."""

    def wait_for_completion(job_id: str, timeout: int, callback) -> dict:
        """Poll until complete, with exponential backoff and progress callback."""

    def download_video(job_id: str, output_dir: Path) -> str:
        """Fetch completed video, return filepath."""

    def list_jobs(filter: str = None) -> list:
        """List all jobs (pending/complete/failed)."""
```

**3. CLI Interface Extensions**

**In geminipro.py:**
```bash
# Trigger video (returns immediately with job_id)
geminipro --video "prompt"
# Output: "Video generation started. Job ID: video_20260119_123045"
# Output: "Check status with: geminipro --video-status video_20260119_123045"

# Trigger + wait (synchronous polling)
geminipro --video "prompt" --wait
# Output: "Generating video... (0s elapsed)"
# Output: "Video ready! Saved to ~/.nanobanana/videos/video_20260119_123045.mp4"

# Check status only
geminipro --video-status JOB_ID
# Output: {"status": "processing", "elapsed": "45s"}

# List all jobs
geminipro --video-list
# Output: Table of all jobs (pending/complete/failed)

# Download completed video
geminipro --video-get JOB_ID -o /path/to/save
# Output: "/path/to/save/video.mp4"
```

**In nanobanana.py:**
```bash
# Same interface for consistency
nanobanana --video "prompt"
nanobanana --video "prompt" --wait
nanobanana --video-status JOB_ID
nanobanana --video-list
nanobanana --video-get JOB_ID -o /path
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ USER INITIATES VIDEO GENERATION                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ TRIGGER PHASE                                                   │
│ - geminipro.py calls VideoJobManager.create_job()              │
│ - GeminiClient.generate_content(prompt, video=True)            │
│ - Gemini API returns: job reference or placeholder text        │
│ - Generate job_id (timestamp-based or from API)                │
│ - Save to video_jobs.json: {status: "processing", started_at} │
│ - Return job_id to user                                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│ ASYNC MODE (--video)    │   │ SYNC MODE (--wait)      │
│ - Print job_id          │   │ - Enter poll loop       │
│ - Exit immediately      │   │ - Show progress         │
│ - User checks later     │   │ - Wait for completion   │
└─────────────────────────┘   └──────────┬──────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ POLLING PHASE (if --wait or explicit --video-status)           │
│ - VideoJobManager.wait_for_completion() or get_status()        │
│ - Poll Gemini status endpoint every 10s                        │
│ - Exponential backoff: 10s → 15s → 20s (max 30s)              │
│ - Update video_jobs.json on each status change                 │
│ - Check for: "processing", "completed", "failed"               │
│ - Timeout after 10 minutes (configurable)                      │
└─────────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│ COMPLETED               │   │ FAILED or TIMEOUT       │
│ - status="completed"    │   │ - status="failed"       │
│ - video_url available   │   │ - error message         │
└──────────┬──────────────┘   └──────────┬──────────────┘
           │                             │
           ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│ RETRIEVAL PHASE         │   │ ERROR HANDLING          │
│ - Download from URL     │   │ - Log error to registry │
│ - Save to output_dir    │   │ - Exit with error       │
│ - Update registry       │   │ - Suggest retry         │
│ - Print filepath        │   └─────────────────────────┘
└─────────────────────────┘
```

### Polling Strategy (Exponential Backoff)

Based on research and official Gemini API patterns:

```python
async def wait_for_completion(job_id: str, timeout: int = 600, progress_callback = None):
    """
    Poll video generation status with exponential backoff.

    Args:
        job_id: Job identifier
        timeout: Max wait time in seconds (default: 10 minutes)
        progress_callback: Optional function called on each poll (for progress display)

    Returns:
        dict: {"status": "completed|failed", "video_url": str, "error": str}
    """

    start_time = time.time()
    backoff_interval = 10  # Start at 10 seconds
    max_interval = 30      # Cap at 30 seconds

    while time.time() - start_time < timeout:
        # Poll status
        status = await get_video_status(job_id)

        # Update registry
        update_job_status(job_id, status)

        # Progress callback (for CLI progress display)
        if progress_callback:
            elapsed = int(time.time() - start_time)
            progress_callback(status=status['status'], elapsed=elapsed)

        # Check completion
        if status['status'] == 'completed':
            return status
        elif status['status'] == 'failed':
            return status

        # Wait with exponential backoff
        await asyncio.sleep(backoff_interval)
        backoff_interval = min(backoff_interval * 1.5, max_interval)

    # Timeout reached
    return {"status": "timeout", "error": f"Video not ready after {timeout}s"}
```

**Backoff schedule:**
- Poll 1: 0s (immediate)
- Poll 2: 10s
- Poll 3: 25s (10 + 15)
- Poll 4: 45s (25 + 20)
- Poll 5: 70s (45 + 25)
- Poll 6: 100s (70 + 30, capped)
- Poll 7: 130s (100 + 30)
- ...continues until timeout (600s = 10 minutes)

**Total polls in 10 minutes:** ~20 polls (average 30s interval after initial ramp-up)

## Critical Unknown: Gemini Web API Status Endpoint

**RESEARCH GAP:** The gemini-webapi library documentation and source code do not reveal:

1. **How to get a job ID** - Does trigger return job reference?
2. **Status endpoint URL** - Where to poll for completion?
3. **Video retrieval** - How to get download URL after completion?

### Investigation Strategy (for Implementation Phase)

**Option 1: Reverse Engineer Web UI**
- Open https://gemini.google.com in Chrome
- Trigger video generation
- Monitor Network tab (DevTools) for:
  - Initial trigger request format
  - Status polling requests (10s intervals)
  - Video URL retrieval
- Document endpoints and request/response formats

**Option 2: Check gemini-webapi Source**
- Review `gemini-webapi` library source for video support
- Check recent commits/PRs for Veo integration
- Look for `GetVideosOperation` method (mentioned in official API docs)

**Option 3: Official Gemini API as Reference**
- Official API uses `GenerateVideosRequest` → operation ID
- Poll with `GetVideosOperation(operation_id)` until done
- Web API may follow similar pattern (different endpoints)

**Option 4: Community Research**
- Search for gemini-webapi video examples
- Check GitHub issues for Veo support discussions
- Look for unofficial documentation or blog posts

### Expected Endpoint Structure (Hypothesis)

Based on official Gemini API and web API patterns:

```python
# Hypothesis: Trigger endpoint (existing)
POST https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate
Headers: MODEL_HEADER for Veo model
Body: prompt with video flag
Response: job_id or operation reference

# Hypothesis: Status endpoint (UNKNOWN)
GET https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/GetVideoStatus?job_id=XXX
Response: {"status": "processing|completed|failed", "video_url": "https://..."}

# Hypothesis: Video download (UNKNOWN)
GET <video_url from status response>
Response: video/mp4 binary data
```

**Confidence:** LOW - This is speculative. Implementation phase MUST verify actual endpoints.

## File Structure (After Implementation)

```
tools/nanobanana/
├── nanobanana.py              # Image generation/editing (existing)
├── geminipro.py               # Text + video CLI (enhanced)
├── video_async.py             # NEW: Async video job management
├── shared_auth.py             # NEW: Shared auth utilities (refactored)
├── requirements.txt           # Updated with backoff library
├── setup.sh                   # Unchanged
├── CLAUDE.md                  # Updated with video docs
└── .venv/                     # Python environment

~/.nanobanana/
├── cookies.json               # Existing: Auth cookies
├── images/                    # Existing: Generated images
├── videos/                    # NEW: Downloaded videos
└── video_jobs.json            # NEW: Job registry
```

## Component Boundaries

| Component | Responsibility | Used By |
|-----------|---------------|---------|
| `shared_auth.py` | Cookie setup, loading, validation | All tools |
| `video_async.py` | Job creation, polling, status, download | geminipro.py, nanobanana.py |
| `geminipro.py` | CLI interface, user interaction | End user |
| `nanobanana.py` | Image CLI + optional video support | End user |
| `video_jobs.json` | Persistent job state | video_async.py |
| Gemini Web API | Video generation, status, retrieval | video_async.py |

**Communication flow:**
```
geminipro.py → video_async.VideoJobManager → gemini-webapi.GeminiClient → Gemini API
                                ↓
                        video_jobs.json (state persistence)
```

## Build Order & Dependencies

### Phase 1: Research & Validation (CRITICAL FIRST)

**Goal:** Find the actual API endpoints before writing code

**Tasks:**
1. Reverse engineer Gemini web UI video flow (Network tab)
2. Document trigger, status, retrieval endpoints
3. Verify gemini-webapi library support for video
4. Test manual API calls with httpx

**Output:** Documented endpoints, request/response formats, auth requirements

**Blockers:** If endpoints aren't discoverable, entire approach may need pivot

### Phase 2: Shared Auth Refactoring (Foundation)

**Goal:** Extract shared auth code for reuse

**Tasks:**
1. Create `shared_auth.py` with `setup_cookies()`, `load_cookies()`
2. Update `nanobanana.py` to import from shared module
3. Update `geminipro.py` to import from shared module
4. Test existing functionality (images, text) still works

**Dependencies:** None (uses existing code)

**Output:** DRY auth utilities, no functional changes

### Phase 3: Job Registry (State Management)

**Goal:** Implement local job storage

**Tasks:**
1. Create `VideoJobRegistry` class
2. Implement CRUD operations (create, read, update, list)
3. Add file locking for concurrent access safety
4. Write unit tests for registry

**Dependencies:** Phase 2 (uses shared auth)

**Output:** `video_async.py` with registry only

### Phase 4: Video Trigger (First Integration Point)

**Goal:** Trigger video generation and save job

**Tasks:**
1. Implement `VideoJobManager.create_job()`
2. Call Gemini API with video prompt
3. Parse response for job ID (format TBD from Phase 1)
4. Save job to registry
5. Add `--video` flag to geminipro.py CLI

**Dependencies:** Phase 1 (needs endpoints), Phase 3 (needs registry)

**Output:** `geminipro --video "prompt"` creates job, returns job_id

### Phase 5: Status Polling (Core Async Logic)

**Goal:** Poll for completion with exponential backoff

**Tasks:**
1. Install `backoff` library for retry/polling
2. Implement `VideoJobManager.get_status()`
3. Implement `VideoJobManager.wait_for_completion()`
4. Add progress callback for CLI feedback
5. Add `--video-status` and `--wait` flags to CLI

**Dependencies:** Phase 4 (needs job creation)

**Output:** `geminipro --video-status JOB_ID` polls status

### Phase 6: Video Retrieval (Download)

**Goal:** Fetch completed video from URL

**Tasks:**
1. Implement `VideoJobManager.download_video()`
2. Stream download to file (handle large videos)
3. Update registry with filepath
4. Add `--video-get` flag to CLI

**Dependencies:** Phase 5 (needs completion detection)

**Output:** `geminipro --video-get JOB_ID -o /path` downloads video

### Phase 7: Job Management (UX Polish)

**Goal:** List, clean up old jobs

**Tasks:**
1. Implement `VideoJobManager.list_jobs()`
2. Add filtering (pending, complete, failed)
3. Add `--video-list` flag to CLI
4. Pretty-print table output
5. Add job cleanup (delete old jobs)

**Dependencies:** Phase 6 (all job operations complete)

**Output:** `geminipro --video-list` shows job table

### Phase 8: Error Handling & Edge Cases

**Goal:** Robust failure modes

**Tasks:**
1. Handle timeout scenarios (update registry, clear instructions)
2. Handle network failures (retry logic)
3. Handle invalid job IDs (user-friendly errors)
4. Handle concurrent job limits (error message: "2 videos already running")
5. Add `--debug` mode for troubleshooting

**Dependencies:** All phases (integrates across codebase)

**Output:** Production-ready error handling

### Dependency Graph

```
Phase 1 (Research) ─────────────┐
                                ├──> Phase 4 (Trigger)
Phase 2 (Auth) ─> Phase 3 (Registry) ─────┘
                                            │
                                            ▼
                                    Phase 5 (Polling)
                                            │
                                            ▼
                                    Phase 6 (Retrieval)
                                            │
                                            ▼
                        Phase 7 (Management) + Phase 8 (Errors)
```

**Critical path:** Phase 1 → Phase 4 → Phase 5 → Phase 6

**Can work in parallel:**
- Phase 2 (Auth refactor) while Phase 1 (Research) ongoing
- Phase 3 (Registry) while Phase 2 (Auth) ongoing
- Phase 7 (Management) and Phase 8 (Errors) can overlap

## Integration Points with Existing Code

### Minimal Changes to geminipro.py

```python
# ADD: Imports
from video_async import VideoJobManager
from shared_auth import load_cookies, setup_cookies

# ADD: CLI arguments
parser.add_argument("--video", action="store_true", help="Generate video instead of text")
parser.add_argument("--video-status", metavar="JOB_ID", help="Check video generation status")
parser.add_argument("--video-list", action="store_true", help="List all video jobs")
parser.add_argument("--video-get", metavar="JOB_ID", help="Download completed video")
parser.add_argument("--wait", action="store_true", help="Wait for video completion (with --video)")

# ADD: Video flow
if args.video:
    manager = VideoJobManager()
    job_id = manager.create_job(args.prompt)

    if args.wait:
        result = await manager.wait_for_completion(job_id, timeout=args.timeout)
        if result['status'] == 'completed':
            filepath = manager.download_video(job_id, output_dir)
            print(filepath)
    else:
        print(f"Video generation started. Job ID: {job_id}")
        print(f"Check status: geminipro --video-status {job_id}")

# KEEP: Existing text generation flow unchanged
else:
    result = asyncio.run(chat(args.prompt, ...))
```

### No Changes to nanobanana.py (Initially)

Nanobanana focuses on images. Video support is optional (could add same flags later for consistency).

## Scalability Considerations

| Concern | At 1 video | At 10 videos | At 100 videos |
|---------|------------|--------------|---------------|
| **Job registry size** | ~200 bytes JSON | ~2 KB | ~20 KB (negligible) |
| **Concurrent polling** | 1 poll/10s | 10 polls/10s | 100 polls/10s (API rate limit risk) |
| **Storage** | ~50 MB/video | ~500 MB | ~5 GB (user problem, not tool) |
| **Registry cleanup** | Manual | Manual | Auto-cleanup old jobs (>30 days) |

**Rate limiting:** Gemini Web API likely has rate limits. If user has 100+ videos polling simultaneously, may hit limits. Mitigation: Stagger polls with jitter.

**Recommendation:** Add rate limit handling in Phase 8 (errors) if API returns 429 Too Many Requests.

## Technology Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Polling library** | `backoff` | Standard, decorator-based, supports async |
| **State storage** | JSON file | Simple, human-readable, no DB needed for CLI |
| **File structure** | Single `video_async.py` | Keep video logic contained, easy to test |
| **CLI tool** | Extend `geminipro.py` | Text and video are both Gemini 3 Pro features |
| **Job ID format** | `video_YYYYMMDD_HHMMSS` | Timestamp-based, unique, sortable |
| **Polling interval** | 10s → 30s (exponential) | Balances freshness vs API load |
| **Default timeout** | 600s (10 minutes) | Videos take ~2-8 minutes per docs |

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Videos in Registry

**What:** Embedding video binary data in `video_jobs.json`

**Why bad:** Videos are 10-100 MB, would bloat JSON file

**Instead:** Store only filepath reference, video saved to `~/.nanobanana/videos/`

### Anti-Pattern 2: Synchronous Polling Only

**What:** Only providing `--wait` mode (blocks terminal)

**Why bad:** User can't multitask, loses job reference if terminal killed

**Instead:** Primary mode is async (`--video`), `--wait` is convenience

### Anti-Pattern 3: No Timeout on Polling

**What:** Polling forever until video completes

**Why bad:** Could loop indefinitely if Gemini API fails

**Instead:** 10-minute timeout, save job in registry for later retry

### Anti-Pattern 4: Coupled Video Logic

**What:** Mixing video logic directly into geminipro.py main function

**Why bad:** Makes testing hard, can't reuse in nanobanana.py

**Instead:** Separate `video_async.py` module, imported by both tools

### Anti-Pattern 5: Ignoring Concurrent Limits

**What:** Allowing unlimited video triggers

**Why bad:** Gemini API has 2 concurrent limit, additional triggers fail

**Instead:** Check job count before trigger, error if 2+ pending jobs

## Testing Strategy

### Unit Tests
- `video_async.py` - Job creation, registry CRUD, status parsing
- `shared_auth.py` - Cookie loading, validation

### Integration Tests
- Full flow: trigger → poll → download (with mocked Gemini API)
- Error scenarios: timeout, network failure, invalid job ID

### Manual Testing (Critical for Phase 1)
- Trigger real video via Gemini Web UI
- Monitor network traffic
- Replicate API calls with httpx
- Verify endpoint hypothesis

## Open Questions (for Implementation Phase)

1. **Endpoint discovery:** What are the actual Gemini Web API video endpoints?
2. **Job ID format:** Does API return structured job ID or just placeholder text?
3. **Auth requirements:** Do video endpoints need special headers beyond MODEL_HEADER?
4. **Concurrent limits:** How does API enforce 2-video limit? Status code? Error message?
5. **Video URL lifetime:** Do download URLs expire? Need to cache video immediately?
6. **Retrieval format:** Is video streamed or single response? Need chunked download?

## Sources

### Async Polling Best Practices
- [Asynchronous Request-Reply pattern - Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/async-request-reply)
- [Polling for Status of Asynchronous Operation - .NET](https://learn.microsoft.com/en-us/dotnet/standard/asynchronous-programming-patterns/polling-for-the-status-of-an-asynchronous-operation)
- [Managing Asynchronous Workflows with REST API - AWS Architecture Blog](https://aws.amazon.com/blogs/architecture/managing-asynchronous-workflows-with-a-rest-api/)
- [Design asynchronous API - REST API Cookbook](https://octo-woapi.github.io/cookbook/asynchronous-api.html)

### Polling vs Webhooks Architecture
- [Webhooks vs Long Polling - Svix Resources](https://www.svix.com/resources/faq/webhooks-vs-long-polling/)
- [Polling vs Webhooks - ByteByteGo](https://blog.bytebytego.com/p/ep100-polling-vs-webhooks)
- [Polling vs webhooks - Merge.dev](https://www.merge.dev/blog/webhooks-vs-polling)

### Python Implementation
- [backoff library - PyPI](https://pypi.org/project/backoff/)
- [Tenacity - Retrying Library](https://tenacity.readthedocs.io/)
- [Developing Asynchronous Task Queue in Python - TestDriven.io](https://testdriven.io/blog/developing-an-asynchronous-task-queue-in-python/)

### Gemini Video Generation
- [Generate videos with Veo 3.1 in Gemini API - Google AI](https://ai.google.dev/gemini-api/docs/video)
- [Video Generation with Veo - liteLLM](https://docs.litellm.ai/docs/providers/gemini/videos)

## Next Steps

**For roadmap creation:**
1. **Phase 1 (Research)** must happen FIRST - without endpoints, architecture is speculative
2. **Phase 2-3 (Foundation)** can start in parallel - refactoring and registry don't depend on video API
3. **Phase 4-6 (Core video)** are sequential and depend on Phase 1 findings
4. **Phase 7-8 (Polish)** can happen after core works

**Estimated complexity:**
- Phase 1: 2-4 hours (reverse engineering)
- Phase 2-3: 2-3 hours (refactoring)
- Phase 4-6: 4-6 hours (core video logic)
- Phase 7-8: 2-3 hours (UX polish)

**Total:** ~10-16 hours for full implementation

**Risk:** High - Phase 1 could reveal endpoints aren't accessible, requiring pivot to official Gemini API instead of web API.
