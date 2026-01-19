# Roadmap: mr-tools v1.0 Nanobanana Video

## Overview

This roadmap adds video generation capabilities to the nanobanana tool suite. The work progresses from research validation through core implementation to production hardening. Approach: reverse-engineer Gemini web interface to enable cookie-based video generation (free via existing AI Pro subscription). Five phases deliver complete video generation, retrieval, and batch processing.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Research Validation** - Validate findings and document video generation lifecycle
- [ ] **Phase 2: Core Video Generation** - Implement video trigger, polling, and retrieval
- [ ] **Phase 3: Output & Integration** - File output options and agent-friendly JSON mode
- [ ] **Phase 4: Error Handling** - Robust handling for limits, timeouts, and failures
- [ ] **Phase 5: Advanced Features** - Reference images and batch queue management

## Phase Details

### Phase 1: Research Validation
**Goal**: Confirm research findings and document the complete video generation lifecycle
**Depends on**: Nothing (first phase)
**Requirements**: RES-01, RES-02, RES-03, RES-04
**Success Criteria** (what must be TRUE):
  1. Video generation request/response format is documented with working code sample
  2. Polling mechanism for video status is confirmed and documented
  3. Video retrieval endpoint and auth requirements are verified
  4. Complete async lifecycle (trigger -> poll -> retrieve) is documented end-to-end
**Plans**: 1 plan

Plans:
- [ ] 01-01-PLAN.md - Capture video generation flow via DevTools, replicate with code, download video to Desktop

### Phase 2: Core Video Generation
**Goal**: User can generate videos with text prompts and retrieve completed videos
**Depends on**: Phase 1
**Requirements**: VID-01, VID-02, VID-03, VID-04, VID-05, VID-06
**Success Criteria** (what must be TRUE):
  1. User can trigger video generation with `nanobanana --video "prompt"` and receive job ID
  2. Tool automatically polls and reports when video is ready (with elapsed time display)
  3. User can retrieve completed video to local filesystem
  4. User can specify duration (4s/6s/8s) and aspect ratio (16:9/9:16) via flags
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Output & Integration
**Goal**: Flexible file output and programmatic use via JSON mode
**Depends on**: Phase 2
**Requirements**: OUT-01, OUT-02, OUT-03, AGT-01, AGT-02, AGT-03
**Success Criteria** (what must be TRUE):
  1. User can save video to custom path with `-d` (directory) and `-o` (filename) flags
  2. Videos save to ~/.nanobanana/videos/ by default with timestamp naming
  3. Desktop output option works for quick access
  4. `--json` flag outputs structured JSON (job ID, status, file path, errors)
  5. Exit codes correctly indicate success (0) or failure (non-zero)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Error Handling
**Goal**: Graceful handling of all failure modes with actionable user messages
**Depends on**: Phase 3
**Requirements**: ERR-01, ERR-02, ERR-03, ERR-04
**Success Criteria** (what must be TRUE):
  1. Concurrent limit (max 2) triggers clear message with wait/list instructions
  2. Generation timeout (configurable) terminates with job ID for manual retry
  3. Cookie/auth expiration triggers refresh prompt before failing
  4. Content policy rejections show specific guidance on prompt revision
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Advanced Features
**Goal**: Reference image support and batch queue for multiple videos
**Depends on**: Phase 4
**Requirements**: REF-01, REF-02, BAT-01, BAT-02, BAT-03
**Success Criteria** (what must be TRUE):
  1. User can provide reference image for character/style consistency
  2. Multiple reference images (up to 3) work if API supports it
  3. User can queue multiple prompts and tool manages them automatically
  4. Batch respects 2-concurrent limit with automatic pacing
  5. Batch progress display shows completed/pending/failed count
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Research Validation | 0/1 | Planned | - |
| 2. Core Video Generation | 0/? | Not started | - |
| 3. Output & Integration | 0/? | Not started | - |
| 4. Error Handling | 0/? | Not started | - |
| 5. Advanced Features | 0/? | Not started | - |

---
*Roadmap created: 2026-01-19*
*Last updated: 2026-01-19*
