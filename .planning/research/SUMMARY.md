# Project Research Summary

**Project:** mr-tools nanobanana enhancement - Video Generation
**Domain:** Async video generation CLI tool using Gemini 3 Pro (Veo 3.1)
**Researched:** 2026-01-19
**Confidence:** HIGH

## Executive Summary

Adding video generation to nanobanana requires a **dual-authentication architecture**: keep cookie-based auth for free image generation while adding API key auth for paid video features. Video generation through Veo 3.1 is fundamentally asynchronous (11 seconds to 6 minutes per video), which means the current synchronous CLI pattern cannot work. The core technical challenge is implementing robust polling with exponential backoff, proper timeout handling, and a job registry to survive terminal restarts.

The recommended approach is a hybrid architecture. Images continue using the existing `gemini-webapi` library with browser cookies (free). Videos use the official `google-genai` SDK with an API key ($0.15-$0.40 per second). This hybrid approach preserves backward compatibility while enabling the new capability. A new `video_async.py` module will handle job management, polling, and retrieval for both `nanobanana.py` and `geminipro.py`.

The primary risks are: (1) infinite polling loops if generation gets stuck at 99% (documented community issue), (2) cookie expiration during long-running generations causing retrieval failures, and (3) naive rate limiting hitting the 2-concurrent-video limit. All three require explicit prevention strategies from day one.

## Key Findings

### Recommended Stack

The official `google-genai` SDK (v1.59.0+) is the only library supporting Veo video generation. The legacy `google-generativeai` package was deprecated in August 2025. For polling, use the `backoff` library for exponential retry logic with jitter. Install `aiohttp` for 10x faster async HTTP operations during polling.

**Core technologies:**
- **google-genai >=1.59.0**: Video generation via Veo 3.1 — only official SDK with support
- **backoff >=2.2.0**: Exponential backoff with jitter — prevents retry storms during polling
- **aiohttp >=3.9.0**: Async HTTP client — 10x faster than httpx for high-frequency polling
- **gemini-webapi >=1.17.0**: Keep for image generation — cookie-based, free tier

**Authentication split:**
- Image generation: Cookie-based (existing, free)
- Video generation: API key (new, paid: $0.15-$0.40/second)

### Expected Features

**Must have (table stakes):**
- Text-to-video with async polling — core functionality
- Status checking by operation ID — required for async workflow
- Progress indicators — users wait 5-10 minutes, need feedback
- File output to Desktop/custom path — consistent with nanobanana image behavior
- JSON mode (`--json`) — agent/Claude Code integration
- Duration (4s/6s/8s), aspect ratio (16:9/9:16), resolution (720p/1080p/4K) controls

**Should have (differentiators):**
- Reference image support (up to 3 images) — character/object consistency (high value)
- Batch queue with concurrency management — handles 2-concurrent limit automatically
- Retry with exponential backoff — resilience to API hiccups
- Local operation cache — resume interrupted polls across terminal restarts
- Video metadata saved alongside output — track prompts and parameters

**Defer to v2+:**
- Video extension workflow (chaining clips >8s) — complex, less common use case
- Frame interpolation (first+last frame) — advanced, low initial demand
- Cinematography shortcut flags (`--dolly-shot`) — convenience, not essential
- Interactive prompt templates — nice UX, not blocking

### Architecture Approach

The architecture combines two patterns: (A) Job storage with explicit status commands for users who want control, and (B) Synchronous polling with timeout for users who want convenience (`--wait` flag). A new `video_async.py` module centralizes all video logic. Jobs persist to `~/.nanobanana/video_jobs.json` to survive terminal restarts.

**Major components:**
1. **VideoJobManager** — creates jobs, polls status, handles downloads, manages registry
2. **Job Registry** (`video_jobs.json`) — persistent storage for job state across CLI invocations
3. **shared_auth.py** — refactored auth utilities (cookies + API key), shared by all tools
4. **CLI extensions** — new flags: `--video`, `--video-status`, `--video-list`, `--video-get`, `--wait`

**File structure after implementation:**
```
tools/nanobanana/
├── nanobanana.py          # Image generation (existing)
├── geminipro.py           # Text + video CLI (enhanced)
├── video_async.py         # NEW: Async video job management
├── shared_auth.py         # NEW: Shared auth utilities
├── requirements.txt       # Updated with new dependencies
└── CLAUDE.md              # Updated with video docs

~/.nanobanana/
├── cookies.json           # Existing: Auth cookies
├── videos/                # NEW: Downloaded videos
└── video_jobs.json        # NEW: Job registry
```

### Critical Pitfalls

1. **Infinite polling without timeout** — Generation can get stuck at 99%. Always use BOTH max attempts (60) AND wall clock timeout (15 minutes). Log elapsed time and provide clear timeout messages with operation ID for manual retry.

2. **Cookie expiration mid-generation** — Cookies expire during 5-10 minute generation window. Refresh cookies immediately before download. Implement retry with fresh auth on 401 errors. Consider proactive refresh every 4 minutes.

3. **Placeholder URL assumption** — Initial API response URL is NOT the download link. Must poll operation status until `done: true`, then extract actual video URL from completed operation response.

4. **No failed state handling** — API returns various error types (quota exceeded, content policy, server error). Parse errors and provide actionable feedback: "Prompt violates content policy - revise prompt" vs "Quota exceeded - wait until midnight UTC."

