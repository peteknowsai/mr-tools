# Requirements: mr-tools v1.0 Nanobanana Video

**Defined:** 2026-01-19
**Core Value:** Provide reliable, well-documented tools that enable autonomous AI development workflows

## v1 Requirements

Requirements for initial release. Focus on cookie-based video generation via Gemini web interface.

### Research & Reverse Engineering

- [ ] **RES-01**: Investigate Gemini web interface video generation request/response format
- [ ] **RES-02**: Identify video status polling mechanism (how browser checks if video is ready)
- [ ] **RES-03**: Determine video retrieval endpoint and authentication requirements
- [ ] **RES-04**: Document async video generation lifecycle (trigger → poll → retrieve)

### Core Video Generation

- [ ] **VID-01**: User can trigger video generation with text prompt via cookie auth
- [ ] **VID-02**: Tool polls for video completion status automatically
- [ ] **VID-03**: Tool retrieves completed video when ready
- [ ] **VID-04**: User can specify video duration (4s, 6s, 8s if supported)
- [ ] **VID-05**: User can specify aspect ratio (16:9 landscape, 9:16 portrait)
- [ ] **VID-06**: Progress indicators during generation wait (elapsed time, status)

### File Output

- [ ] **OUT-01**: Save video to user-specified path (`-d` and `-o` flags)
- [ ] **OUT-02**: Default output to ~/.nanobanana/videos/ with timestamp
- [ ] **OUT-03**: Desktop output option for quick access

### Agent Integration

- [ ] **AGT-01**: JSON output mode (`--json`) for programmatic use
- [ ] **AGT-02**: Exit codes indicate success (0) or failure (non-zero)
- [ ] **AGT-03**: Structured error messages in JSON mode

### Error Handling

- [ ] **ERR-01**: Handle concurrent generation limit (max 2) with clear message
- [ ] **ERR-02**: Handle generation timeout with configurable limit
- [ ] **ERR-03**: Handle cookie expiration with refresh prompt
- [ ] **ERR-04**: Handle content policy rejections gracefully

### Reference Images (if web interface supports)

- [ ] **REF-01**: Accept reference image for character/style consistency
- [ ] **REF-02**: Support up to 3 reference images if API allows

### Batch Queue (handles concurrent limits)

- [ ] **BAT-01**: Accept multiple prompts and queue them
- [ ] **BAT-02**: Automatically manage 2 concurrent limit
- [ ] **BAT-03**: Progress display for batch operations

## v2 Requirements

Deferred to future release. Lower priority or requires more research.

### Video Extension
- **EXT-01**: Extend existing video with additional prompt
- **EXT-02**: Chain extensions for videos >8 seconds

### Advanced Options
- **ADV-01**: Negative prompting (`--exclude` flag)
- **ADV-02**: Seed control for reproducibility
- **ADV-03**: Resolution selection (720p, 1080p, 4K)
- **ADV-04**: Prompt templates for structured generation

### Community Contribution
- **CON-01**: Package video support as gemini-webapi PR
- **CON-02**: Document reverse-engineering findings for community

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| API key authentication | Using cookie-based auth (included with AI Pro subscription) |
| Per-request billing | Free via existing subscription |
| Video editing | Generate-only tool, use external editors |
| Real-time streaming | Veo doesn't support it, async only |
| Local video processing | Out of scope, use ffmpeg if needed |
| GUI/web interface | CLI tool only |
| Background generation daemon | Complexity vs value tradeoff |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RES-01 | Phase 1 | Pending |
| RES-02 | Phase 1 | Pending |
| RES-03 | Phase 1 | Pending |
| RES-04 | Phase 1 | Pending |
| VID-01 | Phase 2 | Pending |
| VID-02 | Phase 2 | Pending |
| VID-03 | Phase 2 | Pending |
| VID-04 | Phase 2 | Pending |
| VID-05 | Phase 2 | Pending |
| VID-06 | Phase 2 | Pending |
| OUT-01 | Phase 3 | Pending |
| OUT-02 | Phase 3 | Pending |
| OUT-03 | Phase 3 | Pending |
| AGT-01 | Phase 3 | Pending |
| AGT-02 | Phase 3 | Pending |
| AGT-03 | Phase 3 | Pending |
| ERR-01 | Phase 4 | Pending |
| ERR-02 | Phase 4 | Pending |
| ERR-03 | Phase 4 | Pending |
| ERR-04 | Phase 4 | Pending |
| REF-01 | Phase 5 | Pending |
| REF-02 | Phase 5 | Pending |
| BAT-01 | Phase 5 | Pending |
| BAT-02 | Phase 5 | Pending |
| BAT-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-19*
*Last updated: 2026-01-19 after initial definition*
