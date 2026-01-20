# Project State

## Current Position
**Status:** Ready to start
**Next:** Phase 1 - CLI Tool

## Decisions
- [2026-01-20]: Use Python with `youtube-transcript-api` (no auth required, works locally)
- [2026-01-20]: Sub-agent named `youtube-analyst`, auto-invoked on YouTube URLs
- [2026-01-20]: Output includes timestamps, agent provides summary + answer

## Notes
- 10-20% of videos lack transcripts — handle gracefully
- Age-restricted content won't work (API limitation)
- Extract video ID from URL before passing to library