5. **Naive concurrency limits** — Gemini has multi-dimensional limits (concurrent, RPM, RPD). Check pending job count before triggering new generation. Clear error: "2 videos already generating, wait or check status with --video-list."

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation (Auth + Registry)
**Rationale:** Must establish infrastructure before video logic. Auth refactoring and registry don't depend on video API specifics.
**Delivers:** `shared_auth.py` with dual auth support, `VideoJobRegistry` class, `~/.nanobanana/video_jobs.json` schema
**Addresses:** DRY auth code, state persistence requirement
**Avoids:** Coupled video logic pitfall
**Estimated time:** 2-3 hours

### Phase 2: Core Video Generation
**Rationale:** Main implementation after foundation is ready.
**Delivers:** `VideoJobManager.create_job()`, `--video` flag, job creation and storage
**Uses:** google-genai SDK, registry from Phase 1
**Addresses:** Text-to-video table stake
**Avoids:** Placeholder URL pitfall (proper response parsing from official SDK)
**Estimated time:** 2-3 hours

### Phase 3: Status Polling
**Rationale:** Build on Phase 2 trigger capability. Critical for async workflow.
**Delivers:** `VideoJobManager.wait_for_completion()`, `--wait` and `--video-status` flags, progress indicators
**Uses:** backoff library for exponential retry
**Addresses:** Async operation polling, status checking, progress indicators (all table stakes)
**Avoids:** Infinite polling pitfall (timeout + max attempts), fixed polling interval (exponential backoff with jitter)
**Estimated time:** 2-3 hours

### Phase 4: Video Retrieval
**Rationale:** Completes the core workflow (trigger -> poll -> download).
**Delivers:** `VideoJobManager.download_video()`, `--video-get` flag, file output to Desktop/custom path
**Uses:** aiohttp for streaming download
**Addresses:** Video retrieval, file output (table stakes)
**Avoids:** Cookie expiration pitfall (fresh auth before download), partial download (streaming with verification)
**Estimated time:** 1-2 hours

### Phase 5: Job Management + Error Handling
**Rationale:** Polish layer after core workflow works. Production hardening.
**Delivers:** `--video-list` flag, pretty table output, job cleanup, detailed error messages, concurrent limit checking
**Addresses:** Failed state handling, actionable error feedback, concurrency limits
**Avoids:** No failed state handling pitfall, naive concurrency pitfall
**Estimated time:** 2-3 hours

### Phase Ordering Rationale

- **Foundation first** — auth and registry are prerequisites for all video operations.
- **Phases 2-4 are sequential** — each builds on the previous (trigger -> poll -> download).
- **Phase 5 is polish** — only makes sense after core workflow is functional; edge cases discovered through earlier testing.

The grouping follows ARCHITECTURE.md component boundaries: shared auth module, job manager module, CLI interface. Each phase delivers a working increment that can be tested independently.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Verify exact response format from official SDK with real API key. May need to tune for Veo-specific quirks.
- **Phase 5:** Error taxonomy not fully documented. Discover all error types through testing: quota exceeded, content policy, billing errors.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Standard Python module refactoring, JSON file persistence. Well-documented patterns.
- **Phase 3:** Exponential backoff is AWS-documented best practice. `backoff` library handles complexity.
- **Phase 4:** Standard file download with streaming. Nothing novel.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Google SDK docs, PyPI package info, migration guides |
| Features | HIGH | Official Veo 3.1 docs, API parameters well-documented |
| Architecture | HIGH | Polling patterns from AWS/Azure docs; official SDK handles API details |
| Pitfalls | MEDIUM | Official rate limit docs; some pitfalls from community reports (99% stuck issue) |

**Overall confidence:** HIGH

Stack and features are well-documented via official Google sources. Architecture uses proven async patterns. Pitfalls are comprehensive but cookie expiration timing and some error modes need validation during implementation.

### Gaps to Address

- **Cookie refresh interval:** Google session patterns suggest 4-6 hours, but exact timing for video auth is unverified. Test during Phase 4.
- **Concurrent limit enforcement:** Unknown whether API returns 429 or specific error message when limit exceeded. Discover during Phase 5.
- **Video URL lifetime:** Do download URLs expire? May need to cache video immediately after status=completed. Test during Phase 4.
- **Error taxonomy:** Full list of Veo-specific error codes not documented. Build error handling incrementally in Phase 5.

## Sources

### Primary (HIGH confidence)
- [Google Gen AI SDK documentation](https://googleapis.github.io/python-genai/) — SDK usage, video generation API
- [Generate videos with Veo 3.1 in Gemini API](https://ai.google.dev/gemini-api/docs/video) — Official video generation docs
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits) — Quota dimensions, concurrent limits
- [google-genai PyPI](https://pypi.org/project/google-genai/) — Package versions, deprecation notice for google-generativeai
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) — Veo pricing: $0.15-$0.40/second

### Secondary (MEDIUM confidence)
- [AWS: Timeouts, retries and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) — Polling best practices
- [Azure: Asynchronous Request-Reply pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/async-request-reply) — Async architecture patterns
- [liteLLM Gemini Video docs](https://docs.litellm.ai/docs/providers/gemini/videos) — Alternative SDK patterns, confirms polling approach
- [Ultimate Prompting Guide for Veo 3.1](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1) — Prompt structure best practices

### Tertiary (LOW confidence, needs validation)
- [Video generation stops at 99% - Gemini Community](https://support.google.com/gemini/thread/394508421) — User reports of stuck generation
- Cookie expiration timing — Inferred from general Google session patterns, not Gemini-specific docs
- [HTTPX vs AIOHTTP performance](https://github.com/encode/httpx/issues/3215) — Community benchmarks, 10x faster claim

---
*Research completed: 2026-01-19*
*Ready for roadmap: yes*
