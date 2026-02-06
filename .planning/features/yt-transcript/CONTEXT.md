# YouTube Transcript Tool — Context

## Vision
When a YouTube URL is pasted with a question, Claude Code automatically spawns the `youtube-analyst` sub-agent. The agent fetches the transcript, provides a brief summary, answers the question, and references timestamps.

## Key Decisions
- Python with `youtube-transcript-api` (no auth required)
- Sub-agent named `youtube-analyst`
- Auto-invoked when YouTube URL detected
- Output includes timestamps
- Agent provides: summary + answer + timestamp references

## Must-haves
- CLI tool: `yt-transcript <url>` returns timestamped transcript
- `--json` flag for structured output (sub-agent consumption)
- Graceful error handling (no transcript available, invalid URL)
- Sub-agent auto-detection on YouTube URLs
- Global installation (works from any directory)

## Out of scope
- Audio transcription fallback (Whisper)
- Translation features
- Follow-up questions (sub-agents are stateless)

## Technical Notes
- Extract video ID from URL before passing to library
- 10-20% of videos lack transcripts — handle gracefully
- Age-restricted content won't work (API limitation)
- Library: `youtube-transcript-api`
