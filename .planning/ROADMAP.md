# Roadmap: YouTube Transcript Tool + Sub-Agent

## Overview

Build a CLI tool (`yt-transcript`) that fetches YouTube video transcripts, and a Claude Code sub-agent (`youtube-analyst`) that automatically uses it to answer questions about videos when URLs are pasted.

## Phases

- [ ] **Phase 1: CLI Tool** — Build `yt-transcript` Python CLI
- [ ] **Phase 2: Sub-Agent** — Create `youtube-analyst` sub-agent
- [ ] **Phase 3: Documentation** — Update CLAUDE.md, install globally

## Phase Details

### Phase 1: CLI Tool
**Goal**: Working CLI that fetches timestamped transcripts from YouTube URLs
**Depends on**: Nothing
**Size**: Small

**Deliverables**:
- [ ] Python CLI using `youtube-transcript-api`
- [ ] Accepts YouTube URL (any format), extracts video ID
- [ ] Returns timestamped transcript (default)
- [ ] `--json` flag for structured output (for sub-agent)
- [ ] `--no-timestamps` flag for plain text
- [ ] Graceful error handling (no transcript, age-restricted, invalid URL)
- [ ] Virtual environment + requirements.txt

**Success Criteria**:
1. `yt-transcript "https://youtube.com/watch?v=xyz"` returns timestamped transcript
2. `yt-transcript --json <url>` returns JSON with transcript array
3. Errors return clear messages, non-zero exit codes

### Phase 2: Sub-Agent
**Goal**: Claude Code auto-invokes agent when YouTube URL detected
**Depends on**: Phase 1
**Size**: Small

**Deliverables**:
- [ ] `~/.claude/agents/youtube-analyst.md` sub-agent config
- [ ] YAML frontmatter with name, description, tools (Bash, Read)
- [ ] System prompt that instructs agent to:
  - Run `yt-transcript --json <url>`
  - Provide brief video summary
  - Answer user's question
  - Reference timestamps in response
- [ ] Description triggers auto-detection on YouTube URLs

**Success Criteria**:
1. Pasting YouTube URL + question auto-spawns youtube-analyst
2. Agent returns summary + answer with timestamp references
3. Graceful handling when transcript unavailable

### Phase 3: Documentation
**Goal**: Tool is globally installed and documented
**Depends on**: Phase 2
**Size**: Small

**Deliverables**:
- [ ] Install script or manual install instructions
- [ ] Add `yt-transcript` to global CLAUDE.md CLI tools section
- [ ] Document sub-agent in CLAUDE.md
- [ ] Test end-to-end in fresh Claude Code session

**Success Criteria**:
1. `yt-transcript` works from any directory
2. CLAUDE.md documents usage
3. Sub-agent works in any project

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. CLI Tool | Not started | - |
| 2. Sub-Agent | Not started | - |
| 3. Documentation | Not started | - |

---
*Roadmap created: 2026-01-20*
